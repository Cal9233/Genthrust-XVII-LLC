import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

// POST /api/internal/quotes/:id/respond — record a quote response
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { responseText, partNumber, priceQuoted, availability } = body

    // Verify quote exists
    const quotes = await query<any[]>('SELECT id FROM quote_requests WHERE id = ?', [id])
    if (!quotes.length) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const result = await query<any>(
      `INSERT INTO quote_responses (quote_id, response_text, part_number, price_quoted, availability, sent_at, sent_by)
       VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
      [
        id,
        responseText || '',
        partNumber || null,
        priceQuoted || null,
        availability || null,
        session.user.email || session.user.name || 'unknown',
      ]
    )

    // Update quote status to responded
    await query(
      `UPDATE quote_requests SET status = 'responded', processed_at = COALESCE(processed_at, NOW()), updated_at = NOW() WHERE id = ?`,
      [id]
    )

    return NextResponse.json({ id: result.insertId, message: 'Response recorded' }, { status: 201 })
  } catch (error) {
    console.error('Quote respond API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to record response' }, { status: 500 })
  }
}
