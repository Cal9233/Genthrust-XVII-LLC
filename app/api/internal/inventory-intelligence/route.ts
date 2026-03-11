import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inventoryQuery } from '@/lib/inventory-db'
import fs from 'fs'
export const dynamic = 'force-dynamic'

async function safeCount(sql: string): Promise<Record<string, any>> {
  try {
    const rows = await inventoryQuery<any[]>(sql)
    return rows[0] || {}
  } catch {
    return {}
  }
}

async function safeQuery(sql: string, params?: any[]): Promise<any[]> {
  try {
    return await inventoryQuery<any[]>(sql, params)
  } catch {
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
      pendingRow,
      committedRow,
      skuRow,
      alertCountRow,
      conditionRows,
      salesVelocity,
      alerts,
    ] = await Promise.all([
      safeCount('SELECT COUNT(*) as pendingDrafts FROM ils_pending_quotes'),
      safeCount('SELECT COALESCE(SUM(committed_qty), 0) as committedStock FROM inventory_committed'),
      safeCount('SELECT COUNT(DISTINCT part_number) as totalSkus FROM inventory'),
      safeCount(`SELECT COUNT(*) as todayAlerts FROM inventory_alerts WHERE DATE(created_at) = CURDATE()`),
      safeQuery('SELECT `condition`, COUNT(*) as count, SUM(quantity) as qty FROM inventory GROUP BY `condition`'),
      safeQuery('SELECT * FROM sales_velocity ORDER BY sold_last_30d DESC LIMIT 20'),
      safeQuery('SELECT * FROM inventory_alerts ORDER BY created_at DESC LIMIT 20'),
    ])

    // Check sync cache freshness
    let syncStatus = { lastSync: 'Unknown', isStale: true }
    try {
      const stat = fs.statSync('C:\\GenthrustBot\\.sync_cache')
      const mtime = stat.mtime
      const hoursAgo = (Date.now() - mtime.getTime()) / (1000 * 60 * 60)
      syncStatus = {
        lastSync: mtime.toISOString(),
        isStale: hoursAgo > 4,
      }
    } catch {
      // sync cache not found
    }

    return NextResponse.json({
      summary: {
        pendingDrafts: pendingRow.pendingDrafts || 0,
        committedStock: parseInt(committedRow.committedStock) || 0,
        totalSkus: skuRow.totalSkus || 0,
        todayAlerts: alertCountRow.todayAlerts || 0,
      },
      conditionBreakdown: conditionRows,
      salesVelocity,
      alerts,
      syncStatus,
    })
  } catch (error) {
    console.error('Inventory Intelligence API error:', error)
    return NextResponse.json({ error: 'Failed to load inventory intelligence data' }, { status: 500 })
  }
}
