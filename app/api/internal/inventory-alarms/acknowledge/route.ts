import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inventoryQuery } from '@/lib/inventory-db'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { alert_id } = body

    if (!alert_id) {
      return NextResponse.json({ error: 'alert_id is required' }, { status: 400 })
    }

    if (typeof alert_id !== 'number' && typeof alert_id !== 'string') {
      return NextResponse.json({ error: 'alert_id must be a number or string' }, { status: 400 })
    }

    const numericId = parseInt(String(alert_id), 10)
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ error: 'alert_id must be a positive integer' }, { status: 400 })
    }

    const acknowledgedBy = (session.user as any).email || (session.user as any).name || 'unknown'

    await inventoryQuery(
      `UPDATE inventory_alerts
       SET acknowledged_at = NOW(), acknowledged_by = ?
       WHERE id = ? AND acknowledged_at IS NULL`,
      [acknowledgedBy, numericId]
    )

    return NextResponse.json({ success: true, alert_id: numericId })
  } catch (error) {
    console.error('Acknowledge alarm error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to acknowledge alarm' }, { status: 500 })
  }
}
