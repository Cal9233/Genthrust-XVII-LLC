/**
 * Inbox Monitor — Main orchestrator for email intelligence
 *
 * Trigger.dev v4 scheduled task, every 5 minutes.
 * Singleton concurrency — only one instance runs at a time.
 *
 * Flow: poll mailboxes -> dedup -> rules engine -> context enrichment -> LLM scoring -> route -> notify -> log
 */

import { schedules, logger } from "@trigger.dev/sdk/v3";
import { query } from "@/lib/db";
import { createHash } from "crypto";

// Graph API layer (built by integrations-auth-engineer)
import { fetchNewEmails, type GraphEmail } from "@/lib/graph/inbox-reader";
import { getOpenTasks } from "@/lib/graph/todo-reader";

// Intelligence layer
import {
  applyRules,
  loadRules,
  clearRulesCache,
} from "@/lib/services/email-rules-engine";
import {
  enrichEmailContext,
  type TodoTask,
} from "@/lib/services/email-context-enricher";
import {
  scoreEmails,
  type EnrichedEmail,
  type ScoredEmail,
} from "@/lib/services/email-haiku-scorer";
import { isQuietHours } from "@/lib/services/email-quiet-hours";

// Notification layer (built by integrations-auth-engineer)
import { sendUrgentCard } from "@/lib/services/teams-notifier";
import {
  buildUrgentCard,
  type ScoredEmailForCard,
} from "@/lib/services/adaptive-cards";

// ==========================================
// TYPES
// ==========================================

interface MailboxState {
  mailbox_id: string;
  mailbox_address: string;
  delta_link: string | null;
  enabled: number;
}

// ==========================================
// HELPERS
// ==========================================

function contentHash(email: GraphEmail): string {
  // Use internetMessageId (RFC 2822 Message-ID) for cross-mailbox dedup:
  // the same email CC'd or forwarded to multiple mailboxes shares one
  // internetMessageId, so this hash will be identical regardless of which
  // mailbox received the message or when (receivedDateTime varies per-mailbox).
  const input = email.internetMessageId
    ? `mid:${email.internetMessageId}`
    : `fallback:${email.from.emailAddress.address}|${email.subject}|${email.receivedDateTime}`;
  return createHash("sha256").update(input).digest("hex");
}

function extractDomain(address: string): string {
  const match = address.match(/@([^>\s]+)/);
  return match ? match[1].toLowerCase() : "";
}

function determineTier(
  score: number,
  quiet: boolean
): "urgent" | "important" | "low" | "skipped" {
  if (score <= 0) return "skipped";
  if (score >= 9) return "urgent"; // Always urgent, even during quiet hours
  if (score >= 7 && !quiet) return "urgent";
  if (score >= 7 && quiet) return "important"; // Queued during quiet hours
  if (score >= 5) return "important";
  return "low";
}

// ==========================================
// MAIN TASK
// ==========================================

