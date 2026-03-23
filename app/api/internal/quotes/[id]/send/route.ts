import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { generateEmailHtml, sendEmailViaGraph, type TemplateName } from '@/lib/services/quote-email-composer'
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from '@/lib/audit-logger'
export const dynamic = 'force-dynamic'

// POST /api/internal/quotes/:id/send — compose and send email response via Graph API
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

    const accessToken = process.env.M365_GRAPH_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json(
        { error: 'M365 Graph API not configured. Set M365_GRAPH_ACCESS_TOKEN.' },
        { status: 503 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { template, customMessage, customSubject, cc } = body as {
      template: TemplateName
      customMessage?: string
      customSubject?: string
      cc?: string[]
    }

    // Validate template against known values
    const VALID_TEMPLATES: TemplateName[] = ['partFound', 'partNotFound', 'mixedResults', 'custom']
    if (!template || !VALID_TEMPLATES.includes(template)) {
      return NextResponse.json(
        { error: `Invalid template. Must be one of: ${VALID_TEMPLATES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate cc array
    if (cc !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!Array.isArray(cc)) {
        return NextResponse.json({ error: 'cc must be an array' }, { status: 400 })
      }
      if (cc.length > 10) {
        return NextResponse.json({ error: 'Maximum 10 CC recipients allowed' }, { status: 400 })
      }
      for (const addr of cc) {
        if (typeof addr !== 'string' || !emailRegex.test(addr)) {
          return NextResponse.json(
            { error: `Invalid CC email address: ${addr}` },
            { status: 400 }
          )
        }
      }
    }

    // Get the quote
    const quotes = await query<any[]>('SELECT * FROM quote_requests WHERE id = ?', [id])
    if (!quotes.length) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }
    const quote = quotes[0]
    const partNumbers = typeof quote.part_numbers === 'string'
      ? JSON.parse(quote.part_numbers)
      : quote.part_numbers

    // Generate email content
    const templateData: any = {
      senderName: quote.sender_name,
      partNumbers,
    }

    if (template === 'custom') {
      templateData.content = customMessage || ''
      templateData.subject = customSubject || `Re: ${quote.subject}`
    }

    // For partFound/partNotFound/mixedResults, caller should provide parts data
    if (body.foundParts) templateData.parts = body.foundParts
    if (body.foundParts) templateData.foundParts = body.foundParts
    if (body.notFoundParts) templateData.notFoundParts = body.notFoundParts

    const email = generateEmailHtml(template, templateData)

    // Send via Graph API
    await sendEmailViaGraph(accessToken, {
      to: quote.sender_email,
      subject: email.subject,
      body: email.body,
      cc,
    })

    // Record the response
    await query(
      `INSERT INTO quote_responses (quote_id, response_text, sent_at, sent_by)
       VALUES (?, ?, NOW(), ?)`,
      [id, email.body, session.user.email || session.user.name || 'unknown']
    )

    // Update status
    await query(
      `UPDATE quote_requests SET status = 'responded', processed_at = COALESCE(processed_at, NOW()), updated_at = NOW() WHERE id = ?`,
      [id]
    )

    logAuditEvent({
      action: ACTION_TYPES.SEND_EMAIL,
      resource_type: RESOURCE_TYPES.QUOTE,
      resource_id: id,
      user_id: session.user.id,
      user_email: session.user.email ?? null,
      user_role: 'internal',
      success: true,
      status_code: 200,
      metadata: { to: quote.sender_email, subject: email.subject, template },
    }).catch(() => {})

    return NextResponse.json({
      message: 'Email sent successfully',
      email: { to: quote.sender_email, subject: email.subject },
    })
  } catch (error) {
    console.error('Quote send API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
