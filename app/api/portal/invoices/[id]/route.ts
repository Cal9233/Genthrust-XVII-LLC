import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyName = (session.user as any).companyName
    if (!companyName) {
      return NextResponse.json({ error: 'No company associated' }, { status: 403 })
    }

    const { id } = await params

    const rows = await query<any[]>(
      `SELECT * FROM invoices WHERE id = ? AND account_name = ?`,
      [id, companyName]
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
    console.error('Portal invoice detail API error:', error)
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 })
  }
}
