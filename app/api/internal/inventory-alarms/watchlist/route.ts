import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inventoryQuery } from '@/lib/inventory-db'
import { getPartLiveData } from '@/lib/erp-client'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await inventoryQuery<any[]>(
      'SELECT * FROM inventory_watchlist WHERE is_active = 1 ORDER BY updated_at DESC'
    )

    return NextResponse.json({ watchlist: rows })
  } catch (error) {
    console.error('Watchlist GET error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load watchlist' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { part_number, condition_code, description } = body

    if (!part_number || !condition_code) {
      return NextResponse.json({ error: 'part_number and condition_code are required' }, { status: 400 })
    }

    // Input length limits
    const trimmedPn = String(part_number).trim()
    if (trimmedPn.length > 50) {
      return NextResponse.json({ error: 'part_number must be 50 characters or fewer' }, { status: 400 })
    }
    if (description !== undefined && description !== null) {
      const trimmedDesc = String(description).trim()
      if (trimmedDesc.length > 500) {
        return NextResponse.json({ error: 'description must be 500 characters or fewer' }, { status: 400 })
      }
    }

    const validConditions = ['OH', 'AR', 'NE', 'SV']
    if (!validConditions.includes(condition_code.toUpperCase())) {
      return NextResponse.json({ error: 'Invalid condition_code. Must be OH, AR, NE, or SV' }, { status: 400 })
    }

    const trimmedDescription = (description !== undefined && description !== null)
      ? String(description).trim()
      : null

    // Fetch current ERP quantity for this part+condition
    let currentQty = 0
    try {
      const liveData = await getPartLiveData(trimmedPn, condition_code)
      if (liveData.length > 0) {
        currentQty = liveData.reduce((sum, item) => sum + item.quantity, 0)
      }
    } catch {
      // ERP might be unavailable; proceed with qty 0
    }

    const addedBy = (session.user as any).email || (session.user as any).name || 'unknown'

    await inventoryQuery(
      `INSERT INTO inventory_watchlist (part_number, condition_code, description, added_by, last_known_qty, last_checked_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         description = VALUES(description),
         is_active = 1,
         last_known_qty = VALUES(last_known_qty),
         last_checked_at = NOW(),
         updated_at = NOW()`,
      [trimmedPn.toUpperCase(), condition_code.toUpperCase(), trimmedDescription, addedBy, currentQty]
    )

    return NextResponse.json({
      success: true,
      part_number: trimmedPn.toUpperCase(),
      condition_code: condition_code.toUpperCase(),
      last_known_qty: currentQty,
    })
  } catch (error) {
    console.error('Watchlist POST error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await inventoryQuery(
      'UPDATE inventory_watchlist SET is_active = 0, updated_at = NOW() WHERE id = ?',
      [id]
    )

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Watchlist DELETE error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 })
  }
}
