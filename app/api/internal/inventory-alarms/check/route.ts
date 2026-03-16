import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inventoryQuery } from '@/lib/inventory-db'
import { getPartLiveData } from '@/lib/erp-client'
export const dynamic = 'force-dynamic'

/**
 * Simple semaphore-based concurrency limiter (no external dependency).
 * Runs up to `limit` async tasks concurrently.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++
      try {
        const value = await fn(items[idx])
        results[idx] = { status: 'fulfilled', value }
      } catch (reason: any) {
        results[idx] = { status: 'rejected', reason }
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

interface CheckResult {
  item: any
  currentQty: number
}

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

    // Parallelize ERP calls with concurrency limit of 5
    const settled = await mapWithConcurrency(watchlist, 5, async (item): Promise<CheckResult> => {
      const liveData = await getPartLiveData(item.part_number, item.condition_code)
      const currentQty = liveData.length > 0
        ? liveData.reduce((sum, d) => sum + d.quantity, 0)
        : 0
      return { item, currentQty }
    })

    let checked = 0
    let alarmsTriggered = 0
    const alarms: { part_number: string; condition_code: string; previous_qty: number; current_qty: number }[] = []

    // Collect alert inserts and watchlist updates for batching
    const alertInserts: any[][] = []
    const watchlistUpdates: { qty: number; id: number }[] = []

    for (const result of settled) {
      if (result.status === 'rejected') {
        console.error('ERP check failed:', result.reason)
        continue
      }

      checked++
      const { item, currentQty } = result.value
      const previousQty = item.last_known_qty || 0

      // Trigger alarm: qty dropped to 0 from a positive value
      if (previousQty > 0 && currentQty === 0) {
        const alertType = item.condition_code === 'OH'
          ? 'WATCHLIST_OH_DEPLETED'
          : item.condition_code === 'AR'
          ? 'WATCHLIST_AR_DEPLETED'
          : `WATCHLIST_${item.condition_code}_DEPLETED`

        const details = `Watched part ${item.part_number} (${item.condition_code}) dropped from ${previousQty} to 0`

        alertInserts.push([alertType, item.part_number, details])
        alarmsTriggered++
        alarms.push({
          part_number: item.part_number,
          condition_code: item.condition_code,
          previous_qty: previousQty,
          current_qty: currentQty,
        })
      }

      watchlistUpdates.push({ qty: currentQty, id: item.id })
    }

    // Batch alert inserts
    if (alertInserts.length > 0) {
      const placeholders = alertInserts.map(() => '(?, ?, ?, NOW())').join(', ')
      const flatParams = alertInserts.flat()
      await inventoryQuery(
        `INSERT INTO inventory_alerts (alert_type, part_number, details, created_at)
         VALUES ${placeholders}`,
        flatParams
      )
    }

    // Batch watchlist updates using CASE statement
    if (watchlistUpdates.length > 0) {
      const ids = watchlistUpdates.map(u => u.id)
      const whenClauses = watchlistUpdates.map(() => 'WHEN id = ? THEN ?').join(' ')
      const whenParams = watchlistUpdates.flatMap(u => [u.id, u.qty])
      await inventoryQuery(
        `UPDATE inventory_watchlist
         SET last_known_qty = CASE ${whenClauses} END,
             last_checked_at = NOW(),
             updated_at = NOW()
         WHERE id IN (${ids.map(() => '?').join(',')})`,
        [...whenParams, ...ids]
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
