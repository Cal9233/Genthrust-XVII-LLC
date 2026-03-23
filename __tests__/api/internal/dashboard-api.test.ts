/**
 * Tests for GET /api/internal/dashboard and GET /api/internal/status-overview
 *
 * Both routes aggregate data from multiple tables in parallel.
 * Each sub-query is wrapped in a safeCount/safeQuery that swallows errors and
 * returns defaults — so DB failures on individual tables should still return 200.
 *
 * Auth: session.user.role must be 'internal' or 'admin'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock declarations
// ---------------------------------------------------------------------------

const mockAuth = vi.fn()
vi.mock('@/auth', () => ({ auth: mockAuth }))

// dashboard/route.ts defines its own inline safeCount/safeQuery that call query()
// status-overview/route.ts uses query() and inventoryQuery() separately
const mockQuery = vi.fn()
const mockInventoryQuery = vi.fn()

vi.mock('@/lib/db', () => ({
  query: mockQuery,
  safeQuery: vi.fn(),
  safeCount: vi.fn(),
}))

vi.mock('@/lib/inventory-db', () => ({
  inventoryQuery: mockInventoryQuery,
}))

vi.mock('@/lib/bot-helpers', () => ({
  getAllBotStatusesAsync: vi.fn().mockResolvedValue([]),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInternalSession(overrides = {}) {
  return { user: { id: '1', email: 'admin@genthrust.net', role: 'internal', ...overrides } }
}

// Return a mock that resolves to [{ [field]: value }] for safeCount-style use
function countRow(field: string, value: number) {
  return [{ [field]: value }]
}

// ---------------------------------------------------------------------------
// GET /api/internal/dashboard
// ---------------------------------------------------------------------------

describe('GET /api/internal/dashboard', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'client' } })
    const { GET } = await import('@/app/api/internal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when session has no user', async () => {
    mockAuth.mockResolvedValue({ user: null })
    const { GET } = await import('@/app/api/internal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 200 with all expected stat keys for internal role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())

    // 12 parallel query calls:
    // partsRow, companiesRow, rosRow, sosRow, invoicesRow, quotesRow,
    // rfqsRow, documentsRow, catalogRow, recentROs, recentSOs, recentInvoices
    mockQuery
      .mockResolvedValueOnce(countRow('totalParts', 500))
      .mockResolvedValueOnce(countRow('totalCompanies', 20))
      .mockResolvedValueOnce(countRow('activeROs', 12))
      .mockResolvedValueOnce(countRow('activeSOs', 8))
      .mockResolvedValueOnce([{ openInvoices: 5, openBalance: '12500.00' }])
      .mockResolvedValueOnce(countRow('pendingQuotes', 3))
      .mockResolvedValueOnce(countRow('pendingRfqs', 1))
      .mockResolvedValueOnce(countRow('totalDocuments', 42))
      .mockResolvedValueOnce(countRow('catalogItems', 150))
      .mockResolvedValueOnce([]) // recentROs
      .mockResolvedValueOnce([]) // recentSOs
      .mockResolvedValueOnce([]) // recentInvoices

    const { GET } = await import('@/app/api/internal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.stats).toBeDefined()
    expect(body.stats.totalParts).toBe(500)
    expect(body.stats.totalCompanies).toBe(20)
    expect(body.stats.activeROs).toBe(12)
    expect(body.stats.activeSOs).toBe(8)
    expect(body.stats.openInvoices).toBe(5)
    expect(body.stats.openBalance).toBe(12500)
    expect(body.stats.pendingQuotes).toBe(3)
    expect(body.stats.pendingRfqs).toBe(1)
    expect(body.stats.totalDocuments).toBe(42)
    expect(body.stats.catalogItems).toBe(150)
  })

  it('returns 200 for admin role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession({ role: 'admin' }))
    mockQuery.mockResolvedValue([{}]) // all queries return empty row

    const { GET } = await import('@/app/api/internal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('returns recentRepairOrders, recentSalesOrders, recentInvoices arrays', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const roRow = { id: 1, ro_number: 'RO-001', status: 'Open', vendor_name: 'AeroCorp' }
    const soRow = { id: 2, so_number: 'SO-001', status: 'Open', customer_name: 'BuyerCo' }
    const invRow = { id: 3, invoice_no: 'INV-001', status: 'Open', account_name: 'AeroCorp' }

    mockQuery
      .mockResolvedValueOnce([{}]) // partsRow
      .mockResolvedValueOnce([{}]) // companiesRow
      .mockResolvedValueOnce([{}]) // rosRow
      .mockResolvedValueOnce([{}]) // sosRow
      .mockResolvedValueOnce([{ openInvoices: 0, openBalance: 0 }])
      .mockResolvedValueOnce([{}]) // quotesRow
      .mockResolvedValueOnce([{}]) // rfqsRow
      .mockResolvedValueOnce([{}]) // documentsRow
      .mockResolvedValueOnce([{}]) // catalogRow
      .mockResolvedValueOnce([roRow]) // recentROs
      .mockResolvedValueOnce([soRow]) // recentSOs
      .mockResolvedValueOnce([invRow]) // recentInvoices

    const { GET } = await import('@/app/api/internal/dashboard/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.recentRepairOrders).toHaveLength(1)
    expect(body.recentRepairOrders[0].ro_number).toBe('RO-001')
    expect(body.recentSalesOrders).toHaveLength(1)
    expect(body.recentSalesOrders[0].so_number).toBe('SO-001')
    expect(body.recentInvoices).toHaveLength(1)
    expect(body.recentInvoices[0].invoice_no).toBe('INV-001')
  })

  it('returns 200 with all zeros when individual safeCount queries fail', async () => {
    // dashboard.route defines inline safeCount/safeQuery that return {} / [] on error.
    // Simulate every query throwing — they should all be absorbed.
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValue(new Error('table does not exist'))

    const { GET } = await import('@/app/api/internal/dashboard/route')
    const res = await GET()
    // Should still return 200 because each query is individually wrapped
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stats.totalParts).toBe(0)
    expect(body.stats.activeROs).toBe(0)
    expect(body.recentRepairOrders).toEqual([])
  })

  it('coerces openBalance to float (parses decimal string from DB)', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery
      .mockResolvedValueOnce([{}]) // partsRow
      .mockResolvedValueOnce([{}]) // companiesRow
      .mockResolvedValueOnce([{}]) // rosRow
      .mockResolvedValueOnce([{}]) // sosRow
      .mockResolvedValueOnce([{ openInvoices: 2, openBalance: '9999.99' }])
      .mockResolvedValueOnce([{}]) // quotesRow
      .mockResolvedValueOnce([{}]) // rfqsRow
      .mockResolvedValueOnce([{}]) // documentsRow
      .mockResolvedValueOnce([{}]) // catalogRow
      .mockResolvedValueOnce([])   // recentROs
      .mockResolvedValueOnce([])   // recentSOs
      .mockResolvedValueOnce([])   // recentInvoices

    const { GET } = await import('@/app/api/internal/dashboard/route')
    const res = await GET()
    const body = await res.json()
    expect(body.stats.openBalance).toBe(9999.99)
  })
})

// ---------------------------------------------------------------------------
// GET /api/internal/status-overview
// ---------------------------------------------------------------------------

describe('GET /api/internal/status-overview', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockInventoryQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/status-overview/route')
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'client' } })
    const { GET } = await import('@/app/api/internal/status-overview/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 200 with structured sections for internal role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())

    // 9 parallel queries using safeCount (each calls query or inventoryQuery)
    // rosRow, sosRow, invoicesRow, partsRow, clientsRow, inventoryRow, alarmsRow, quotesRow, net30Row
    mockQuery
      .mockResolvedValueOnce(countRow('activeROs', 7))
      .mockResolvedValueOnce(countRow('activeSOs', 4))
      .mockResolvedValueOnce([{ openInvoices: 3, openBalance: '5000.00' }])
      .mockResolvedValueOnce(countRow('totalParts', 200))
      .mockResolvedValueOnce([{ totalClients: 15, activeClients: 10, pendingClients: 5 }])
      .mockResolvedValueOnce(countRow('dueSoon', 2)) // net30Row (last non-inventory query)

    mockInventoryQuery
      .mockResolvedValueOnce(countRow('totalSkus', 300)) // inventoryRow
      .mockResolvedValueOnce(countRow('activeAlarms', 1)) // alarmsRow

    // quotes query (8th query to mockQuery)
    mockQuery.mockResolvedValueOnce([{ totalQuotes: 10, pendingQuotes: 4, processedQuotes: 3 }])

    const { GET } = await import('@/app/api/internal/status-overview/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    // Shape check
    expect(body).toHaveProperty('bots')
    expect(body).toHaveProperty('erp')
    expect(body).toHaveProperty('automation')
    expect(body).toHaveProperty('clients')
    expect(body).toHaveProperty('inventory')
    expect(body).toHaveProperty('quotes')
  })

  it('returns bots section with running/stopped counts', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())

    // All queries return defaults
    mockQuery.mockResolvedValue([{}])
    mockInventoryQuery.mockResolvedValue([{}])

    // Override bot helper mock for this test
    const { getAllBotStatusesAsync } = await import('@/lib/bot-helpers')
    vi.mocked(getAllBotStatusesAsync).mockResolvedValueOnce([
      { status: 'RUNNING', name: 'bot1' } as any,
      { status: 'RUNNING', name: 'bot2' } as any,
      { status: 'STOPPED', name: 'bot3' } as any,
    ])

    const { GET } = await import('@/app/api/internal/status-overview/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.bots.total).toBe(3)
    expect(body.bots.running).toBe(2)
    expect(body.bots.stopped).toBe(1)
  })

  it('returns bots section with zeros when bot status throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValue([{}])
    mockInventoryQuery.mockResolvedValue([{}])

    const { getAllBotStatusesAsync } = await import('@/lib/bot-helpers')
    vi.mocked(getAllBotStatusesAsync).mockRejectedValueOnce(new Error('Windows service unavailable'))

    const { GET } = await import('@/app/api/internal/status-overview/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.bots.total).toBe(0)
    expect(body.bots.running).toBe(0)
    expect(body.bots.stopped).toBe(0)
  })

  it('returns 200 with zero values when all DB queries fail (graceful degradation)', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    // Every query throws — status-overview uses inline safeCount that absorbs errors
    mockQuery.mockRejectedValue(new Error('All tables missing'))
    mockInventoryQuery.mockRejectedValue(new Error('Inventory DB down'))

    const { GET } = await import('@/app/api/internal/status-overview/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.erp.activeROs).toBe(0)
    expect(body.erp.activeSOs).toBe(0)
    expect(body.erp.openInvoices).toBe(0)
    expect(body.inventory.totalSkus).toBe(0)
    expect(body.inventory.activeAlarms).toBe(0)
    expect(body.clients.total).toBe(0)
    expect(body.quotes.total).toBe(0)
  })

  it('returns 200 for admin role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession({ role: 'admin' }))
    mockQuery.mockResolvedValue([{}])
    mockInventoryQuery.mockResolvedValue([{}])

    const { GET } = await import('@/app/api/internal/status-overview/route')
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('parses openBalance as float from DB decimal string', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery
      .mockResolvedValueOnce([{}]) // rosRow
      .mockResolvedValueOnce([{}]) // sosRow
      .mockResolvedValueOnce([{ openInvoices: 1, openBalance: '3750.50' }]) // invoicesRow
      .mockResolvedValueOnce([{}]) // partsRow
      .mockResolvedValueOnce([{}]) // clientsRow
      .mockResolvedValueOnce([{}]) // net30Row
      .mockResolvedValueOnce([{}]) // quotesRow
    mockInventoryQuery
      .mockResolvedValueOnce([{}]) // inventoryRow
      .mockResolvedValueOnce([{}]) // alarmsRow

    const { GET } = await import('@/app/api/internal/status-overview/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.erp.openBalance).toBe(3750.50)
  })
})
