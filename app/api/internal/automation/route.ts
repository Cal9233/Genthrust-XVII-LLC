import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function safeCount(sql: string, params?: any[]): Promise<Record<string, any>> {
  try {
    const rows = await query<any[]>(sql, params)
    return rows[0] || {}
  } catch (error) {
    console.error('Automation aggregate query failed:', error instanceof Error ? error.message : String(error))
    return {}
  }
}

async function safeQuery<T>(sql: string, params?: any[]): Promise<T[]> {
  try {
    return await query<T[]>(sql, params)
  } catch (error) {
    console.error('Automation aggregate query failed:', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function GET() {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString().slice(0, 19).replace('T', ' ')

    // 7 days from now for due-soon threshold
    const sevenDaysOut = new Date()
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)
    const sevenDaysIso = sevenDaysOut.toISOString().slice(0, 10)

    const [
      emailTodayRow,
      emailQueueRow,
      emailMonitorRow,
      syncStatusRow,
      partsCountRow,
      overdueRow,
      dueSoonRow,
    ] = await Promise.all([
      // Emails processed in the last 24 hours across all mailboxes
      safeCount(
        `SELECT COALESCE(SUM(emails_processed), 0) as processed_today
         FROM email_monitor_state
         WHERE last_success_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
      ),

      // Queued / pending emails (notifications not yet sent)
      safeCount(
        `SELECT COUNT(*) as queued_count
         FROM email_monitor_log
         WHERE processed_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
           AND notification_tier IS NOT NULL`
      ),

      // Most recent poll info + status from email_monitor_state
      safeCount(
        `SELECT
           MAX(last_poll_at) as last_run,
           SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as active_count,
           SUM(error_count) as total_errors
         FROM email_monitor_state`
      ),

      // ERP sync: last sync timestamp from parts (erp_modified_at most recent row)
      safeCount(
        `SELECT MAX(erp_modified_at) as last_sync FROM parts`
      ),

      // Total synced parts
      safeCount(
        `SELECT COUNT(*) as parts_count FROM parts`
      ),

      // Overdue repair orders
      safeCount(
        `SELECT COUNT(*) as count
         FROM repair_orders
         WHERE due_date < CURDATE()
           AND status NOT IN ('Closed', 'Cancelled', 'Completed')`
      ),

      // Due within 7 days
      safeCount(
        `SELECT COUNT(*) as count
         FROM repair_orders
         WHERE due_date BETWEEN CURDATE() AND ?
           AND status NOT IN ('Closed', 'Cancelled', 'Completed')`,
        [sevenDaysIso]
      ),
    ])

    // Derive email monitor status
    const lastRun: string | null = emailMonitorRow.last_run ?? null
    const activeMailboxes = Number(emailMonitorRow.active_count ?? 0)
    const totalErrors = Number(emailMonitorRow.total_errors ?? 0)

    let emailStatus: 'active' | 'idle' | 'error' = 'idle'
    if (totalErrors > 0) {
      emailStatus = 'error'
    } else if (activeMailboxes > 0 && lastRun) {
      const lastRunMs = new Date(lastRun).getTime()
      const fifteenMinutes = 15 * 60 * 1000
      emailStatus = Date.now() - lastRunMs < fifteenMinutes ? 'active' : 'idle'
    }

    // Derive ERP sync status
    const lastSync: string | null = syncStatusRow.last_sync ?? null
    let syncStatus: 'synced' | 'stale' | 'error' = 'error'
    if (lastSync) {
      const lastSyncMs = new Date(lastSync).getTime()
      const oneDayMs = 24 * 60 * 60 * 1000
      syncStatus = Date.now() - lastSyncMs < oneDayMs ? 'synced' : 'stale'
    }

    return NextResponse.json({
      emailMonitor: {
        lastRun,
        processedToday: Number(emailTodayRow.processed_today ?? 0),
        queuedCount: Number(emailQueueRow.queued_count ?? 0),
        status: emailStatus,
      },
      syncStatus: {
        lastSync,
        partsCount: Number(partsCountRow.parts_count ?? 0),
        status: syncStatus,
      },
      overdue: {
        count: Number(overdueRow.count ?? 0),
        dueSoonCount: Number(dueSoonRow.count ?? 0),
      },
    })
  } catch (error) {
    console.error(
      'Automation aggregate API error:',
      error instanceof Error ? { message: error.message, stack: error.stack } : error
    )
    return NextResponse.json({ error: 'Failed to load automation data' }, { status: 500 })
  }
}
