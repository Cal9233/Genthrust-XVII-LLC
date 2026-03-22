import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

// GET /api/internal/quotes/export — CSV export
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let where = ''
    const params: any[] = []

    if (status && ['pending', 'processed', 'responded'].includes(status)) {
      where = 'WHERE status = ?'
      params.push(status)
    }

    const quotes = await query<any[]>(
      `SELECT id, email_id, sender_email, sender_name, subject, part_numbers, status, received_at, processed_at
       FROM quote_requests ${where}
       ORDER BY received_at DESC
       LIMIT 5000`,
      params
    )

    // Build CSV
    const header = 'ID,Email ID,Sender Email,Sender Name,Subject,Part Numbers,Status,Received At,Processed At'
    const rows = quotes.map((q: any) => {
      const parts = typeof q.part_numbers === 'string' ? JSON.parse(q.part_numbers) : (q.part_numbers || [])
      return [
        q.id,
        `"${(q.email_id || '').replace(/"/g, '""')}"`,
        `"${(q.sender_email || '').replace(/"/g, '""')}"`,
        `"${(q.sender_name || '').replace(/"/g, '""')}"`,
        `"${(q.subject || '').replace(/"/g, '""')}"`,
        `"${parts.join(';')}"`,
        `"${q.status}"`,
        `"${q.received_at || ''}"`,
        `"${q.processed_at || ''}"`,
      ].join(',')
    })

    const csv = [header, ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="quote-requests-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    console.error('Quote export API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to export quotes' }, { status: 500 })
  }
}
