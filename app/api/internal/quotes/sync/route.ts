import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { syncQuoteEmails } from '@/lib/services/quote-email-sync'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { filter, top } = body as { filter?: string; top?: number }

    // Validate OData filter — only allow receivedDateTime comparisons
    if (filter !== undefined) {
      const safeFilterPattern = /^receivedDateTime\s+(ge|le|gt|lt)\s+'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z'(\s+and\s+receivedDateTime\s+(ge|le|gt|lt)\s+'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z')?$/
      if (typeof filter !== 'string' || !safeFilterPattern.test(filter)) {
        return NextResponse.json(
          { error: 'Invalid filter. Only receivedDateTime comparisons are allowed.' },
          { status: 400 }
        )
      }
    }

    // Validate top — positive integer, max 100
    if (top !== undefined) {
      const topInt = Number(top)
      if (!Number.isInteger(topInt) || topInt < 1 || topInt > 100) {
        return NextResponse.json(
          { error: 'Invalid top. Must be a positive integer <= 100.' },
          { status: 400 }
        )
      }
    }

    // The Graph access token must be provided via env or a stored token
    // In production, this would come from the M365 integration config
    const accessToken = process.env.M365_GRAPH_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json(
        { error: 'M365 Graph API not configured. Set M365_GRAPH_ACCESS_TOKEN.' },
        { status: 503 }
      )
    }

    const result = await syncQuoteEmails(accessToken, { filter, top })

    return NextResponse.json({
      message: 'Email sync completed',
      results: result,
    })
  } catch (error) {
    console.error('Quote sync API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to sync emails' }, { status: 500 })
  }
}
