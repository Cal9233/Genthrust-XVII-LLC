import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if ((session.user as any).role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const companyName = (session.user as any).companyName
    if (!companyName) {
      return NextResponse.json({ error: 'No company associated' }, { status: 403 })
    }

    const { id } = await params

    const [rows, lines] = await Promise.all([
      query<any[]>(
        `SELECT id, erp_po_id, ro_number, vendor_name, contact_name,
                status, priority, due_date, ship_via, ship_account,
                term_sale, total
         FROM repair_orders WHERE id = ? AND vendor_name = ?`,
        [id, companyName]
      ),
      query<any[]>(
        `SELECT id, line_number, part_name, description, condition_code,
                serial_number, qty, qty_received, qty_delivered, unit_price, uom
         FROM repair_order_lines WHERE repair_order_id = ? ORDER BY line_number`,
        [id]
      ),
    ])

    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ order: rows[0], lines })
  } catch (error) {
    console.error('Portal RO detail API error:', error)
    return NextResponse.json({ error: 'Failed to load repair order' }, { status: 500 })
  }
}
