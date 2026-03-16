import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inventoryQuery } from '@/lib/inventory-db'
import { getPartLiveData } from '@/lib/erp-client'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active watchlist items
    const watchlist = await inventoryQuery<any[]>(
      'SELECT * FROM inventory_watchlist WHERE is_active = 1'
    )

    let checked = 0
    let alarmsTriggered = 0
    const alarms: { part_number: string; condition_code: string; previous_qty: number; current_qty: number }[] = []

    for (const item of watchlist) {
      checked++
      let currentQty = 0

      try {
        const liveData = await getPartLiveData(item.part_number, item.condition_code)
        if (liveData.length > 0) {
          currentQty = liveData.reduce((sum, d) => sum + d.quantity, 0)
        }
      } catch (err) {
        console.error(`ERP check failed for ${item.part_number}:`, err)
        continue
      }

      const previousQty = item.last_known_qty || 0

      // Trigger alarm: qty dropped to 0 from a positive value
      if (previousQty > 0 && currentQty === 0) {
        const alertType = item.condition_code === 'OH'
          ? 'WATCHLIST_OH_DEPLETED'
          : item.condition_code === 'AR'
          ? 'WATCHLIST_AR_DEPLETED'
          : `WATCHLIST_${item.condition_code}_DEPLETED`

        const details = `Watched part ${item.part_number} (${item.condition_code}) dropped from ${previousQty} to 0`

        await inventoryQuery(
          `INSERT INTO inventory_alerts (alert_type, part_number, details, created_at)
           VALUES (?, ?, ?, NOW())`,
          [alertType, item.part_number, details]
        )

        alarmsTriggered++
        alarms.push({
          part_number: item.part_number,
          condition_code: item.condition_code,
          previous_qty: previousQty,
          current_qty: currentQty,
        })
      }

      // Update watchlist with current qty and check timestamp
      await inventoryQuery(
        `UPDATE inventory_watchlist
         SET last_known_qty = ?, last_checked_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [currentQty, item.id]
      )
    }

    return NextResponse.json({
      checked,
      alarms_triggered: alarmsTriggered,
      alarms,
    })
  } catch (error) {
    console.error('Alarm check error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    const isConnError = error instanceof Error && (
      error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') ||
      error.message.includes('connect timeout') || error.message.includes('Connection lost')
    )
    return NextResponse.json(
      { error: isConnError ? 'Inventory database unavailable' : 'Failed to run alarm check' },
      { status: isConnError ? 503 : 500 }
    )
  }
}
