/**
 * Email Digest — 30-minute batch dispatch for important emails
 *
 * Trigger.dev v4 scheduled task, every 30 minutes.
 * Queries email_monitor_log for undispatched 'important' tier emails,
 * builds a batch Adaptive Card, sends via Teams webhook.
 */

import { schedules, logger } from "@trigger.dev/sdk/v3";
import { query } from "@/lib/db";

// Notification layer (built by integrations-auth-engineer)
import { sendBatchCard } from "@/lib/services/teams-notifier";
import {
  buildBatchCard,
  type ScoredEmailForCard,
} from "@/lib/services/adaptive-cards";

// ==========================================
// TYPES
// ==========================================

interface PendingEmail {
  id: number;
  sender_domain: string | null;
  score: number;
  score_method: "rules" | "llm";
  ro_match: string | null;
  task_match: number;
  processed_at: string;
}

// ==========================================
// MAIN TASK
// ==========================================

export const emailDigest = schedules.task({
  id: "email-digest",
  cron: "*/30 * * * *",
  machine: { preset: "small-1x" },
  run: async () => {
    // Query undispatched important emails — capped at 50 to stay within
    // Teams Adaptive Card payload limits (~28KB). Any overflow will be picked
    // up on the next 30-minute run.
    const pendingEmails = await query<PendingEmail[]>(
      `SELECT id, sender_domain, score, score_method, ro_match, task_match, processed_at
       FROM email_monitor_log
       WHERE notification_tier = 'important' AND dispatched_at IS NULL
       ORDER BY score DESC, processed_at ASC
       LIMIT 50`
    );

    if (pendingEmails.length === 0) {
      logger.info("No pending important emails for digest");
      return { dispatched: 0 };
    }

    logger.info(`Building digest for ${pendingEmails.length} important emails`);

    // Build batch Adaptive Card — map DB records to ScoredEmailForCard shape
    const emailCards: ScoredEmailForCard[] = pendingEmails.map((e) => ({
      from: e.sender_domain || "unknown",
      subject: `Score ${e.score} (${e.score_method})${e.ro_match ? ` — ${e.ro_match}` : ""}`,
      bodyPreview: e.task_match ? "Has matching To-Do task" : "",
      score: e.score,
      reason: `Scored by ${e.score_method}${e.ro_match ? `, matches ${e.ro_match}` : ""}`,
      webLink: "", // Digest emails don't have individual web links
      receivedDateTime: e.processed_at,
    }));

    const card = buildBatchCard(emailCards);

    // Send via Teams webhook
    try {
      await sendBatchCard(card);
    } catch (error) {
      logger.error("Failed to send digest notification", { error });
      // Don't mark as dispatched if send failed
      return { dispatched: 0, error: "Teams notification failed" };
    }

    // Mark all as dispatched
    // H-4: Guard IN (?) against empty arrays — mysql2 throws on IN (())
    const ids = pendingEmails.map((e) => e.id);
    if (ids.length > 0) {
      await query(
        "UPDATE email_monitor_log SET dispatched_at = NOW() WHERE id IN (?)",
        [ids]
      );
    }

    logger.info(`Dispatched digest with ${pendingEmails.length} emails`);

    return { dispatched: pendingEmails.length };
  },
});
