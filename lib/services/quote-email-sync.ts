// Quote Email Sync Service
// Reads from M365 Graph API, parses emails for part numbers, creates QuoteRequests
// Ported from Genthrust_Inventory emailParsingService + microsoftGraphService

import { query } from '@/lib/db'
import { parseEmailForParts } from '@/lib/utils/part-number-extractor'

interface GraphEmail {
  id: string
  subject: string
  from: { emailAddress: { address: string; name: string } }
  receivedDateTime: string
  body: { content: string; contentType: string }
  bodyPreview: string
}

interface SyncResult {
  processed: number
  skipped: number
  errors: number
  details: {
    processed: { id: number; emailId: string }[]
    skipped: { emailId: string; reason: string }[]
    errors: { emailId: string; error: string }[]
  }
}

// Fetch emails from Microsoft Graph API using app-level credentials
async function fetchQuoteEmails(accessToken: string, options: {
  filter?: string
  top?: number
} = {}): Promise<GraphEmail[]> {
  const { filter, top = 50 } = options

  const defaultFilter = "contains(subject, 'quote') or contains(subject, 'pricing') or contains(subject, 'availability')"
  const emailFilter = filter || defaultFilter

  const params = new URLSearchParams({
    $top: String(top),
    $orderby: 'receivedDateTime desc',
    $select: 'id,subject,from,receivedDateTime,body,bodyPreview',
    $filter: emailFilter,
  })

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Graph API error (${response.status}): ${text}`)
  }

  const data = await response.json()
  return data.value as GraphEmail[]
}

// Process a single email into a QuoteRequest
async function processEmail(email: GraphEmail): Promise<{ id: number; emailId: string } | null> {
  // Check for duplicate
  const existing = await query<any[]>(
    'SELECT id FROM quote_requests WHERE email_id = ?',
    [email.id]
  )
  if (existing.length > 0) return null

  // Extract part numbers
  const partNumbers = parseEmailForParts({
    subject: email.subject,
    body: { content: email.body?.content },
  })

  if (partNumbers.length === 0) return null

  const result = await query<any>(
    `INSERT INTO quote_requests (email_id, sender_email, sender_name, subject, body, part_numbers, status, received_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      email.id,
      email.from?.emailAddress?.address || '',
      email.from?.emailAddress?.name || '',
      email.subject || 'No Subject',
      email.body?.content || '',
      JSON.stringify(partNumbers),
      email.receivedDateTime ? new Date(email.receivedDateTime) : new Date(),
    ]
  )

  return { id: result.insertId, emailId: email.id }
}

// Main sync function
export async function syncQuoteEmails(accessToken: string, options?: {
  filter?: string
  top?: number
}): Promise<SyncResult> {
  const emails = await fetchQuoteEmails(accessToken, options)

  const result: SyncResult = {
    processed: 0,
    skipped: 0,
    errors: 0,
    details: { processed: [], skipped: [], errors: [] },
  }

  for (const email of emails) {
    try {
      const created = await processEmail(email)
      if (created) {
        result.processed++
        result.details.processed.push(created)
      } else {
        result.skipped++
        result.details.skipped.push({
          emailId: email.id,
          reason: 'Duplicate or no part numbers found',
        })
      }
    } catch (error) {
      result.errors++
      result.details.errors.push({
        emailId: email.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
}
