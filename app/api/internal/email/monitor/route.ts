import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface MailboxRow {
  mailbox_id: string
  mailbox_address: string
  last_poll_at: string | null
  last_success_at: string | null
  emails_processed: number
  error_count: number
  enabled: number
}

interface TodayStatsRow {
  total: number
  avg_score: number | null
  extreme_count: number
  urgent_count: number
  important_count: number
  low_count: number
}

interface UrgentRow {
  sender_domain: string | null
  score: number
  ro_match: string | null
  processed_at: string
}

async function safeQuery<T>(sql: string, params?: any[]): Promise<T | null> {
  try {
    return await query<T>(sql, params)
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [mailboxRows, todayRows, urgentRows] = await Promise.all([
      // Per-mailbox health — explicitly exclude delta_link
      safeQuery<MailboxRow[]>(
        `SELECT
          mailbox_id,
          mailbox_address,
          last_poll_at,
          last_success_at,
          emails_processed,
          error_count,
          enabled
        FROM email_monitor_state
        ORDER BY mailbox_address ASC`
      ),

      // Today's aggregate stats (rolling 24h) — 4 score bands for distribution chart
      safeQuery<TodayStatsRow[]>(
        `SELECT
          COUNT(*) as total,
          AVG(score) as avg_score,
          SUM(CASE WHEN score >= 9 THEN 1 ELSE 0 END) as extreme_count,
          SUM(CASE WHEN score BETWEEN 7 AND 8 THEN 1 ELSE 0 END) as urgent_count,
          SUM(CASE WHEN score BETWEEN 5 AND 6 THEN 1 ELSE 0 END) as important_count,
          SUM(CASE WHEN score <= 4 THEN 1 ELSE 0 END) as low_count
        FROM email_monitor_log
        WHERE processed_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
      ),

      // Last 5 urgent notifications — never expose email content, only metadata
      safeQuery<UrgentRow[]>(
        `SELECT
          sender_domain,
          score,
          ro_match,
          processed_at
        FROM email_monitor_log
        WHERE notification_tier = 'urgent'
        ORDER BY processed_at DESC
        LIMIT 5`
      ),
    ])

    // Compute overall monitor health from the most recent poll across all mailboxes
    const mailboxes = mailboxRows ?? []
    const lastPollAts = mailboxes
      .filter((m) => m.last_poll_at != null)
      .map((m) => new Date(m.last_poll_at!).getTime())
    const mostRecentPoll = lastPollAts.length > 0 ? Math.max(...lastPollAts) : null

    const stats = todayRows?.[0] ?? null
    const recentUrgent = urgentRows ?? []

    return NextResponse.json({
      monitorHealth: {
        lastPollAt: mostRecentPoll ? new Date(mostRecentPoll).toISOString() : null,
        activeMailboxes: mailboxes.filter((m) => m.enabled).length,
        totalMailboxes: mailboxes.length,
      },
      mailboxes: mailboxes.map((m) => ({
        mailboxId: m.mailbox_id,
        address: m.mailbox_address,
        lastPollAt: m.last_poll_at,
        lastSuccessAt: m.last_success_at,
        emailsProcessed: m.emails_processed,
        errorCount: m.error_count,
        enabled: Boolean(m.enabled),
      })),
      todayStats: {
        total: Number(stats?.total ?? 0),
        avgScore: stats?.avg_score != null ? Math.round(Number(stats.avg_score) * 10) / 10 : null,
        extremeCount: Number(stats?.extreme_count ?? 0),   // score 9-10
        urgentCount: Number(stats?.urgent_count ?? 0),     // score 7-8
        importantCount: Number(stats?.important_count ?? 0), // score 5-6
        lowCount: Number(stats?.low_count ?? 0),           // score 1-4
      },
      recentUrgent: recentUrgent.map((r) => ({
        senderDomain: r.sender_domain,
        score: r.score,
        roMatch: r.ro_match,
        processedAt: r.processed_at,
      })),
    })
  } catch (error) {
    console.error(
      'Email monitor API error:',
      error instanceof Error ? { message: error.message, stack: error.stack } : error
    )
    return NextResponse.json({ error: 'Failed to load email monitor data' }, { status: 500 })
  }
}
