import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'

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
      `SELECT * FROM repair_orders WHERE id = ?`,
      [id]
    )

    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const lines = await query<any[]>(
      `SELECT * FROM repair_order_lines WHERE repair_order_id = ? ORDER BY line_number`,
      [id]
    )

    return NextResponse.json({ order: rows[0], lines })
  } catch (error) {
    console.error('Internal RO detail API error:', error)
    return NextResponse.json({ error: 'Failed to load repair order' }, { status: 500 })
  }
}
