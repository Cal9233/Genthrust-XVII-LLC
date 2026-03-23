import { NextResponse } from 'next/server'
import { getPortalContext } from '@/lib/portal-auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPortalContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { companyId } = ctx
    const { id } = await params

    // Scope by company_id to prevent IDOR
    const rows = await query<any[]>(
      `SELECT id, company_id, company_name, contact_email, status, notes, created_at
       FROM quotes
       WHERE id = ? AND company_id = ?`,
      [id, companyId]
    )

    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const lineItems = await query<any[]>(
      `SELECT id, quote_id, part_number, quantity
       FROM quote_line_items
       WHERE quote_id = ?
       ORDER BY id`,
      [id]
    )

    return NextResponse.json({ quote: rows[0], lineItems })
  } catch (error) {
    console.error('Portal quote detail API error:', error)
    return NextResponse.json({ error: 'Failed to load quote' }, { status: 500 })
  }
}
