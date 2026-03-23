/**
 * Tests for GET /api/portal/dashboard
 *
 * Uses getPortalContext() internally which calls auth() and query().
 * Both are mocked here.  The route makes 6 parallel query() calls after
 * context is resolved — we queue mock return values accordingly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuth = vi.fn()
vi.mock('@/auth', () => ({ auth: mockAuth }))

const mockQuery = vi.fn()
vi.mock('@/lib/db', () => ({
  query: mockQuery,
  safeQuery: vi.fn(),
  safeCount: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClientSession(companyId = 1) {
  return {
    user: {
      id: '42',
      email: 'client@test.com',
      role: 'client',
      companyId,
    },
  }
}

/**
 * Queue the 7 mock query responses needed by GET /api/portal/dashboard:
 *   1. getPortalContext() -> companies lookup
 *   2. activeSOs count
 *   3. openInvoices + openBalance
 *   4. activeROs count
 *   5. recentSOs list
 *   6. recentInvoices list
 *   7. recentROs list
 */
function queueDashboardResponses(companyName = 'ACME Corp') {
  mockQuery
    .mockResolvedValueOnce([{ company_name: companyName }])           // 1. getPortalContext
    .mockResolvedValueOnce([{ activeSOs: 3 }])                         // 2. activeSOs
    .mockResolvedValueOnce([{ openInvoices: 2, openBalance: '5000.00' }]) // 3. invoices
    .mockResolvedValueOnce([{ activeROs: 1 }])                         // 4. activeROs
    .mockResolvedValueOnce([{ id: 1, so_number: 'SO-001', status: 'Open' }]) // 5. recent SOs
    .mockResolvedValueOnce([{ id: 1, invoice_no: 'INV-001', status: 'Open' }]) // 6. recent invoices
    .mockResolvedValueOnce([{ id: 1, ro_number: 'RO-001', status: 'Open' }])   // 7. recent ROs
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/portal/dashboard', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated (no session)', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/portal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when role is not "client"', async () => {
    mockAuth.mockResolvedValue({
      user: { id: '1', email: 'admin@genthrust.net', role: 'internal', companyId: 1 },
    })
    const { GET } = await import('@/app/api/portal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 401 when companyId is missing from session', async () => {
    mockAuth.mockResolvedValue({
      user: { id: '1', email: 'c@c.com', role: 'client' /* no companyId */ },
    })
    const { GET } = await import('@/app/api/portal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 401 when company is not found in the database', async () => {
    mockAuth.mockResolvedValue(makeClientSession(999))
    mockQuery.mockResolvedValueOnce([]) // getPortalContext returns null
    const { GET } = await import('@/app/api/portal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 200 with dashboard stats for a valid client session', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    queueDashboardResponses('ACME Corp')

    const { GET } = await import('@/app/api/portal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.companyName).toBe('ACME Corp')
    expect(body.stats).toMatchObject({
      activeSOs: 3,
      openInvoices: 2,
      activeROs: 1,
    })
    expect(body.stats.openBalance).toBe(5000)
  })

  it('includes recentSalesOrders, recentInvoices, recentRepairOrders in response', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    queueDashboardResponses()

    const { GET } = await import('@/app/api/portal/dashboard/route')
    const res = await GET()
    const body = await res.json()
    expect(Array.isArray(body.recentSalesOrders)).toBe(true)
    expect(Array.isArray(body.recentInvoices)).toBe(true)
    expect(Array.isArray(body.recentRepairOrders)).toBe(true)
  })

  it('scopes all queries to the authenticated company name', async () => {
    mockAuth.mockResolvedValue(makeClientSession(7))
    mockQuery.mockResolvedValueOnce([{ company_name: 'SpecificAirlines' }])
    // Queue the 6 dashboard queries
    for (let i = 0; i < 6; i++) {
      mockQuery.mockResolvedValueOnce([{ activeSOs: 0, openInvoices: 0, openBalance: '0', activeROs: 0 }])
    }

    const { GET } = await import('@/app/api/portal/dashboard/route')
    await GET()

    // All post-context queries (calls 2-7) should include the company name as a parameter
    const postContextCalls = mockQuery.mock.calls.slice(1)
    for (const [, params] of postContextCalls) {
      if (Array.isArray(params)) {
        expect(params).toContain('SpecificAirlines')
      }
    }
  })

  it('converts openBalance string from DB to a float', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    queueDashboardResponses()

    const { GET } = await import('@/app/api/portal/dashboard/route')
    const res = await GET()
    const body = await res.json()
    expect(typeof body.stats.openBalance).toBe('number')
  })

  it('returns openBalance=0 when DB returns null or non-numeric', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery
      .mockResolvedValueOnce([{ company_name: 'NullCo' }])
      .mockResolvedValueOnce([{ activeSOs: 0 }])
      .mockResolvedValueOnce([{ openInvoices: 0, openBalance: null }])
      .mockResolvedValueOnce([{ activeROs: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/dashboard/route')
    const res = await GET()
    const body = await res.json()
    expect(body.stats.openBalance).toBe(0)
  })
})
