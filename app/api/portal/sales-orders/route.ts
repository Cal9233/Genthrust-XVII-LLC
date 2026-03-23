import { NextResponse } from 'next/server'
import { getPortalContext } from '@/lib/portal-auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const ctx = await getPortalContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { companyName } = ctx
    const { searchParams } = new URL(request.url)

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10))
    const offset = (page - 1) * limit
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    // Build WHERE conditions
    const conditions: string[] = ['customer_name = ?']
    const params: any[] = [companyName]

    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }
    if (search) {
      conditions.push('so_number LIKE ?')
      params.push(`%${search}%`)
    }

    const where = conditions.join(' AND ')

    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM sales_orders WHERE ${where}`,
      [...params]
    )
    const total = countResult[0]?.total ?? 0

    const rows = await query<any[]>(
      `SELECT so_number, customer_name, status, total, due_date,
              (SELECT COUNT(*) FROM sales_order_lines WHERE sales_order_id = sales_orders.id) as line_count
       FROM sales_orders
       WHERE ${where}
       ORDER BY erp_modified_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return NextResponse.json({ data: rows, total, page, limit })
  } catch (error) {
    console.error('Portal sales-orders API error:', error)
    return NextResponse.json({ error: 'Failed to load sales orders' }, { status: 500 })
  }
}
