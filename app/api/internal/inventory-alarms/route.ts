import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inventoryQuery } from '@/lib/inventory-db'
export const dynamic = 'force-dynamic'

async function safeCount(sql: string, params?: any[]): Promise<Record<string, any>> {
  try {
    const rows = await inventoryQuery<any[]>(sql, params)
    return rows[0] || {}
  } catch (error) {
    console.error('[inventory-alarms] safeCount failed:', sql, error)
    return {}
  }
}

async function safeQuery(sql: string, params?: any[]): Promise<any[]> {
  try {
    return await inventoryQuery<any[]>(sql, params)
  } catch (error) {
    console.error('[inventory-alarms] safeQuery failed:', sql, error)
    return []
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [
      watchedRow,
      alarmRow,
      ohRow,
      arRow,
      recentAlarms,
      watchlist,
    ] = await Promise.all([
      safeCount('SELECT COUNT(*) as cnt FROM inventory_watchlist WHERE is_active = 1'),
      safeCount(`SELECT COUNT(*) as cnt FROM inventory_alerts WHERE alert_type LIKE 'WATCHLIST_%' AND acknowledged_at IS NULL`),
      safeCount(`SELECT COUNT(*) as cnt FROM inventory_watchlist WHERE is_active = 1 AND condition_code = 'OH'`),
      safeCount(`SELECT COUNT(*) as cnt FROM inventory_watchlist WHERE is_active = 1 AND condition_code = 'AR'`),
      safeQuery(`
        SELECT ia.*, iw.description as watch_description
        FROM inventory_alerts ia
        LEFT JOIN inventory_watchlist iw ON ia.part_number = iw.part_number
        WHERE ia.alert_type LIKE 'WATCHLIST_%'
        ORDER BY ia.created_at DESC
        LIMIT 50
      `),
      safeQuery(`
        SELECT * FROM inventory_watchlist
        WHERE is_active = 1
        ORDER BY updated_at DESC
      `),
    ])

    return NextResponse.json({
      summary: {
        watchedParts: parseInt(watchedRow.cnt) || 0,
        activeAlarms: parseInt(alarmRow.cnt) || 0,
        ohWatched: parseInt(ohRow.cnt) || 0,
        arWatched: parseInt(arRow.cnt) || 0,
      },
      recentAlarms,
      watchlist,
    })
  } catch (error) {
    console.error('Inventory Alarms API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load alarm data' }, { status: 500 })
  }
}
