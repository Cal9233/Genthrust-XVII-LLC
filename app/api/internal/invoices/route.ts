import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = request.nextUrl.searchParams
    const search = params.get('search') || ''
    const status = params.get('status') || ''
    const page = Math.max(1, parseInt(params.get('page') || '1') || 1)
    const limit = Math.min(parseInt(params.get('limit') || '50') || 50, 200)
    const offset = (page - 1) * limit

    let where = 'WHERE 1=1'
    const values: any[] = []

    if (search) {
      where += ' AND (inv.invoice_no LIKE ? OR inv.account_name LIKE ? OR inv.customer_po LIKE ?)'
      values.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    if (status) {
      where += ' AND inv.status = ?'
      values.push(status)
    }

    const [[{ total }]] = await Promise.all([
      query<any[]>(`SELECT COUNT(*) as total FROM invoices inv ${where}`, values),
    ])

    const rows = await query<any[]>(
      `SELECT inv.id, inv.erp_invoice_id, inv.invoice_no, inv.account_name, inv.contact_name,
              inv.so_number, inv.customer_po, inv.status, inv.due_date, inv.invoice_date,
              inv.total, inv.open_balance, inv.track_no,
              inv.erp_created_at, inv.erp_modified_at,
              COALESCE(lc.line_count, 0) as line_count
       FROM invoices inv
       LEFT JOIN (SELECT invoice_id, COUNT(*) as line_count FROM invoice_lines GROUP BY invoice_id) lc
         ON lc.invoice_id = inv.id
       ${where}
       ORDER BY inv.erp_modified_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    )

    return NextResponse.json({ data: rows, total, page, limit })
  } catch (error) {
    console.error('Invoices API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load invoices' }, { status: 500 })
  }
}
