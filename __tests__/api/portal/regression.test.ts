/**
 * Regression suite — existing portal endpoints must keep working.
 *
 * These tests SHOULD PASS against the current codebase. They guard against
 * regressions introduced while implementing the new list / quote / document
 * routes.
 *
 * Covered endpoints (all exist):
 *   GET /api/portal/dashboard
 *   GET /api/portal/invoices/[id]
 *   GET /api/portal/sales-orders/[id]
 *   GET /api/portal/repair-orders/[id]
 *   GET /api/portal/mfa/status
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
      id: '1',
      email: 'client@example.com',
      role: 'client',
      companyId,
    },
  }
}

function makeDetailRequest(id: string) {
  return {
    params: Promise.resolve({ id }),
  } as any
}

// ---------------------------------------------------------------------------
// Dashboard regression
// ---------------------------------------------------------------------------

describe('GET /api/portal/dashboard — regression', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns dashboard stats for an authenticated client', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    // companies lookup (getPortalContext)
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    // 6 parallel queries from the dashboard handler
    mockQuery.mockResolvedValueOnce([{ activeSOs: 3 }])
    mockQuery.mockResolvedValueOnce([{ openInvoices: 2, openBalance: '1500.00' }])
    mockQuery.mockResolvedValueOnce([{ activeROs: 1 }])
    mockQuery.mockResolvedValueOnce([]) // recentSOs
    mockQuery.mockResolvedValueOnce([]) // recentInvoices
    mockQuery.mockResolvedValueOnce([]) // recentROs

    const { GET } = await import('@/app/api/portal/dashboard/route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('stats')
    expect(body.stats).toHaveProperty('activeSOs')
    expect(body.stats).toHaveProperty('openInvoices')
    expect(body.stats).toHaveProperty('openBalance')
    expect(body.stats).toHaveProperty('activeROs')
    expect(body).toHaveProperty('recentSalesOrders')
    expect(body).toHaveProperty('recentInvoices')
    expect(body).toHaveProperty('recentRepairOrders')
  })

  it('returns 401 for an unauthenticated request', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/portal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when user has internal role (portal-only)', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'internal', companyId: 1 } })
    const { GET } = await import('@/app/api/portal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Invoice detail regression
// ---------------------------------------------------------------------------

describe('GET /api/portal/invoices/[id] — regression', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns invoice detail for an authorized client', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    const invoice = {
      id: 1, erp_invoice_id: 'INV-001', invoice_no: 'INV-001',
      account_name: 'ACME Corp', contact_name: 'John', so_number: 'SO-1',
      customer_po: 'PO-1', status: 'open', due_date: null, invoice_date: null,
      ship_via: null, track_no: null, subtotal: 100, total_discount: 0, total: 100, open_balance: 100,
    }
    mockQuery.mockResolvedValueOnce([invoice])
    mockQuery.mockResolvedValueOnce([]) // no lines

    const { GET } = await import('@/app/api/portal/invoices/[id]/route')
    const res = await GET({} as any, makeDetailRequest('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('invoice')
    expect(body).toHaveProperty('lines')
    expect(body.invoice.account_name).toBe('ACME Corp')
  })

  it('blocks cross-company access (IDOR) — returns 404 for another company\'s invoice', async () => {
    mockAuth.mockResolvedValue(makeClientSession(2))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Other Corp' }])
    mockQuery.mockResolvedValueOnce([]) // company mismatch → empty

    const { GET } = await import('@/app/api/portal/invoices/[id]/route')
    const res = await GET({} as any, makeDetailRequest('1'))
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// Sales order detail regression
// ---------------------------------------------------------------------------

describe('GET /api/portal/sales-orders/[id] — regression', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns SO detail for an authorized client', async () => {
    mockAuth.mockResolvedValue(makeClientSession(3))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Customer Inc' }])
    const so = {
      id: 3, erp_so_id: 'SO-001', so_number: 'SO-001', customer_po: 'CPO-1',
      customer_name: 'Customer Inc', contact_name: 'Bob', status: 'open',
      priority: 'normal', due_date: null, ship_via: null, track_no: null,
      term_sale: null, subtotal: 1000, total_discount: 0, total_vat: 0, total: 1000,
    }
    mockQuery.mockResolvedValueOnce([so])
    mockQuery.mockResolvedValueOnce([]) // no lines

    const { GET } = await import('@/app/api/portal/sales-orders/[id]/route')
    const res = await GET({} as any, makeDetailRequest('3'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('order')
    expect(body).toHaveProperty('lines')
    expect(body.order.customer_name).toBe('Customer Inc')
  })

  it('blocks cross-company access — returns 404 for another company\'s SO', async () => {
    mockAuth.mockResolvedValue(makeClientSession(4))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Wrong Corp' }])
    mockQuery.mockResolvedValueOnce([]) // company mismatch

    const { GET } = await import('@/app/api/portal/sales-orders/[id]/route')
    const res = await GET({} as any, makeDetailRequest('3'))
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// Repair order detail regression
// ---------------------------------------------------------------------------

describe('GET /api/portal/repair-orders/[id] — regression', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns RO detail for an authorized client', async () => {
    mockAuth.mockResolvedValue(makeClientSession(2))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Vendor LLC' }])
    const ro = {
      id: 2, erp_po_id: 'RO-001', ro_number: 'RO-001', vendor_name: 'Vendor LLC',
      contact_name: 'Alice', status: 'open', priority: 'normal', due_date: null,
      ship_via: null, ship_account: null, term_sale: null, total: 500,
    }
    mockQuery.mockResolvedValueOnce([ro])
    mockQuery.mockResolvedValueOnce([]) // no lines

    const { GET } = await import('@/app/api/portal/repair-orders/[id]/route')
    const res = await GET({} as any, makeDetailRequest('2'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('order')
    expect(body).toHaveProperty('lines')
    expect(body.order.vendor_name).toBe('Vendor LLC')
  })

  it('blocks cross-company access — returns 404 for another company\'s RO', async () => {
    mockAuth.mockResolvedValue(makeClientSession(9))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Attacker Corp' }])
    mockQuery.mockResolvedValueOnce([]) // company mismatch

    const { GET } = await import('@/app/api/portal/repair-orders/[id]/route')
    const res = await GET({} as any, makeDetailRequest('2'))
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// MFA status regression
// ---------------------------------------------------------------------------

describe('GET /api/portal/mfa/status — regression', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns MFA status for an authenticated client', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    // mfa/status uses auth() directly (not getPortalContext), queries portal_users
    mockQuery.mockResolvedValueOnce([{ mfa_enabled: 0 }])

    const { GET } = await import('@/app/api/portal/mfa/status/route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('enabled')
    expect(body.enabled).toBe(false)
  })
})
