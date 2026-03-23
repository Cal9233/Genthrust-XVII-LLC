import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

const CreateQuoteSchema = z.object({
  senderEmail: z.string().email().max(255),
  senderName: z.string().max(255).optional().default(''),
  subject: z.string().min(1).max(500),
  bodyText: z.string().max(50000).optional().default(''),
  partNumbers: z.array(z.string().max(100)).max(100).optional().default([]),
})

// GET /api/internal/quotes — list with search/filter/pagination
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    let where = 'WHERE 1=1'
    const params: any[] = []

    if (status && ['pending', 'processed', 'responded'].includes(status)) {
      where += ' AND qr.status = ?'
      params.push(status)
    }

    if (search) {
      where += ' AND (qr.subject LIKE ? OR qr.sender_email LIKE ? OR qr.sender_name LIKE ? OR JSON_SEARCH(qr.part_numbers, "one", ?) IS NOT NULL)'
      const like = `%${search}%`
      params.push(like, like, like, search.toUpperCase())
    }

    const [quotes, countRow, statsRows] = await Promise.all([
      query<any[]>(
        `SELECT qr.id, qr.email_id, qr.sender_email, qr.sender_name, qr.subject,
                qr.part_numbers, qr.status, qr.received_at, qr.processed_at,
                qr.created_at, qr.updated_at
         FROM quote_requests qr
         ${where}
         ORDER BY qr.received_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      query<any[]>(
        `SELECT COUNT(*) as total FROM quote_requests qr ${where}`,
        params
      ),
      query<any[]>(
        `SELECT status, COUNT(*) as cnt FROM quote_requests GROUP BY status`
      ),
    ])

    // Parse JSON part_numbers — guard against malformed stored values
    const parsed = quotes.map((q: any) => {
      let part_numbers: string[] = []
      if (typeof q.part_numbers === 'string') {
        try {
          const v = JSON.parse(q.part_numbers)
          part_numbers = Array.isArray(v) ? v : []
        } catch {
          part_numbers = []
        }
      } else if (Array.isArray(q.part_numbers)) {
        part_numbers = q.part_numbers
      }
      return { ...q, part_numbers }
    })

    const stats: Record<string, number> = { pending: 0, processed: 0, responded: 0 }
    for (const row of statsRows) {
      stats[row.status] = parseInt(row.cnt)
    }

    return NextResponse.json({
      quotes: parsed,
      stats,
      pagination: { limit, offset, total: countRow[0]?.total || 0 },
    })
  } catch (error) {
    console.error('Quotes list API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load quotes' }, { status: 500 })
  }
}

// POST /api/internal/quotes — manually create a quote request
export async function POST(request: Request) {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateQuoteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { senderEmail, senderName, subject, bodyText, partNumbers } = parsed.data

    const result = await query<any>(
      `INSERT INTO quote_requests (sender_email, sender_name, subject, body, part_numbers, status, received_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        senderEmail,
        senderName,
        subject,
        bodyText,
        JSON.stringify(partNumbers),
      ]
    )

    return NextResponse.json({ id: result.insertId, message: 'Quote request created' }, { status: 201 })
  } catch (error) {
    console.error('Quote create API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 })
  }
}
