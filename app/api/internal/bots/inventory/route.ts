import { NextResponse } from 'next/server'
import { inventoryQuery } from '@/lib/inventory-db'
import { requireInternalSession } from '@/lib/api-auth'
export const dynamic = 'force-dynamic'

async function safeCount(sql: string): Promise<Record<string, any>> {
  try {
    const rows = await inventoryQuery<any[]>(sql)
    return rows[0] || {}
  } catch {
    return {}
  }
}

async function safeQuery(sql: string): Promise<any[]> {
  try {
    return await inventoryQuery<any[]>(sql)
  } catch {
    return []
  }
}

export async function GET() {
  try {
    const auth = await requireInternalSession()
    if (!auth.ok) return auth.response

    const [pendingRow, committedRow, skuRow, conditionRows] = await Promise.all([
      safeCount('SELECT COUNT(*) as pendingDrafts FROM ils_pending_quotes'),
      safeCount('SELECT COALESCE(SUM(committed_qty), 0) as committedStock FROM inventory_committed'),
      safeCount('SELECT COUNT(DISTINCT part_number) as totalSkus FROM inventory'),
      safeQuery('SELECT `condition`, COUNT(*) as count, SUM(quantity) as qty FROM inventory GROUP BY `condition`'),
    ])

    return NextResponse.json({
      pendingDrafts: pendingRow.pendingDrafts || 0,
      committedStock: parseInt(committedRow.committedStock) || 0,
      totalSkus: skuRow.totalSkus || 0,
      conditionBreakdown: conditionRows,
    })
  } catch (error) {
    console.error('Bot inventory API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load inventory data' }, { status: 500 })
  }
}
