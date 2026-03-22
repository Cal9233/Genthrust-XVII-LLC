/**
 * Tests for Portal IDOR Fix (FIX-2 + H-1)
 *
 * After the H-1 fix, portal routes delegate auth to getPortalContext()
 * (lib/portal-auth.ts). That helper:
 *   1. Calls auth() to get the session
 *   2. Checks role === 'client'
 *   3. Reads companyId (number) from the token
 *   4. Queries `companies WHERE id = ?` to resolve the canonical company_name
 *
 * All auth failures return 401 (getPortalContext returns null).
 * Data queries are only executed after the company lookup succeeds.
 * Line-item queries are only executed after the main record auth check passes.
 *
 * Strategy: mock @/auth and @/lib/db, then import and call the GET handler
 * directly. Assert call counts on the mock query function.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @/auth — provide a helper to control session state per test
// ---------------------------------------------------------------------------
const mockAuth = vi.fn()
vi.mock('@/auth', () => ({
  auth: mockAuth,
}))

// ---------------------------------------------------------------------------
// Mock @/lib/db — track how many times query() is called and what SQL it
// received. Each test controls return values via mockQuery.mockResolvedValueOnce.
// ---------------------------------------------------------------------------
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

function makeRequest(id: string) {
  return {
    params: Promise.resolve({ id }),
  } as any
}

// ---------------------------------------------------------------------------
// Invoice detail route
// ---------------------------------------------------------------------------

describe('Portal invoice detail — IDOR fix', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/portal/invoices/[id]/route')
    const res = await GET({} as any, makeRequest('42'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when role is not client', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'internal' } })
    const { GET } = await import('@/app/api/portal/invoices/[id]/route')
    const res = await GET({} as any, makeRequest('42'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when companyId is missing (undefined)', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client', companyId: undefined } })
    const { GET } = await import('@/app/api/portal/invoices/[id]/route')
    const res = await GET({} as any, makeRequest('42'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when companyId is null (stale session)', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client', companyId: null } })
    const { GET } = await import('@/app/api/portal/invoices/[id]/route')
    const res = await GET({} as any, makeRequest('42'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when companyId is not found in companies table', async () => {
    mockAuth.mockResolvedValue(makeClientSession(999))
    // companies lookup returns empty
    mockQuery.mockResolvedValueOnce([])
    const { GET } = await import('@/app/api/portal/invoices/[id]/route')
    const res = await GET({} as any, makeRequest('42'))
    expect(res.status).toBe(401)
    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('FROM companies')
    expect(params).toContain(999)
  })

  it('IDOR: does NOT query invoice_lines when main record is not found (company mismatch)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    // Company lookup succeeds
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    // Main record query returns empty — company mismatch
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/invoices/[id]/route')
    const res = await GET({} as any, makeRequest('999'))

    expect(res.status).toBe(404)
    // 2 queries: company lookup + main record check; no line-item query
    expect(mockQuery).toHaveBeenCalledTimes(2)
    const [firstSql] = mockQuery.mock.calls[0]
    expect(firstSql).toContain('FROM companies')
    const [secondSql] = mockQuery.mock.calls[1]
    expect(secondSql).toContain('FROM invoices')
    expect(secondSql).toContain('account_name')
  })

  it('queries invoice_lines only AFTER main record authorization succeeds', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    const invoice = {
      id: 1, erp_invoice_id: 'INV-001', invoice_no: 'INV-001',
      account_name: 'ACME Corp', contact_name: 'John', so_number: 'SO-1',
      customer_po: 'PO-1', status: 'open', due_date: null, invoice_date: null,
      ship_via: null, track_no: null, subtotal: 100, total_discount: 0, total: 100,
      open_balance: 100,
    }
    const lines = [
      { id: 10, line_number: 1, part_name: 'Widget', description: 'A widget', condition_code: 'SV', serial_number: null, qty: 1, unit_price: 100, uom: 'EA' },
    ]
    // company lookup
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    // main record
    mockQuery.mockResolvedValueOnce([invoice])
    // line items
    mockQuery.mockResolvedValueOnce(lines)

    const { GET } = await import('@/app/api/portal/invoices/[id]/route')
    const res = await GET({} as any, makeRequest('1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockQuery).toHaveBeenCalledTimes(3)

    // First query: company lookup by id
    const [firstSql, firstParams] = mockQuery.mock.calls[0]
    expect(firstSql).toContain('FROM companies')
    expect(firstParams).toContain(1)

    // Second query: main record scoped by company name
    const [secondSql, secondParams] = mockQuery.mock.calls[1]
    expect(secondSql).toContain('FROM invoices')
    expect(secondSql).toContain('account_name')
    expect(secondParams).toContain('ACME Corp')

    // Third query: line items
    const [thirdSql, thirdParams] = mockQuery.mock.calls[2]
    expect(thirdSql).toContain('FROM invoice_lines')
    expect(thirdParams).toContain('1')

    expect(body.invoice).toMatchObject({ id: 1, account_name: 'ACME Corp' })
    expect(body.lines).toHaveLength(1)
  })

  it('main record query uses parameterised binding for id and companyName', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/invoices/[id]/route')
    await GET({} as any, makeRequest('55'))

    const [, params] = mockQuery.mock.calls[1]
    expect(params).toContain('55')
    expect(params).toContain('ACME Corp')
  })
})

// ---------------------------------------------------------------------------
// Repair order detail route
// ---------------------------------------------------------------------------

describe('Portal repair order detail — IDOR fix', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/portal/repair-orders/[id]/route')
    const res = await GET({} as any, makeRequest('42'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when role is not client', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'internal' } })
    const { GET } = await import('@/app/api/portal/repair-orders/[id]/route')
    const res = await GET({} as any, makeRequest('42'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when companyId is null (stale session)', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client', companyId: null } })
    const { GET } = await import('@/app/api/portal/repair-orders/[id]/route')
    const res = await GET({} as any, makeRequest('42'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('IDOR: does NOT query repair_order_lines when main record is not found (company mismatch)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(2))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Vendor LLC' }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/repair-orders/[id]/route')
    const res = await GET({} as any, makeRequest('999'))

    expect(res.status).toBe(404)
    expect(mockQuery).toHaveBeenCalledTimes(2)
    const [secondSql] = mockQuery.mock.calls[1]
    expect(secondSql).toContain('FROM repair_orders')
    expect(secondSql).toContain('vendor_name')
  })

  it('queries repair_order_lines only AFTER main record authorization succeeds', async () => {
    mockAuth.mockResolvedValue(makeClientSession(2))
    const ro = {
      id: 2, erp_po_id: 'RO-001', ro_number: 'RO-001', vendor_name: 'Vendor LLC',
      contact_name: 'Alice', status: 'open', priority: 'normal', due_date: null,
      ship_via: null, ship_account: null, term_sale: null, total: 500,
    }
    const lines = [
      { id: 20, line_number: 1, part_name: 'Pump', description: 'Hydraulic pump', condition_code: 'OH', serial_number: 'SN123', qty: 1, qty_received: 0, qty_delivered: 0, unit_price: 500, uom: 'EA' },
    ]
    mockQuery.mockResolvedValueOnce([{ company_name: 'Vendor LLC' }])
    mockQuery.mockResolvedValueOnce([ro])
    mockQuery.mockResolvedValueOnce(lines)

    const { GET } = await import('@/app/api/portal/repair-orders/[id]/route')
    const res = await GET({} as any, makeRequest('2'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockQuery).toHaveBeenCalledTimes(3)

    const [firstSql, firstParams] = mockQuery.mock.calls[0]
    expect(firstSql).toContain('FROM companies')
    expect(firstParams).toContain(2)

    const [secondSql, secondParams] = mockQuery.mock.calls[1]
    expect(secondSql).toContain('FROM repair_orders')
    expect(secondSql).toContain('vendor_name')
    expect(secondParams).toContain('Vendor LLC')

    const [thirdSql, thirdParams] = mockQuery.mock.calls[2]
    expect(thirdSql).toContain('FROM repair_order_lines')
    expect(thirdParams).toContain('2')

    expect(body.order).toMatchObject({ id: 2, vendor_name: 'Vendor LLC' })
    expect(body.lines).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Sales order detail route
// ---------------------------------------------------------------------------

describe('Portal sales order detail — IDOR fix', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/portal/sales-orders/[id]/route')
    const res = await GET({} as any, makeRequest('42'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when role is not client', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'internal' } })
    const { GET } = await import('@/app/api/portal/sales-orders/[id]/route')
    const res = await GET({} as any, makeRequest('42'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when companyId is null (stale session)', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client', companyId: null } })
    const { GET } = await import('@/app/api/portal/sales-orders/[id]/route')
    const res = await GET({} as any, makeRequest('42'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('IDOR: does NOT query sales_order_lines when main record is not found (company mismatch)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(3))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Customer Inc' }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/sales-orders/[id]/route')
    const res = await GET({} as any, makeRequest('999'))

    expect(res.status).toBe(404)
    expect(mockQuery).toHaveBeenCalledTimes(2)
    const [secondSql] = mockQuery.mock.calls[1]
    expect(secondSql).toContain('FROM sales_orders')
    expect(secondSql).toContain('customer_name')
  })

  it('queries sales_order_lines only AFTER main record authorization succeeds', async () => {
    mockAuth.mockResolvedValue(makeClientSession(3))
    const so = {
      id: 3, erp_so_id: 'SO-001', so_number: 'SO-001', customer_po: 'CPO-1',
      customer_name: 'Customer Inc', contact_name: 'Bob', status: 'open',
      priority: 'normal', due_date: null, ship_via: null, track_no: null,
      term_sale: null, subtotal: 1000, total_discount: 0, total_vat: 0, total: 1000,
    }
    const lines = [
      { id: 30, line_number: 1, part_name: 'Gear', description: 'Landing gear', condition_code: 'AR', serial_number: null, qty: 2, qty_received: 0, qty_delivered: 0, unit_price: 500, uom: 'EA' },
    ]
    mockQuery.mockResolvedValueOnce([{ company_name: 'Customer Inc' }])
    mockQuery.mockResolvedValueOnce([so])
    mockQuery.mockResolvedValueOnce(lines)

    const { GET } = await import('@/app/api/portal/sales-orders/[id]/route')
    const res = await GET({} as any, makeRequest('3'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockQuery).toHaveBeenCalledTimes(3)

    const [firstSql, firstParams] = mockQuery.mock.calls[0]
    expect(firstSql).toContain('FROM companies')
    expect(firstParams).toContain(3)

    const [secondSql, secondParams] = mockQuery.mock.calls[1]
    expect(secondSql).toContain('FROM sales_orders')
    expect(secondSql).toContain('customer_name')
    expect(secondParams).toContain('Customer Inc')

    const [thirdSql, thirdParams] = mockQuery.mock.calls[2]
    expect(thirdSql).toContain('FROM sales_order_lines')
    expect(thirdParams).toContain('3')

    expect(body.order).toMatchObject({ id: 3, customer_name: 'Customer Inc' })
    expect(body.lines).toHaveLength(1)
  })

  it('main record query uses parameterised binding for id and companyName', async () => {
    mockAuth.mockResolvedValue(makeClientSession(3))
    mockQuery.mockResolvedValueOnce([{ company_name: 'Customer Inc' }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/sales-orders/[id]/route')
    await GET({} as any, makeRequest('77'))

    const [, params] = mockQuery.mock.calls[1]
    expect(params).toContain('77')
    expect(params).toContain('Customer Inc')
  })
})
