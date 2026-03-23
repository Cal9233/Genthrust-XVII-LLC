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
    const overdue = searchParams.get('overdue') === 'true'

    // Build WHERE conditions
    const conditions: string[] = ['account_name = ?']
    const params: any[] = [companyName]

    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }
    if (overdue) {
      conditions.push('due_date < NOW()')
      conditions.push('open_balance > 0')
    }
    if (search) {
      conditions.push('invoice_no LIKE ?')
      params.push(`%${search}%`)
    }

    const where = conditions.join(' AND ')
    const orderBy = overdue ? 'ORDER BY due_date ASC' : 'ORDER BY erp_modified_at DESC'

    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM invoices WHERE ${where}`,
      [...params]
    )
    const total = countResult[0]?.total ?? 0

    const rows = await query<any[]>(
      `SELECT so_number, account_name, invoice_no, status, total, open_balance, due_date
       FROM invoices
       WHERE ${where}
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return NextResponse.json({ data: rows, total, page, limit })
  } catch (error) {
    console.error('Portal invoices API error:', error)
    return NextResponse.json({ error: 'Failed to load invoices' }, { status: 500 })
  }
}
