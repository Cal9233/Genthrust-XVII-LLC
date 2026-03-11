import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const search = params.get('search') || ''
    const status = params.get('status') || ''
    const page = parseInt(params.get('page') || '1')
    const limit = parseInt(params.get('limit') || '50')
    const offset = (page - 1) * limit

    let where = 'WHERE 1=1'
    const values: any[] = []

    if (search) {
      where += ' AND (so.so_number LIKE ? OR so.customer_name LIKE ? OR so.customer_po LIKE ?)'
      values.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    if (status) {
      where += ' AND so.status = ?'
      values.push(status)
    }

    const [[{ total }]] = await Promise.all([
      query<any[]>(`SELECT COUNT(*) as total FROM sales_orders so ${where}`, values),
    ])

    const rows = await query<any[]>(
      `SELECT so.id, so.erp_so_id, so.so_number, so.customer_po, so.customer_name,
              so.contact_name, so.status, so.priority, so.due_date, so.total, so.track_no,
              so.erp_created_at, so.erp_modified_at,
              (SELECT COUNT(*) FROM sales_order_lines WHERE sales_order_id = so.id) as line_count
       FROM sales_orders so
       ${where}
       ORDER BY so.erp_modified_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    )

    return NextResponse.json({ data: rows, total, page, limit })
  } catch (error) {
    console.error('Sales orders API error:', error)
    return NextResponse.json({ error: 'Failed to load sales orders' }, { status: 500 })
  }
}
