import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inventoryQuery } from '@/lib/inventory-db'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
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
    const isConnError = error instanceof Error && (
      error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') ||
      error.message.includes('connect timeout') || error.message.includes('Connection lost')
    )
    return NextResponse.json(
      { error: isConnError ? 'Inventory database unavailable' : 'Failed to acknowledge alarm' },
      { status: isConnError ? 503 : 500 }
    )
  }
}
