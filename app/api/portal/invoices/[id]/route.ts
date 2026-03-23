import { NextResponse } from 'next/server'
import { getPortalContext } from '@/lib/portal-auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPortalContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // companyId is the authoritative identity — verified against the companies table
    // by getPortalContext(). companyName is the denormalized value from that same DB
    // lookup, used here because the invoices table has no company_id FK column.
    const { companyId: _companyId, companyName } = ctx
    const { id } = await params

    const rows = await query<any[]>(
      `SELECT id, erp_invoice_id, invoice_no, account_name, contact_name,
              so_number, customer_po, status, due_date, invoice_date,
              ship_via, track_no, subtotal, total_discount, total, open_balance
       FROM invoices WHERE id = ? AND account_name = ?`,
      [id, companyName]
    )

    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const lines = await query<any[]>(
      `SELECT id, line_number, part_name, description, condition_code,
              serial_number, qty, unit_price, uom
       FROM invoice_lines WHERE invoice_id = ? ORDER BY line_number`,
      [id]
    )

    return NextResponse.json({ invoice: rows[0], lines })
  } catch (error) {
    console.error('Portal invoice detail API error:', error)
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 })
  }
}
