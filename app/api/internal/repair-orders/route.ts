import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = request.nextUrl.searchParams
    const search = params.get('search') || ''
    const status = params.get('status') || ''
    const page = parseInt(params.get('page') || '1')
    const limit = Math.min(parseInt(params.get('limit') || '50') || 50, 200)
    const offset = (page - 1) * limit

    let where = 'WHERE 1=1'
    const values: any[] = []

    if (search) {
      where += ' AND (ro.ro_number LIKE ? OR ro.vendor_name LIKE ?)'
      values.push(`%${search}%`, `%${search}%`)
    }
    if (status) {
      where += ' AND ro.status = ?'
      values.push(status)
    }

    const [[{ total }]] = await Promise.all([
      query<any[]>(`SELECT COUNT(*) as total FROM repair_orders ro ${where}`, values),
    ])

    const rows = await query<any[]>(
      `SELECT ro.id, ro.erp_po_id, ro.ro_number, ro.vendor_name, ro.contact_name,
              ro.status, ro.priority, ro.due_date, ro.total,
              ro.erp_created_at, ro.erp_modified_at,
              COALESCE(lc.line_count, 0) as line_count
       FROM repair_orders ro
       LEFT JOIN (SELECT repair_order_id, COUNT(*) as line_count FROM repair_order_lines GROUP BY repair_order_id) lc
         ON lc.repair_order_id = ro.id
       ${where}
       ORDER BY ro.erp_modified_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    )

    return NextResponse.json({ data: rows, total, page, limit })
  } catch (error) {
    console.error('Repair orders API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load repair orders' }, { status: 500 })
  }
}
