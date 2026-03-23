/**
 * TDD RED phase — tests for GET /api/portal/repair-orders
 *
 * Route file does NOT exist yet: app/api/portal/repair-orders/route.ts
 * All tests should FAIL (import error / 404) until the production file is created.
 *
 * Expected response shape:
 *   { data: RepairOrder[], total: number, page: number, limit: number }
 *
 * RepairOrder fields: ro_number, vendor_name, status, priority, due_date, total
 *
 * Auth: getPortalContext() — role must be 'client', companyId must be numeric.
 * Company isolation is enforced by scoping WHERE vendor_name = companyName.
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

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/portal/repair-orders')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new Request(url.toString())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/portal/repair-orders', () => {
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
    const { GET } = await import('@/app/api/portal/repair-orders/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when user role is internal (portal-only endpoint)', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'internal', companyId: 1 } })
    const { GET } = await import('@/app/api/portal/repair-orders/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Default pagination
  // -------------------------------------------------------------------------

  it('returns paginated RO list with default page=1 and limit=20', async () => {
    mockAuth.mockResolvedValue(makeClientSession(2))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Vendor LLC' }])
    mockQuery.mockResolvedValueOnce([{ total: 2 }])
    const rows = [
      { ro_number: 'RO-001', vendor_name: 'Vendor LLC', status: 'open', priority: 'normal', due_date: '2026-04-01', total: 500 },
      { ro_number: 'RO-002', vendor_name: 'Vendor LLC', status: 'in_progress', priority: 'high', due_date: null, total: 1200 },
    ]
    mockQuery.mockResolvedValueOnce(rows)

    const { GET } = await import('@/app/api/portal/repair-orders/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it('returns correct fields: ro_number, vendor_name, status, priority, due_date, total', async () => {
    mockAuth.mockResolvedValue(makeClientSession(2))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Vendor LLC' }])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([
      { ro_number: 'RO-001', vendor_name: 'Vendor LLC', status: 'open', priority: 'normal', due_date: null, total: 500 },
    ])

    const { GET } = await import('@/app/api/portal/repair-orders/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    const item = body.data[0]
    expect(item).toHaveProperty('ro_number')
    expect(item).toHaveProperty('vendor_name')
    expect(item).toHaveProperty('status')
    expect(item).toHaveProperty('priority')
    expect(item).toHaveProperty('due_date')
    expect(item).toHaveProperty('total')
  })

  it('returns only the authenticated company\'s ROs (company isolation)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(7))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Secure Vendor' }])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([
      { ro_number: 'RO-007', vendor_name: 'Secure Vendor', status: 'open', priority: 'low', due_date: null, total: 300 },
    ])

    const { GET } = await import('@/app/api/portal/repair-orders/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    for (const ro of body.data) {
      expect(ro.vendor_name).toBe('Secure Vendor')
    }
    // Count and data queries must be scoped to companyName
    expect(mockQuery.mock.calls[1][1]).toContain('Secure Vendor')
    expect(mockQuery.mock.calls[2][1]).toContain('Secure Vendor')
  })

  it('returns empty array and total=0 for company with no ROs', async () => {
    mockAuth.mockResolvedValue(makeClientSession(3))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Empty Vendor' }])
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/repair-orders/route')
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
    mockAuth.mockResolvedValue(makeClientSession(2))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Vendor LLC' }])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([
      { ro_number: 'RO-001', vendor_name: 'Vendor LLC', status: 'open', priority: 'normal', due_date: null, total: 500 },
    ])

    const { GET } = await import('@/app/api/portal/repair-orders/route')
    const res = await GET(makeRequest({ status: 'open' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    const countSql = mockQuery.mock.calls[1][0] as string
    const dataSql = mockQuery.mock.calls[2][0] as string
    expect(countSql.toLowerCase()).toContain('status')
    expect(dataSql.toLowerCase()).toContain('status')
    expect(mockQuery.mock.calls[1][1]).toContain('open')
    expect(body.data[0].status).toBe('open')
  })

  it('searches by RO number (?search=RO001)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(2))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Vendor LLC' }])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([
      { ro_number: 'RO001', vendor_name: 'Vendor LLC', status: 'open', priority: 'normal', due_date: null, total: 500 },
    ])

    const { GET } = await import('@/app/api/portal/repair-orders/route')
    const res = await GET(makeRequest({ search: 'RO001' }))

    expect(res.status).toBe(200)
    const dataSql = mockQuery.mock.calls[2][0] as string
    expect(dataSql.toLowerCase()).toContain('ro_number')
  })

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  it('supports page param for pagination (page=3, limit=20 → OFFSET 40)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(2))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Vendor LLC' }])
    mockQuery.mockResolvedValueOnce([{ total: 65 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/repair-orders/route')
    const res = await GET(makeRequest({ page: '3' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.page).toBe(3)
    expect(body.total).toBe(65)
    const dataSql = mockQuery.mock.calls[2][0] as string
    expect(dataSql.toUpperCase()).toContain('OFFSET')
  })

  it('returns total count for pagination UI', async () => {
    mockAuth.mockResolvedValue(makeClientSession(2))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Vendor LLC' }])
    mockQuery.mockResolvedValueOnce([{ total: 42 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/repair-orders/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(42)
    expect(mockQuery).toHaveBeenCalledTimes(3) // companies + count + data
  })
})
