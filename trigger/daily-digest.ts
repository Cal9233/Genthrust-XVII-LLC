/**
 * Daily Digest — 8 AM ET summary of email monitoring activity
 *
 * Trigger.dev v4 scheduled task.
 * Cron: 0 13 * * * (13:00 UTC = 8:00 AM ET during EDT, 8:00 AM during EST)
 *
 * Sends a daily summary Adaptive Card to Teams with:
 *  - Email counts by tier (urgent, important, low)
 *  - Score method breakdown (rules vs LLM)
 *  - Monitoring gap warnings (any mailbox with last_success_at > 15 min ago)
 */

import { schedules, logger } from "@trigger.dev/sdk/v3";
import { query } from "@/lib/db";

// Notification layer (built by integrations-auth-engineer)
import { sendUrgentCard } from "@/lib/services/teams-notifier";
import {
  buildDailyDigestCard,
  type DailyDigestStats,
  type GapWarning,
} from "@/lib/services/adaptive-cards";

// ==========================================
// TYPES
// ==========================================

interface TierCount {
  notification_tier: string;
  count: number;
}

interface MethodCount {
  score_method: string;
  count: number;
}

interface MailboxHealth {
  mailbox_address: string;
  last_success_at: string | null;
  emails_processed: number;
  error_count: number;
  enabled: number;
}

// ==========================================
// MAIN TASK
// ==========================================

export const dailyDigest = schedules.task({
  id: "daily-digest",
  // cron: "0 13 * * *",  // DISABLED — re-enable to resume daily 8 AM ET digest
  machine: { preset: "small-1x" },
  run: async () => {
    // Run all 5 read-only queries in parallel — none depend on each other
    const [tierCounts, methodCounts, mailboxHealth, roMatchCount, todoMatchCount] =
      await Promise.all([
        // Count by tier for last 24 hours
        query<TierCount[]>(
          `SELECT notification_tier, COUNT(*) as count
           FROM email_monitor_log
           WHERE processed_at >= NOW() - INTERVAL 24 HOUR
           GROUP BY notification_tier`
        ),

        // Count by score method for last 24 hours
        query<MethodCount[]>(
          `SELECT score_method, COUNT(*) as count
           FROM email_monitor_log
           WHERE processed_at >= NOW() - INTERVAL 24 HOUR
           GROUP BY score_method`
        ),

        // Mailbox health — any mailbox with last_success_at older than 15 min is a gap
        query<MailboxHealth[]>(
          `SELECT mailbox_address, last_success_at, emails_processed, error_count, enabled
           FROM email_monitor_state`
        ),

        // RO match count for last 24 hours
        query<{ count: number }[]>(
          `SELECT COUNT(*) as count FROM email_monitor_log
           WHERE processed_at >= NOW() - INTERVAL 24 HOUR AND ro_match IS NOT NULL`
        ),

        // To-Do match count for last 24 hours
        query<{ count: number }[]>(
          `SELECT COUNT(*) as count FROM email_monitor_log
           WHERE processed_at >= NOW() - INTERVAL 24 HOUR AND task_match = 1`
        ),
      ]);

    // Detect monitoring gaps
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const gaps: string[] = [];

    for (const mb of mailboxHealth) {
      if (!mb.enabled) {
        gaps.push(`${mb.mailbox_address} (DISABLED)`);
        continue;
      }
      if (!mb.last_success_at) {
        gaps.push(`${mb.mailbox_address} (never polled)`);
        continue;
      }
      const lastSuccess = new Date(mb.last_success_at);
      if (lastSuccess < fifteenMinAgo) {
        const minutesAgo = Math.round(
          (Date.now() - lastSuccess.getTime()) / 60_000
        );
        gaps.push(`${mb.mailbox_address} (last success ${minutesAgo}m ago)`);
      }
    }

    // Build summary object
    const tierMap: Record<string, number> = {};
    for (const tc of tierCounts) {
      tierMap[tc.notification_tier] = tc.count;
    }

    const methodMap: Record<string, number> = {};
    for (const mc of methodCounts) {
      methodMap[mc.score_method] = mc.count;
    }

    const totalProcessed = Object.values(tierMap).reduce((a, b) => a + b, 0);

    // Build stats conforming to DailyDigestStats interface
    const stats: DailyDigestStats = {
      totalProcessed,
      urgent: tierMap["urgent"] || 0,
      important: tierMap["important"] || 0,
      low: tierMap["low"] || 0,
      skipped: tierMap["skipped"] || 0,
      roMatches: roMatchCount[0]?.count || 0,
      todoMatches: todoMatchCount[0]?.count || 0,
    };

    // Build gap warnings conforming to GapWarning interface
    const gapWarnings: GapWarning[] = gaps.map((gapStr) => {
      // Parse the gap string back to structured data
      const mb = mailboxHealth.find(
        (m) => gapStr.startsWith(m.mailbox_address)
      );
      const minutesAgo = mb?.last_success_at
        ? Math.round(
            (Date.now() - new Date(mb.last_success_at).getTime()) / 60_000
          )
        : 0;
      return {
        mailbox: mb?.mailbox_address || gapStr,
        lastSuccessAt: mb?.last_success_at || null,
        gapMinutes: minutesAgo,
      };
    });

    const card = buildDailyDigestCard(stats, gapWarnings);

    try {
      await sendUrgentCard(card);
      logger.info("Daily digest sent", {
        totalProcessed,
        gaps: gaps.length,
      });
    } catch (error) {
      logger.error("Failed to send daily digest", { error });
      return { sent: false, error: "Teams notification failed" };
    }

    return {
      sent: true,
      totalProcessed,
      tiers: tierMap,
      methods: methodMap,
      monitoringGaps: gaps,
    };
  },
});
