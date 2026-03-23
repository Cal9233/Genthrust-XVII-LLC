/**
 * TDD RED phase — tests for GET /api/portal/sales-orders
 *
 * Route file does NOT exist yet: app/api/portal/sales-orders/route.ts
 * All tests should FAIL (import error / 404) until the production file is created.
 *
 * Expected response shape:
 *   { data: SalesOrder[], total: number, page: number, limit: number }
 *
 * SalesOrder fields: so_number, customer_name, status, total, due_date, line_count
 *
 * Auth: getPortalContext() — role must be 'client', companyId must be numeric.
 * Company isolation is enforced by scoping WHERE customer_name = companyName.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @/auth and @/lib/db — same pattern used across all portal route tests
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

/** Build a minimal NextRequest-like object with URLSearchParams */
function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/portal/sales-orders')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new Request(url.toString())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/portal/sales-orders', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  // -------------------------------------------------------------------------
  // Auth / access control
  // -------------------------------------------------------------------------

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/portal/sales-orders/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when user role is internal (portal-only endpoint)', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'internal', companyId: 1 } })
    const { GET } = await import('@/app/api/portal/sales-orders/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Default pagination (page=1, limit=20)
  // -------------------------------------------------------------------------

  it('returns paginated SO list with default page=1 and limit=20', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    // 1st query: companies lookup (from getPortalContext)
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    // 2nd query: count
    mockQuery.mockResolvedValueOnce([{ total: 3 }])
    // 3rd query: data rows
    const rows = [
      { so_number: 'SO-001', customer_name: 'ACME Corp', status: 'open', total: 1000, due_date: '2026-04-01', line_count: 2 },
      { so_number: 'SO-002', customer_name: 'ACME Corp', status: 'closed', total: 500, due_date: null, line_count: 1 },
      { so_number: 'SO-003', customer_name: 'ACME Corp', status: 'open', total: 750, due_date: '2026-05-01', line_count: 3 },
    ]
    mockQuery.mockResolvedValueOnce(rows)

    const { GET } = await import('@/app/api/portal/sales-orders/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(3)
    expect(body.total).toBe(3)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it('returns correct fields: so_number, customer_name, status, total, due_date, line_count', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([
      { so_number: 'SO-001', customer_name: 'ACME Corp', status: 'open', total: 1000, due_date: '2026-04-01', line_count: 2 },
    ])

    const { GET } = await import('@/app/api/portal/sales-orders/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    const item = body.data[0]
    expect(item).toHaveProperty('so_number')
    expect(item).toHaveProperty('customer_name')
    expect(item).toHaveProperty('status')
    expect(item).toHaveProperty('total')
    expect(item).toHaveProperty('due_date')
    expect(item).toHaveProperty('line_count')
  })

  it('returns only the authenticated company\'s SOs (company isolation)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(5))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Isolated Co' }])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([
      { so_number: 'SO-999', customer_name: 'Isolated Co', status: 'open', total: 200, due_date: null, line_count: 1 },
    ])

    const { GET } = await import('@/app/api/portal/sales-orders/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    // All returned SOs must belong to the authenticated company
    expect(res.status).toBe(200)
    for (const so of body.data) {
      expect(so.customer_name).toBe('Isolated Co')
    }
    // The count and data queries must be scoped to companyName
    const countCall = mockQuery.mock.calls[1]
    const dataCall = mockQuery.mock.calls[2]
    expect(countCall[1]).toContain('Isolated Co')
    expect(dataCall[1]).toContain('Isolated Co')
  })

  it('returns empty array and total=0 for company with no SOs', async () => {
    mockAuth.mockResolvedValue(makeClientSession(2))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Empty Co' }])
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/sales-orders/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.total).toBe(0)
  })

  // -------------------------------------------------------------------------
  // Filters
  // -------------------------------------------------------------------------

  it('filters by status query param (?status=open)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([
      { so_number: 'SO-001', customer_name: 'ACME Corp', status: 'open', total: 1000, due_date: null, line_count: 1 },
    ])

    const { GET } = await import('@/app/api/portal/sales-orders/route')
    const res = await GET(makeRequest({ status: 'open' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    // Both count and data queries must include the status filter
    const countSql = mockQuery.mock.calls[1][0] as string
    const dataSql = mockQuery.mock.calls[2][0] as string
    expect(countSql.toLowerCase()).toContain('status')
    expect(dataSql.toLowerCase()).toContain('status')
    // Param must be bound
    expect(mockQuery.mock.calls[1][1]).toContain('open')
    expect(body.data[0].status).toBe('open')
  })

  it('searches by SO number (?search=SO123)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([
      { so_number: 'SO123', customer_name: 'ACME Corp', status: 'open', total: 500, due_date: null, line_count: 1 },
    ])

    const { GET } = await import('@/app/api/portal/sales-orders/route')
    const res = await GET(makeRequest({ search: 'SO123' }))

    expect(res.status).toBe(200)
    // Data query SQL should reference so_number or LIKE pattern
    const dataSql = mockQuery.mock.calls[2][0] as string
    expect(dataSql.toLowerCase()).toContain('so_number')
  })

  // -------------------------------------------------------------------------
  // Pagination — page param
  // -------------------------------------------------------------------------

  it('supports page param for pagination (page=2, limit=20 → OFFSET 20)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 45 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/sales-orders/route')
    const res = await GET(makeRequest({ page: '2' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.page).toBe(2)
    expect(body.total).toBe(45)
    // Data query must use OFFSET
    const dataSql = mockQuery.mock.calls[2][0] as string
    expect(dataSql.toUpperCase()).toContain('OFFSET')
  })

  it('returns total count for pagination UI', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 57 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/sales-orders/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(57)
    // Count query must be separate from data query
    expect(mockQuery).toHaveBeenCalledTimes(3) // companies + count + data
  })
})
