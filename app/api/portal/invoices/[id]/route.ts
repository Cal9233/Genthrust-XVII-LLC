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
        `SELECT id, erp_invoice_id, invoice_no, account_name, contact_name,
                so_number, customer_po, status, due_date, invoice_date,
                ship_via, track_no, subtotal, total_discount, total, open_balance
         FROM invoices WHERE id = ? AND account_name = ?`,
        [id, companyName]
      ),
      query<any[]>(
        `SELECT id, line_number, part_name, description, condition_code,
                serial_number, qty, unit_price, uom
         FROM invoice_lines WHERE invoice_id = ? ORDER BY line_number`,
        [id]
      ),
    ])

    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ invoice: rows[0], lines })
  } catch (error) {
    console.error('Portal invoice detail API error:', error)
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 })
  }
}
