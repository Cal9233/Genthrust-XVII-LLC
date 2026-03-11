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
      `SELECT * FROM invoices WHERE id = ?`,
      [id]
    )

    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const lines = await query<any[]>(
      `SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY line_number`,
      [id]
    )

    return NextResponse.json({ invoice: rows[0], lines })
  } catch (error) {
    console.error('Internal invoice detail API error:', error)
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 })
  }
}
