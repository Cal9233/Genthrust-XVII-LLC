/**
 * Tests for the quotes internal API family:
 *   GET  /api/internal/quotes           — list with pagination/filters/stats
 *   POST /api/internal/quotes           — manually create a quote request
 *   GET  /api/internal/quotes/[id]      — detail with responses
 *   PATCH /api/internal/quotes/[id]     — update status
 *   POST /api/internal/quotes/[id]/respond — record a response
 *   POST /api/internal/quotes/[id]/send    — send email via Graph API
 *   GET  /api/internal/quotes/export    — CSV export
 *   POST /api/internal/quotes/sync      — sync emails from Graph API
 *
 * Auth: session.user.role must be 'internal' or 'admin'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mock declarations
// ---------------------------------------------------------------------------

const mockAuth = vi.fn()
vi.mock('@/auth', () => ({ auth: mockAuth }))

const mockQuery = vi.fn()
vi.mock('@/lib/db', () => ({
  query: mockQuery,
  safeQuery: vi.fn(),
  safeCount: vi.fn(),
}))

vi.mock('@/lib/audit-logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  ACTION_TYPES: { SEND_EMAIL: 'SEND_EMAIL' },
  RESOURCE_TYPES: { QUOTE: 'QUOTE' },
}))

// Mock email composer so we don't need Graph API credentials in tests
vi.mock('@/lib/services/quote-email-composer', () => ({
  generateEmailHtml: vi.fn().mockReturnValue({ subject: 'Re: test', body: '<p>Reply</p>' }),
  sendEmailViaGraph: vi.fn().mockResolvedValue(undefined),
}))

// Mock quote-email-sync service
vi.mock('@/lib/services/quote-email-sync', () => ({
  syncQuoteEmails: vi.fn().mockResolvedValue({ synced: 2, skipped: 0 }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInternalSession(overrides = {}) {
  return { user: { id: '1', email: 'admin@genthrust.net', role: 'internal', name: 'Admin', ...overrides } }
}

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

// ---------------------------------------------------------------------------
// GET /api/internal/quotes — list
// ---------------------------------------------------------------------------

describe('GET /api/internal/quotes', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/quotes/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/quotes'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'client' } })
    const { GET } = await import('@/app/api/internal/quotes/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/quotes'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with quotes, stats, and pagination for internal role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    // Three parallel queries: quotes, count, stats
    mockQuery.mockResolvedValueOnce([
      { id: 1, sender_email: 'buyer@acme.com', subject: 'RFQ P-001', part_numbers: '["P-001"]', status: 'pending', received_at: new Date() },
    ])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([
      { status: 'pending', cnt: '5' },
      { status: 'processed', cnt: '2' },
    ])

    const { GET } = await import('@/app/api/internal/quotes/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/quotes'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.quotes).toHaveLength(1)
    expect(body.pagination).toBeDefined()
    expect(body.stats).toBeDefined()
    expect(body.stats.pending).toBe(5)
    expect(body.stats.processed).toBe(2)
    expect(body.stats.responded).toBe(0)
  })

  it('parses part_numbers from JSON string', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([
      { id: 1, sender_email: 'x@y.com', subject: 'Test', part_numbers: '["PN-001","PN-002"]', status: 'pending', received_at: new Date() },
    ])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/quotes/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/quotes'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.quotes[0].part_numbers)).toBe(true)
    expect(body.quotes[0].part_numbers).toEqual(['PN-001', 'PN-002'])
  })

  it('handles malformed part_numbers JSON gracefully (returns empty array)', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([
      { id: 1, sender_email: 'x@y.com', subject: 'Bad', part_numbers: 'NOT_JSON', status: 'pending', received_at: new Date() },
    ])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/quotes/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/quotes'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.quotes[0].part_numbers).toEqual([])
  })

  it('filters by status=pending and injects param into queries', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([])
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/quotes/route')
    await GET(makeRequest('http://localhost:3000/api/internal/quotes?status=pending'))

    const quoteParams = mockQuery.mock.calls[0][1]
    expect(quoteParams).toContain('pending')
  })

  it('ignores invalid status values (no filter injected for status=invalid)', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([])
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/quotes/route')
    await GET(makeRequest('http://localhost:3000/api/internal/quotes?status=invalid_status'))

    // Params should not contain 'invalid_status'
    const quoteParams = mockQuery.mock.calls[0][1]
    expect(quoteParams).not.toContain('invalid_status')
  })

  it('filters by search text and uses LIKE params', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([])
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/quotes/route')
    await GET(makeRequest('http://localhost:3000/api/internal/quotes?search=BEARING'))

    const quoteParams = mockQuery.mock.calls[0][1]
    expect(quoteParams).toContain('%BEARING%')
  })

  it('returns 500 when database throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValueOnce(new Error('DB failure'))

    const { GET } = await import('@/app/api/internal/quotes/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/quotes'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to load quotes')
  })
})

// ---------------------------------------------------------------------------
// POST /api/internal/quotes — create
// ---------------------------------------------------------------------------

describe('POST /api/internal/quotes', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/internal/quotes/route')
    const res = await POST(new Request('http://localhost:3000/api/internal/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderEmail: 'a@b.com', subject: 'Test' }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when senderEmail is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/route')
    const res = await POST(new Request('http://localhost:3000/api/internal/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'No email' }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns 400 when senderEmail is not a valid email', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/route')
    const res = await POST(new Request('http://localhost:3000/api/internal/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderEmail: 'not-an-email', subject: 'Test' }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns 400 when subject is empty string', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/route')
    const res = await POST(new Request('http://localhost:3000/api/internal/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderEmail: 'buyer@acme.com', subject: '' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 201 with insertId when quote is created successfully', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce({ insertId: 42 })

    const { POST } = await import('@/app/api/internal/quotes/route')
    const res = await POST(new Request('http://localhost:3000/api/internal/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderEmail: 'buyer@acme.com',
        senderName: 'Buyer',
        subject: 'Quote Request for P-001',
        bodyText: 'Please quote P-001 x 5',
        partNumbers: ['P-001', 'P-002'],
      }),
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(42)
    expect(body.message).toBe('Quote request created')
  })

  it('serializes partNumbers as JSON string in INSERT query', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce({ insertId: 10 })

    const { POST } = await import('@/app/api/internal/quotes/route')
    await POST(new Request('http://localhost:3000/api/internal/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderEmail: 'buyer@acme.com',
        subject: 'Test',
        partNumbers: ['PN-A', 'PN-B'],
      }),
    }))

    const insertParams = mockQuery.mock.calls[0][1]
    const partNumbersArg = insertParams[4]
    expect(typeof partNumbersArg).toBe('string')
    expect(JSON.parse(partNumbersArg)).toEqual(['PN-A', 'PN-B'])
  })
})

// ---------------------------------------------------------------------------
// GET /api/internal/quotes/[id] — detail
// ---------------------------------------------------------------------------

describe('GET /api/internal/quotes/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/quotes/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/quotes/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 when quote does not exist', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    // Both queries run in parallel; quotes returns empty
    mockQuery.mockResolvedValueOnce([])   // quotes
    mockQuery.mockResolvedValueOnce([])   // responses

    const { GET } = await import('@/app/api/internal/quotes/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/quotes/999'), {
      params: Promise.resolve({ id: '999' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Quote not found')
  })

  it('returns quote detail with parsed part_numbers and responses', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const quote = { id: 1, sender_email: 'a@b.com', subject: 'RFQ', part_numbers: '["PN-X"]', status: 'pending' }
    const responses = [
      { id: 100, quote_id: 1, response_text: 'We have it', sent_at: new Date() },
    ]
    mockQuery.mockResolvedValueOnce([quote])
    mockQuery.mockResolvedValueOnce(responses)

    const { GET } = await import('@/app/api/internal/quotes/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/quotes/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.quote.part_numbers).toEqual(['PN-X'])
    expect(body.responses).toHaveLength(1)
  })

  it('returns empty responses array when no responses exist', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 2, subject: 'RFQ2', part_numbers: '[]', status: 'pending' }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/quotes/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/quotes/2'), {
      params: Promise.resolve({ id: '2' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.responses).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/internal/quotes/[id] — status update
// ---------------------------------------------------------------------------

describe('PATCH /api/internal/quotes/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { PATCH } = await import('@/app/api/internal/quotes/[id]/route')
    const res = await PATCH(
      new Request('http://localhost:3000/api/internal/quotes/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processed' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid status value', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { PATCH } = await import('@/app/api/internal/quotes/[id]/route')
    const res = await PATCH(
      new Request('http://localhost:3000/api/internal/quotes/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'bogus' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid status')
  })

  it('returns 200 and updates status to processed', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })

    const { PATCH } = await import('@/app/api/internal/quotes/[id]/route')
    const res = await PATCH(
      new Request('http://localhost:3000/api/internal/quotes/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processed' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 200 and updates status to pending', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })

    const { PATCH } = await import('@/app/api/internal/quotes/[id]/route')
    const res = await PATCH(
      new Request('http://localhost:3000/api/internal/quotes/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(200)
  })

  it('returns 200 and updates status to responded', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })

    const { PATCH } = await import('@/app/api/internal/quotes/[id]/route')
    const res = await PATCH(
      new Request('http://localhost:3000/api/internal/quotes/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'responded' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// POST /api/internal/quotes/[id]/respond — record response
// ---------------------------------------------------------------------------

describe('POST /api/internal/quotes/[id]/respond', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/internal/quotes/[id]/respond/route')
    const res = await POST(
      new Request('http://localhost:3000/api/internal/quotes/1/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseText: 'Available' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 404 when quote does not exist', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([]) // SELECT quote — not found

    const { POST } = await import('@/app/api/internal/quotes/[id]/respond/route')
    const res = await POST(
      new Request('http://localhost:3000/api/internal/quotes/999/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseText: 'Available' }),
      }),
      { params: Promise.resolve({ id: '999' }) }
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Quote not found')
  })

  it('returns 201 and records response when quote exists', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 1 }])       // quote exists check
    mockQuery.mockResolvedValueOnce({ insertId: 55 })   // INSERT response
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 }) // UPDATE status

    const { POST } = await import('@/app/api/internal/quotes/[id]/respond/route')
    const res = await POST(
      new Request('http://localhost:3000/api/internal/quotes/1/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseText: 'Available', partNumber: 'PN-001', priceQuoted: 299.99, availability: 'In stock' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(55)
    expect(body.message).toBe('Response recorded')
  })

  it('sets status to responded on the quote after recording a response', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 1 }])
    mockQuery.mockResolvedValueOnce({ insertId: 66 })
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })

    const { POST } = await import('@/app/api/internal/quotes/[id]/respond/route')
    await POST(
      new Request('http://localhost:3000/api/internal/quotes/1/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseText: 'Confirmed' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )

    // Third call should be the UPDATE status to 'responded'
    const updateSql = mockQuery.mock.calls[2][0] as string
    expect(updateSql).toContain('responded')
  })
})

// ---------------------------------------------------------------------------
// POST /api/internal/quotes/[id]/send — send email via Graph API
// ---------------------------------------------------------------------------

describe('POST /api/internal/quotes/[id]/send', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    process.env.M365_GRAPH_ACCESS_TOKEN = 'test-token'
  })

  afterEach(() => {
    delete process.env.M365_GRAPH_ACCESS_TOKEN
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/internal/quotes/[id]/send/route')
    const res = await POST(
      new Request('http://localhost:3000/api/internal/quotes/1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'partFound' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 503 when M365_GRAPH_ACCESS_TOKEN is not set', async () => {
    delete process.env.M365_GRAPH_ACCESS_TOKEN
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/[id]/send/route')
    const res = await POST(
      new Request('http://localhost:3000/api/internal/quotes/1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'partFound' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain('M365 Graph API not configured')
  })

  it('returns 400 when template is invalid', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/[id]/send/route')
    const res = await POST(
      new Request('http://localhost:3000/api/internal/quotes/1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'unknownTemplate' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid template')
  })

  it('returns 400 when cc is not an array', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/[id]/send/route')
    const res = await POST(
      new Request('http://localhost:3000/api/internal/quotes/1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'partFound', cc: 'notanarray@example.com' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('cc must be an array')
  })

  it('returns 400 when cc has more than 10 recipients', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const cc = Array.from({ length: 11 }, (_, i) => `cc${i}@example.com`)
    const { POST } = await import('@/app/api/internal/quotes/[id]/send/route')
    const res = await POST(
      new Request('http://localhost:3000/api/internal/quotes/1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'partFound', cc }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Maximum 10 CC recipients')
  })

  it('returns 400 when cc contains an invalid email address', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/[id]/send/route')
    const res = await POST(
      new Request('http://localhost:3000/api/internal/quotes/1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'partFound', cc: ['valid@x.com', 'not-an-email'] }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid CC email address')
  })

  it('returns 404 when quote does not exist', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([]) // SELECT quote — not found

    const { POST } = await import('@/app/api/internal/quotes/[id]/send/route')
    const res = await POST(
      new Request('http://localhost:3000/api/internal/quotes/999/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'partFound' }),
      }),
      { params: Promise.resolve({ id: '999' }) }
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Quote not found')
  })

  it('returns 200 and sends email when valid template and quote', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{
      id: 1,
      sender_email: 'buyer@acme.com',
      sender_name: 'Buyer',
      subject: 'RFQ',
      part_numbers: '["PN-001"]',
    }])
    mockQuery.mockResolvedValueOnce({ insertId: 77 }) // INSERT quote_responses
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 }) // UPDATE status

    const { POST } = await import('@/app/api/internal/quotes/[id]/send/route')
    const res = await POST(
      new Request('http://localhost:3000/api/internal/quotes/1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'partFound' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('Email sent successfully')
    expect(body.email.to).toBe('buyer@acme.com')
  })
})

// ---------------------------------------------------------------------------
// GET /api/internal/quotes/export — CSV download
// ---------------------------------------------------------------------------

describe('GET /api/internal/quotes/export', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/quotes/export/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/quotes/export'))
    expect(res.status).toBe(401)
  })

  it('returns CSV content-type on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([
      { id: 1, email_id: 'msg-1', sender_email: 'a@b.com', sender_name: 'Buyer', subject: 'RFQ', part_numbers: '["PN-X"]', status: 'pending', received_at: '2026-01-01', processed_at: null },
    ])

    const { GET } = await import('@/app/api/internal/quotes/export/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/quotes/export'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')
  })

  it('includes Content-Disposition attachment header', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/quotes/export/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/quotes/export'))
    expect(res.status).toBe(200)
    const disposition = res.headers.get('Content-Disposition')
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('quote-requests-')
    expect(disposition).toContain('.csv')
  })

  it('filters by status when ?status=pending is provided', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/quotes/export/route')
    await GET(makeRequest('http://localhost:3000/api/internal/quotes/export?status=pending'))

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain('pending')
  })

  it('does not inject status param for invalid status values', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/quotes/export/route')
    await GET(makeRequest('http://localhost:3000/api/internal/quotes/export?status=deleted'))

    const params = mockQuery.mock.calls[0][1]
    expect(params).not.toContain('deleted')
  })

  it('CSV output contains header row', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/quotes/export/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/quotes/export'))
    const text = await res.text()
    expect(text).toContain('ID,Email ID,Sender Email')
  })

  it('CSV rows escape double-quotes in fields', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{
      id: 1,
      email_id: 'msg-1',
      sender_email: 'a@b.com',
      sender_name: 'Buyer "Jr."',
      subject: 'Test "RFQ"',
      part_numbers: '[]',
      status: 'pending',
      received_at: '2026-01-01',
      processed_at: null,
    }])

    const { GET } = await import('@/app/api/internal/quotes/export/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/quotes/export'))
    const text = await res.text()
    // Double quotes in fields should be escaped as ""
    expect(text).toContain('""Jr.""')
  })
})

// ---------------------------------------------------------------------------
// POST /api/internal/quotes/sync — email sync
// ---------------------------------------------------------------------------

describe('POST /api/internal/quotes/sync', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    process.env.M365_GRAPH_ACCESS_TOKEN = 'test-token'
  })

  afterEach(() => {
    delete process.env.M365_GRAPH_ACCESS_TOKEN
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/internal/quotes/sync/route')
    const res = await POST(new Request('http://localhost:3000/api/internal/quotes/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 503 when M365_GRAPH_ACCESS_TOKEN is not set', async () => {
    delete process.env.M365_GRAPH_ACCESS_TOKEN
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/sync/route')
    const res = await POST(new Request('http://localhost:3000/api/internal/quotes/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain('M365 Graph API not configured')
  })

  it('returns 400 for invalid filter format', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/sync/route')
    const res = await POST(new Request('http://localhost:3000/api/internal/quotes/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: 'subject eq \'evil\'' }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid filter')
  })

  it('accepts valid receivedDateTime filter', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/sync/route')
    const res = await POST(new Request('http://localhost:3000/api/internal/quotes/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: "receivedDateTime ge '2026-01-01T00:00:00Z'" }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('Email sync completed')
  })

  it('returns 400 when top is zero', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/sync/route')
    const res = await POST(new Request('http://localhost:3000/api/internal/quotes/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ top: 0 }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid top')
  })

  it('returns 400 when top exceeds 100', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/sync/route')
    const res = await POST(new Request('http://localhost:3000/api/internal/quotes/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ top: 101 }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid top')
  })

  it('returns 200 with sync results when no filter is provided', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { POST } = await import('@/app/api/internal/quotes/sync/route')
    const res = await POST(new Request('http://localhost:3000/api/internal/quotes/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('Email sync completed')
    expect(body.results).toBeDefined()
  })
})
