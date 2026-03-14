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
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const rows = await query<any[]>(
      `SELECT * FROM sales_orders WHERE id = ?`,
      [id]
    )

    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const lines = await query<any[]>(
      `SELECT * FROM sales_order_lines WHERE sales_order_id = ? ORDER BY line_number`,
      [id]
    )

    return NextResponse.json({ order: rows[0], lines })
  } catch (error) {
    console.error('Internal SO detail API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load sales order' }, { status: 500 })
  }
}
