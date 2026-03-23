/**
 * TDD RED phase — tests for quote request routes
 *
 * Route files do NOT exist yet:
 *   app/api/portal/quotes/route.ts          (GET list, POST create)
 *   app/api/portal/quotes/[id]/route.ts     (GET detail)
 *
 * All tests should FAIL (import error) until production files are created.
 *
 * GET  /api/portal/quotes        → { data: Quote[], total: number }
 * POST /api/portal/quotes        → { id: number, status: 'pending' }
 * GET  /api/portal/quotes/[id]   → { quote: Quote, lineItems: LineItem[] }
 *
 * POST body shape:
 *   { line_items: Array<{ part_number: string, quantity: number }> }
 *
 * Auth: getPortalContext() — role must be 'client'.
 * Isolation: quotes are bound to company_id from the authenticated context.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @/auth and @/lib/db
// ---------------------------------------------------------------------------

const mockAuth = vi.fn()
vi.mock('@/auth', () => ({
  auth: mockAuth,
}))

const mockQuery = vi.fn()
vi.mock('@/lib/db', () => ({
  query: mockQuery,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClientSession(companyId: number) {
  return {
    user: {
      id: 'user-1',
      email: 'client@example.com',
      role: 'client',
      companyId,
    },
  }
}

function makeRequest(body?: unknown, params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/portal/quotes')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  if (body !== undefined) {
    return new Request(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  return new Request(url.toString())
}

function makeDetailRequest(id: string) {
  return {
    params: Promise.resolve({ id }),
  } as any
}

// ---------------------------------------------------------------------------
// GET /api/portal/quotes — list
// ---------------------------------------------------------------------------

describe('GET /api/portal/quotes', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/portal/quotes/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns pending and responded quotes for the authenticated company', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    const quotes = [
      { id: 1, company_id: 1, company_name: 'ACME Corp', contact_email: 'buyer@acme.com', status: 'pending', created_at: '2026-03-20T10:00:00Z' },
      { id: 2, company_id: 1, company_name: 'ACME Corp', contact_email: 'buyer@acme.com', status: 'responded', created_at: '2026-03-18T08:00:00Z' },
    ]
    mockQuery.mockResolvedValueOnce(quotes)

    const { GET } = await import('@/app/api/portal/quotes/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(2)
  })

  it('returns newest first (ORDER BY created_at DESC)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([
      { id: 5, company_id: 1, company_name: 'ACME Corp', contact_email: 'a@acme.com', status: 'pending', created_at: '2026-03-22T09:00:00Z' },
      { id: 3, company_id: 1, company_name: 'ACME Corp', contact_email: 'a@acme.com', status: 'responded', created_at: '2026-03-20T07:00:00Z' },
    ])

    const { GET } = await import('@/app/api/portal/quotes/route')
    await GET(makeRequest())

    // SQL must contain ORDER BY and DESC
    const dataSql = mockQuery.mock.calls[1][0] as string
    expect(dataSql.toUpperCase()).toContain('ORDER BY')
    expect(dataSql.toUpperCase()).toContain('DESC')
    expect(dataSql.toLowerCase()).toContain('created_at')
  })

  it('scopes list query to authenticated company (company_id isolation)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(9))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Tenant Nine' }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/quotes/route')
    await GET(makeRequest())

    // The data query must be scoped by company_id (numeric) or company_name
    const dataSql = mockQuery.mock.calls[1][0] as string
    const dataParams = mockQuery.mock.calls[1][1] as any[]
    // Either company_id=9 or company_name='Tenant Nine' in the bind params
    const hasIsolation = dataParams.includes(9) || dataParams.includes('Tenant Nine')
    expect(hasIsolation).toBe(true)
    expect(dataSql.toLowerCase()).toMatch(/company_id|company_name/)
  })
})

// ---------------------------------------------------------------------------
// POST /api/portal/quotes — create
// ---------------------------------------------------------------------------

describe('POST /api/portal/quotes', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/portal/quotes/route')
    const res = await POST(makeRequest({ line_items: [{ part_number: 'PN-001', quantity: 1 }] }))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('creates a quote and returns { id, status: "pending" }', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    // INSERT quote → returns insertId
    mockQuery.mockResolvedValueOnce({ insertId: 42 })
    // INSERT line items (may be one call per line or bulk)
    mockQuery.mockResolvedValueOnce({ affectedRows: 2 })

    const { POST } = await import('@/app/api/portal/quotes/route')
    const res = await POST(makeRequest({
      line_items: [
        { part_number: 'PN-001', quantity: 2 },
        { part_number: 'PN-002', quantity: 1 },
      ],
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe(42)
    expect(body.status).toBe('pending')
  })

  it('binds the quote to the authenticated company (no company_id override from body)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(5))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Isolated Co' }])
    mockQuery.mockResolvedValueOnce({ insertId: 10 })
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })

    const { POST } = await import('@/app/api/portal/quotes/route')
    await POST(makeRequest({ line_items: [{ part_number: 'PN-X', quantity: 1 }] }))

    // INSERT quote must bind companyId=5 (from session, not from request body)
    const insertSql = mockQuery.mock.calls[1][0] as string
    const insertParams = mockQuery.mock.calls[1][1] as any[]
    expect(insertSql.toLowerCase()).toContain('insert')
    expect(insertParams).toContain(5)
  })

  it('returns 400 when line_items is missing from body', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])

    const { POST } = await import('@/app/api/portal/quotes/route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when line_items is an empty array', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])

    const { POST } = await import('@/app/api/portal/quotes/route')
    const res = await POST(makeRequest({ line_items: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when a line item is missing part_number', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])

    const { POST } = await import('@/app/api/portal/quotes/route')
    const res = await POST(makeRequest({
      line_items: [{ quantity: 1 }], // missing part_number
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when quantity is negative', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])

    const { POST } = await import('@/app/api/portal/quotes/route')
    const res = await POST(makeRequest({
      line_items: [{ part_number: 'PN-001', quantity: -1 }],
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when quantity is zero', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])

    const { POST } = await import('@/app/api/portal/quotes/route')
    const res = await POST(makeRequest({
      line_items: [{ part_number: 'PN-001', quantity: 0 }],
    }))
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// GET /api/portal/quotes/[id] — detail
// ---------------------------------------------------------------------------

describe('GET /api/portal/quotes/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/portal/quotes/[id]/route')
    const res = await GET({} as any, makeDetailRequest('1'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns full quote with line items for a valid id', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    const quote = {
      id: 1, company_id: 1, company_name: 'ACME Corp', contact_email: 'buyer@acme.com',
      status: 'pending', notes: 'Urgent', created_at: '2026-03-20T10:00:00Z',
    }
    mockQuery.mockResolvedValueOnce([quote])
    const lineItems = [
      { id: 10, quote_id: 1, part_number: 'PN-001', quantity: 2 },
      { id: 11, quote_id: 1, part_number: 'PN-002', quantity: 1 },
    ]
    mockQuery.mockResolvedValueOnce(lineItems)

    const { GET } = await import('@/app/api/portal/quotes/[id]/route')
    const res = await GET({} as any, makeDetailRequest('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.quote).toMatchObject({ id: 1, status: 'pending' })
    expect(body.lineItems).toHaveLength(2)
  })

  it('returns 404 for a non-existent quote id', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([]) // no rows

    const { GET } = await import('@/app/api/portal/quotes/[id]/route')
    const res = await GET({} as any, makeDetailRequest('9999'))
    expect(res.status).toBe(404)
  })

  it('returns 404 for a quote belonging to a different company (IDOR block)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(2)) // company 2
    mockQuery.mockResolvedValueOnce([{ company_name: 'Other Co' }])
    // Route must scope by company; returns empty for quote owned by company 1
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/quotes/[id]/route')
    const res = await GET({} as any, makeDetailRequest('1'))
    expect(res.status).toBe(404)
  })

  it('includes company_name and contact_email on the quote object', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{
      id: 3, company_id: 1, company_name: 'ACME Corp',
      contact_email: 'buyer@acme.com', status: 'responded', created_at: '2026-03-21T00:00:00Z',
    }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/quotes/[id]/route')
    const res = await GET({} as any, makeDetailRequest('3'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.quote).toHaveProperty('company_name')
    expect(body.quote).toHaveProperty('contact_email')
  })
})