export const inboxMonitor = schedules.task({
  id: "inbox-monitor",
  cron: "*/5 * * * *",
  machine: { preset: "small-1x" },
  // Prevent overlapping runs: if a poll takes >5min the next cron tick is
  // skipped rather than spawning a parallel instance that would cause dedup
  // races and duplicate Teams notifications.
  queue: { concurrencyLimit: 1 },
  run: async () => {
    const startTime = Date.now();
    const quiet = isQuietHours();
    let totalProcessed = 0;
    let totalNew = 0;
    let totalErrors = 0;

    // Load monitoring rules once for entire poll run
    try {
      await loadRules();
    } catch (error) {
      logger.error("Failed to load rules, continuing with LLM-only scoring", {
        error,
      });
    }

    // Parse monitored mailboxes from env
    const mailboxEnv = process.env.MONITORED_MAILBOXES || "";
    const mailboxAddresses = mailboxEnv
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    if (mailboxAddresses.length === 0) {
      logger.warn("No MONITORED_MAILBOXES configured");
      clearRulesCache();
      return { processed: 0, error: "No mailboxes configured" };
    }

    // Load mailbox state from DB
    const existingStates = await query<MailboxState[]>(
      "SELECT mailbox_id, mailbox_address, delta_link, enabled FROM email_monitor_state WHERE mailbox_address IN (?)",
      [mailboxAddresses]
    );

    const stateMap = new Map(
      existingStates.map((s) => [s.mailbox_address, s])
    );

    // Fetch open To-Do tasks once per poll run (shared across all mailboxes)
    let openTasks: TodoTask[] = [];
    try {
      const todoUserId = process.env.TODO_USER_ID || "";
      if (todoUserId) {
        openTasks = await getOpenTasks(todoUserId);
      }
    } catch (error) {
      logger.warn("Failed to fetch To-Do tasks, continuing without", {
        error,
      });
    }

    // Process each mailbox with error isolation
    for (const address of mailboxAddresses) {
      try {
        const state = stateMap.get(address);

        // Skip disabled mailboxes
        if (state && !state.enabled) {
          logger.info(`Skipping disabled mailbox: ${address}`);
          continue;
        }

        const mailboxId = state?.mailbox_id || address;
        const deltaLink = state?.delta_link ?? null;

        // Ensure state row exists
        if (!state) {
          await query(
            `INSERT IGNORE INTO email_monitor_state (mailbox_id, mailbox_address, enabled)
             VALUES (?, ?, 1)`,
            [address, address]
          );
        }

        // Fetch new emails via Graph delta query
        let fetchResult: { emails: GraphEmail[]; newDeltaLink: string | null };
        try {
          fetchResult = await fetchNewEmails(mailboxId, deltaLink);
        } catch (error: unknown) {
          const errMsg =
            error instanceof Error ? error.message : String(error);

          // Handle 404/403: mailbox deleted or access revoked
          if (errMsg.includes("404") || errMsg.includes("403")) {
            logger.error(
              `Mailbox ${address} returned ${errMsg.includes("404") ? "404" : "403"} — disabling`,
              { address }
            );
            await query(
              "UPDATE email_monitor_state SET enabled = 0, error_count = error_count + 1 WHERE mailbox_address = ?",
              [address]
            );
            totalErrors++;
            continue;
          }
          throw error; // Re-throw other errors
        }

        const { emails, newDeltaLink } = fetchResult;

        if (emails.length === 0) {
          // No new emails — update heartbeat
          await query(
            `UPDATE email_monitor_state
             SET last_poll_at = NOW(), last_success_at = NOW(), delta_link = ?
             WHERE mailbox_address = ?`,
            [newDeltaLink, address]
          );
          continue;
        }

        // DEDUP: batch check existing email_graph_id and content_hash
        const graphIds = emails.map((e) => e.id);
        const hashes = emails.map((e) => contentHash(e));

        const existingIds = await query<{ email_graph_id: string }[]>(
          "SELECT email_graph_id FROM email_monitor_log WHERE email_graph_id IN (?)",
          [graphIds]
        );
        const existingHashes = await query<{ content_hash: string }[]>(
          "SELECT DISTINCT content_hash FROM email_monitor_log WHERE content_hash IN (?)",
          [hashes]
        );

        const seenIds = new Set(existingIds.map((r) => r.email_graph_id));
        const seenHashes = new Set(
          existingHashes.map((r) => r.content_hash)
        );

        const newEmails = emails.filter((e) => {
          const hash = contentHash(e);
          return !seenIds.has(e.id) && !seenHashes.has(hash);
        });

        if (newEmails.length === 0) {
          await query(
            `UPDATE email_monitor_state
             SET last_poll_at = NOW(), last_success_at = NOW(), delta_link = ?
             WHERE mailbox_address = ?`,
            [newDeltaLink, address]
          );
          continue;
        }

        // Apply rules engine to each new email
        const needsLlm: GraphEmail[] = [];
        const ruledEmails: {
          email: GraphEmail;
          score: number;
          method: "rules" | "llm";
        }[] = [];

        for (const email of newEmails) {
          const fromAddr = email.from.emailAddress.address;
          const ruleResult = applyRules({
            from: fromAddr,
            subject: email.subject,
            bodyPreview: email.bodyPreview,
          });

          if (ruleResult.skipLlm && ruleResult.score !== null) {
            ruledEmails.push({
              email,
              score: ruleResult.score,
              method: "rules",
            });
          } else {
            // VIP (skipLlm=false) or no rule match — both go to LLM
            needsLlm.push(email);
            if (ruleResult.score !== null) {
              // VIP floor — pass it through to the scorer
              (email as any)._rulesScore = ruleResult.score;
            }
          }
        }

        // Context enrichment + LLM scoring for emails that need it
        let llmScoredEmails: ScoredEmail[] = [];
        if (needsLlm.length > 0) {
          // Enrich all emails that need LLM scoring
          const enriched: EnrichedEmail[] = await Promise.all(
            needsLlm.map(async (email) => {
              const fromAddr = email.from.emailAddress.address;
              const context = await enrichEmailContext(
                {
                  from: fromAddr,
                  subject: email.subject,
                  bodyPreview: email.bodyPreview,
                },
                openTasks
              );

              return {
                id: email.id,
                from: fromAddr,
                subject: email.subject,
                bodyPreview: email.bodyPreview,
                hasAttachments: email.hasAttachments,
                webLink: email.webLink,
                context,
                rulesScore: (email as any)._rulesScore ?? undefined,
              };
            })
          );

          llmScoredEmails = await scoreEmails(enriched);
        }

        // Route and log all emails
        const allScored: {
          email: GraphEmail;
          score: number;
          method: "rules" | "llm";
          roMatch?: string;
          taskMatch: boolean;
          reason?: string;
        }[] = [];

        // Add rules-scored emails
        for (const ruled of ruledEmails) {
          allScored.push({
            email: ruled.email,
            score: ruled.score,
            method: ruled.method,
            taskMatch: false,
          });
        }

        // Add LLM-scored emails
        for (const scored of llmScoredEmails) {
          const originalEmail = needsLlm.find((e) => e.id === scored.email.id);
          if (originalEmail) {
            allScored.push({
              email: originalEmail,
              score: scored.score,
              method: scored.scoreMethod,
              roMatch: scored.roMatch,
              taskMatch: !!scored.todoMatch,
              reason: scored.reason,
            });
          }
        }

        // Route by tier + quiet hours, send notifications, insert to log
        for (const item of allScored) {
          const tier = determineTier(item.score, quiet);
          const hash = contentHash(item.email);
          const domain = extractDomain(
            item.email.from.emailAddress.address
          );

          // Insert to processing log
          await query(
            `INSERT INTO email_monitor_log
             (email_graph_id, content_hash, mailbox_id_ref, sender_domain, score,
              score_method, notification_tier, ro_match, task_match, dispatched_at, processed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              item.email.id,
              hash,
              mailboxId,
              domain,
              item.score,
              item.method,
              tier,
              item.roMatch || null,
              item.taskMatch ? 1 : 0,
              tier === "urgent" ? new Date() : null, // Urgent dispatched immediately
            ]
          );

          // Send Teams notification for urgent emails
          if (tier === "urgent") {
            try {
              const llmResult = llmScoredEmails.find(
                (s) => s.email.id === item.email.id
              );

              const emailForCard: ScoredEmailForCard = {
                from: item.email.from.emailAddress.address,
                subject: item.email.subject,
                bodyPreview: item.email.bodyPreview.substring(0, 200),
                score: item.score,
                reason: item.reason || "Matched by rules engine",
                webLink: item.email.webLink,
                receivedDateTime: item.email.receivedDateTime,
              };

              // Build RO context for card if available
              const roCtx = llmResult?.email.context.roMatches[0];
              const roContext = roCtx
                ? {
                    roNumber: String(roCtx.ro ?? ""),
                    shopName: roCtx.shopName ?? "",
                    partDescription: roCtx.partDescription ?? "",
                    status: roCtx.shopStatus ?? "",
                    estimatedCost: roCtx.estimatedCost,
                    finalCost: roCtx.finalCost,
                  }
                : undefined;

              // Build To-Do context for card if available
              const todoCtx = llmResult?.email.context.todoMatches[0];
              const todoContext = todoCtx
                ? { taskTitle: todoCtx.title, dueDate: null }
                : undefined;

              // Build shop context for card if available
              const shopCtx = llmResult?.email.context.shopMatch;
              const shopContext = shopCtx
                ? {
                    businessName: shopCtx.businessName ?? "",
                    contact: shopCtx.contact,
                    paymentTerms: shopCtx.paymentTerms,
                  }
                : undefined;

              const card = buildUrgentCard(
                emailForCard,
                item.score,
                item.reason || "Matched by rules engine",
                roContext,
                todoContext,
                shopContext
              );
              await sendUrgentCard(card);
            } catch (notifyError) {
              // NOTE: Email subject intentionally omitted to avoid PII in logs
              logger.error(
                `Failed to send Teams notification for email ID ${item.email.id}`,
                { error: notifyError }
              );
              // Don't fail the pipeline — notification failure is non-fatal
            }
          }

          totalNew++;
        }

        // Update mailbox state
        await query(
          `UPDATE email_monitor_state
           SET last_poll_at = NOW(), last_success_at = NOW(),
               delta_link = ?,
               emails_processed = emails_processed + ?,
               error_count = 0
           WHERE mailbox_address = ?`,
          [newDeltaLink, newEmails.length, address]
        );

        totalProcessed += newEmails.length;

        logger.info(
          `Processed mailbox ${address}: ${newEmails.length} new emails`,
          {
            ruled: ruledEmails.length,
            llmScored: llmScoredEmails.length,
          }
        );
      } catch (error) {
        totalErrors++;
        logger.error(`Error processing mailbox ${address}`, { error });

        // Increment error count for this mailbox
        await query(
          "UPDATE email_monitor_state SET error_count = error_count + 1, last_poll_at = NOW() WHERE mailbox_address = ?",
          [address]
        ).catch(() => {});
      }
    }

    // Clear rules cache at end of poll run
    clearRulesCache();

    // Ping Healthchecks.io (non-blocking — monitoring should never crash the monitor)
    const healthcheckUrl = process.env.HEALTHCHECKS_IO_URL;
    if (healthcheckUrl) {
      try {
        await fetch(healthcheckUrl, { method: "GET", signal: AbortSignal.timeout(5000) });
      } catch {
        // Monitoring ping failure is non-fatal
      }
    }

    const duration = Date.now() - startTime;

    logger.info("Inbox monitor poll complete", {
      duration: `${duration}ms`,
      processed: totalProcessed,
      newEmails: totalNew,
      errors: totalErrors,
      quietHours: quiet,
    });

    return {
      processed: totalProcessed,
      newEmails: totalNew,
      errors: totalErrors,
      duration,
      quietHours: quiet,
    };
  },
});
