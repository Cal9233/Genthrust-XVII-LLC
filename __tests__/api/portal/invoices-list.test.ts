/**
 * TDD RED phase — tests for GET /api/portal/invoices
 *
 * Route file does NOT exist yet: app/api/portal/invoices/route.ts
 * All tests should FAIL (import error / 404) until the production file is created.
 *
 * Expected response shape:
 *   { data: Invoice[], total: number, page: number, limit: number }
 *
 * Invoice fields: so_number, account_name, invoice_no, status, total, open_balance, due_date
 *
 * Auth: getPortalContext() — role must be 'client', companyId must be numeric.
 * Company isolation: WHERE account_name = companyName.
 *
 * Special filter: ?overdue=true → due_date < TODAY AND open_balance > 0
 *   When overdue filter is active, results are sorted by due_date ASC.
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
  const url = new URL('http://localhost/api/portal/invoices')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new Request(url.toString())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/portal/invoices', () => {
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
    const { GET } = await import('@/app/api/portal/invoices/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when user role is internal (portal-only endpoint)', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'internal', companyId: 1 } })
    const { GET } = await import('@/app/api/portal/invoices/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Default pagination
  // -------------------------------------------------------------------------

  it('returns paginated invoice list with default page=1 and limit=20', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 3 }])
    const rows = [
      { invoice_no: 'INV-001', account_name: 'ACME Corp', so_number: 'SO-1', status: 'open', total: 1000, open_balance: 1000, due_date: '2026-03-01' },
      { invoice_no: 'INV-002', account_name: 'ACME Corp', so_number: 'SO-2', status: 'paid', total: 500, open_balance: 0, due_date: '2026-02-01' },
      { invoice_no: 'INV-003', account_name: 'ACME Corp', so_number: 'SO-3', status: 'open', total: 250, open_balance: 250, due_date: null },
    ]
    mockQuery.mockResolvedValueOnce(rows)

    const { GET } = await import('@/app/api/portal/invoices/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(3)
    expect(body.total).toBe(3)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it('returns correct fields including open_balance', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([
      { invoice_no: 'INV-001', account_name: 'ACME Corp', so_number: 'SO-1', status: 'open', total: 1000, open_balance: 400, due_date: '2026-04-01' },
    ])

    const { GET } = await import('@/app/api/portal/invoices/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    const item = body.data[0]
    expect(item).toHaveProperty('invoice_no')
    expect(item).toHaveProperty('account_name')
    expect(item).toHaveProperty('so_number')
    expect(item).toHaveProperty('status')
    expect(item).toHaveProperty('total')
    expect(item).toHaveProperty('open_balance')
    expect(item).toHaveProperty('due_date')
  })

  it('returns only the authenticated company\'s invoices (company isolation)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(8))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Billing Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([
      { invoice_no: 'INV-099', account_name: 'Billing Corp', so_number: 'SO-99', status: 'open', total: 300, open_balance: 300, due_date: null },
    ])

    const { GET } = await import('@/app/api/portal/invoices/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    for (const inv of body.data) {
      expect(inv.account_name).toBe('Billing Corp')
    }
    // Both queries scoped to companyName
    expect(mockQuery.mock.calls[1][1]).toContain('Billing Corp')
    expect(mockQuery.mock.calls[2][1]).toContain('Billing Corp')
  })

  it('returns empty array and total=0 for company with no invoices', async () => {
    mockAuth.mockResolvedValue(makeClientSession(4))
    mockQuery.mockResolvedValueOnce([{ company_name: 'New Customer' }])
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/invoices/route')
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
    mockQuery.mockResolvedValueOnce([{ total: 2 }])
    mockQuery.mockResolvedValueOnce([
      { invoice_no: 'INV-001', account_name: 'ACME Corp', so_number: 'SO-1', status: 'open', total: 1000, open_balance: 1000, due_date: null },
      { invoice_no: 'INV-003', account_name: 'ACME Corp', so_number: 'SO-3', status: 'open', total: 250, open_balance: 250, due_date: null },
    ])

    const { GET } = await import('@/app/api/portal/invoices/route')
    const res = await GET(makeRequest({ status: 'open' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    const countSql = mockQuery.mock.calls[1][0] as string
    const dataSql = mockQuery.mock.calls[2][0] as string
    expect(countSql.toLowerCase()).toContain('status')
    expect(dataSql.toLowerCase()).toContain('status')
    expect(mockQuery.mock.calls[1][1]).toContain('open')
    for (const inv of body.data) {
      expect(inv.status).toBe('open')
    }
  })

  it('filters overdue invoices (?overdue=true) — due_date < today AND open_balance > 0', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 2 }])
    mockQuery.mockResolvedValueOnce([
      { invoice_no: 'INV-001', account_name: 'ACME Corp', so_number: 'SO-1', status: 'open', total: 1000, open_balance: 1000, due_date: '2025-01-01' },
      { invoice_no: 'INV-002', account_name: 'ACME Corp', so_number: 'SO-2', status: 'open', total: 500, open_balance: 500, due_date: '2025-06-01' },
    ])

    const { GET } = await import('@/app/api/portal/invoices/route')
    const res = await GET(makeRequest({ overdue: 'true' }))

    expect(res.status).toBe(200)
    // Data SQL must filter by due_date < NOW and open_balance > 0
    const dataSql = mockQuery.mock.calls[2][0] as string
    expect(dataSql.toLowerCase()).toContain('due_date')
    expect(dataSql.toLowerCase()).toContain('open_balance')
  })

  it('sorts by due_date ASC when overdue filter is active', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 2 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/invoices/route')
    await GET(makeRequest({ overdue: 'true' }))

    const dataSql = mockQuery.mock.calls[2][0] as string
    // Must ORDER BY due_date ASC (oldest overdue first)
    expect(dataSql.toUpperCase()).toContain('ORDER BY')
    expect(dataSql.toLowerCase()).toContain('due_date')
    expect(dataSql.toUpperCase()).toContain('ASC')
  })

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  it('supports page param for pagination (OFFSET applied)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 50 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/invoices/route')
    const res = await GET(makeRequest({ page: '2' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.page).toBe(2)
    const dataSql = mockQuery.mock.calls[2][0] as string
    expect(dataSql.toUpperCase()).toContain('OFFSET')
  })

  it('returns total count for pagination UI', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 88 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/invoices/route')
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(88)
    expect(mockQuery).toHaveBeenCalledTimes(3) // companies + count + data
  })

  it('searches by invoice number (?search=INV-001)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([
      { invoice_no: 'INV-001', account_name: 'ACME Corp', so_number: 'SO-1', status: 'open', total: 1000, open_balance: 1000, due_date: null },
    ])

    const { GET } = await import('@/app/api/portal/invoices/route')
    const res = await GET(makeRequest({ search: 'INV-001' }))

    expect(res.status).toBe(200)
    const dataSql = mockQuery.mock.calls[2][0] as string
    expect(dataSql.toLowerCase()).toContain('invoice_no')
  })
})
