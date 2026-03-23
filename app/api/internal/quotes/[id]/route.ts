import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

// GET /api/internal/quotes/:id — single quote with responses
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const [quotes, responses] = await Promise.all([
      query<any[]>(
        `SELECT * FROM quote_requests WHERE id = ?`,
        [id]
      ),
      query<any[]>(
        `SELECT * FROM quote_responses WHERE quote_id = ? ORDER BY created_at DESC`,
        [id]
      ),
    ])

    if (!quotes.length) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]
    quote.part_numbers = typeof quote.part_numbers === 'string'
      ? JSON.parse(quote.part_numbers)
      : quote.part_numbers

    return NextResponse.json({ quote, responses })
  } catch (error) {
    console.error('Quote detail API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load quote' }, { status: 500 })
  }
}

// PATCH /api/internal/quotes/:id — update status
export async function PATCH(
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
    const { status } = await request.json()

    const validStatuses = ['pending', 'processed', 'responded']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    if (status === 'processed' || status === 'responded') {
      await query(
        `UPDATE quote_requests SET status = ?, processed_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [status, id]
      )
    } else {
      await query(
        `UPDATE quote_requests SET status = ?, updated_at = NOW() WHERE id = ?`,
        [status, id]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Quote update API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
  }
}
