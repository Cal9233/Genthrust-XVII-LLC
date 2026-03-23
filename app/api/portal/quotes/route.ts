import { NextResponse } from 'next/server'
import { getPortalContext } from '@/lib/portal-auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// GET /api/portal/quotes — list all quotes for the authenticated company
// ---------------------------------------------------------------------------

export async function GET(_request: Request) {
  try {
    const ctx = await getPortalContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { companyId, companyName } = ctx

    const rows = await query<any[]>(
      `SELECT id, company_id, company_name, contact_email, status, created_at
       FROM quotes
       WHERE company_id = ?
       ORDER BY created_at DESC`,
      [companyId]
    )

    return NextResponse.json({ data: rows, total: rows.length })
  } catch (error) {
    console.error('Portal quotes list API error:', error)
    return NextResponse.json({ error: 'Failed to load quotes' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/portal/quotes — create a new quote request
// ---------------------------------------------------------------------------

interface LineItemInput {
  part_number: string
  quantity: number
}

export async function POST(request: Request) {
  try {
    const ctx = await getPortalContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { companyId, companyName } = ctx

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Validate line_items
    const lineItems: LineItemInput[] = body?.line_items
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'line_items must be a non-empty array' },
        { status: 400 }
      )
    }

    for (const item of lineItems) {
      if (!item.part_number || typeof item.part_number !== 'string') {
        return NextResponse.json(
          { error: 'Each line item must have a part_number' },
          { status: 400 }
        )
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each line item must have a quantity greater than 0' },
          { status: 400 }
        )
      }
    }

    // Insert the quote header — company_id always comes from session, never body
    const insertResult = await query<{ insertId: number }>(
      `INSERT INTO quotes (company_id, company_name, contact_email, status, created_at)
       VALUES (?, ?, ?, 'pending', NOW())`,
      [companyId, companyName, ctx.userId]
    )

    const quoteId = insertResult.insertId

    // Bulk insert line items
    const placeholders = lineItems.map(() => '(?, ?, ?)').join(', ')
    const lineParams: any[] = []
    for (const item of lineItems) {
      lineParams.push(quoteId, item.part_number, item.quantity)
    }

    await query(
      `INSERT INTO quote_line_items (quote_id, part_number, quantity) VALUES ${placeholders}`,
      lineParams
    )

    return NextResponse.json({ id: quoteId, status: 'pending' }, { status: 201 })
  } catch (error) {
    console.error('Portal quotes create API error:', error)
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 })
  }
}
