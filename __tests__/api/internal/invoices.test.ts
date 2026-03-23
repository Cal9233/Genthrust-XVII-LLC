/**
 * Tests for GET /api/internal/invoices and GET /api/internal/invoices/[id]
 *
 * Auth: session.user.role must be 'internal' or 'admin'.
 * List: paginated, filterable by search (invoice_no, account_name, customer_po) and status.
 * Detail: returns invoice + line items, 404 for missing id.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInternalSession(overrides = {}) {
  return { user: { id: '1', email: 'admin@genthrust.net', role: 'internal', ...overrides } }
}

function makeRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

// ---------------------------------------------------------------------------
// GET /api/internal/invoices — list
// ---------------------------------------------------------------------------

describe('GET /api/internal/invoices', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/invoices/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/invoices'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when role is client', async () => {
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'client' } })
    const { GET } = await import('@/app/api/internal/invoices/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/invoices'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when session has no user', async () => {
    mockAuth.mockResolvedValue({ user: null })
    const { GET } = await import('@/app/api/internal/invoices/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/invoices'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with paginated results for internal role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 3 }])
    const rows = [
      { id: 1, invoice_no: 'INV-001', account_name: 'AeroCorp', status: 'Open', total: 5000, open_balance: 2500, line_count: 2 },
      { id: 2, invoice_no: 'INV-002', account_name: 'SkyFix', status: 'Paid', total: 1200, open_balance: 0, line_count: 1 },
      { id: 3, invoice_no: 'INV-003', account_name: 'Parts Inc', status: 'Overdue', total: 800, open_balance: 800, line_count: 3 },
    ]
    mockQuery.mockResolvedValueOnce(rows)

    const { GET } = await import('@/app/api/internal/invoices/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/invoices?page=1&limit=20'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(3)
    expect(body.total).toBe(3)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it('returns 200 for admin role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession({ role: 'admin' }))
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([{ id: 4, invoice_no: 'INV-004', status: 'Open', line_count: 0, total: 0 }])

    const { GET } = await import('@/app/api/internal/invoices/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/invoices'))
    expect(res.status).toBe(200)
  })

  it('applies search filter to SQL params when ?search= is provided', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([{ id: 1, invoice_no: 'INV-SEARCH', status: 'Open', line_count: 0 }])

    const { GET } = await import('@/app/api/internal/invoices/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/invoices?search=SEARCH'))
    expect(res.status).toBe(200)

    const countParams = mockQuery.mock.calls[0][1]
    // search injects 3 LIKE params (invoice_no, account_name, customer_po)
    const likeCount = (countParams as string[]).filter(p => p.includes('%SEARCH%')).length
    expect(likeCount).toBe(3)
  })

  it('applies status filter to SQL params when ?status= is provided', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 2 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/invoices/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/invoices?status=Overdue'))
    expect(res.status).toBe(200)

    const countParams = mockQuery.mock.calls[0][1]
    expect(countParams).toContain('Overdue')
  })

  it('returns empty data array with total=0 when no invoices exist', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/invoices/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/invoices'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.total).toBe(0)
  })

  it('caps limit at 200 regardless of ?limit= param', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/invoices/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/invoices?limit=500'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.limit).toBeLessThanOrEqual(200)
  })

  it('returns 500 when database throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValueOnce(new Error('DB error'))

    const { GET } = await import('@/app/api/internal/invoices/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/invoices'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to load invoices')
  })
})

// ---------------------------------------------------------------------------
// GET /api/internal/invoices/[id] — detail
// ---------------------------------------------------------------------------

describe('GET /api/internal/invoices/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/invoices/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/invoices/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { id: '5', role: 'client' } })
    const { GET } = await import('@/app/api/internal/invoices/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/invoices/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 404 when invoice does not exist', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([]) // empty rows

    const { GET } = await import('@/app/api/internal/invoices/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/invoices/9999'), {
      params: Promise.resolve({ id: '9999' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('returns invoice detail with line items when found', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const invoice = { id: 1, invoice_no: 'INV-001', account_name: 'AeroCorp', status: 'Open', total: 5000 }
    const lines = [
      { id: 20, invoice_id: 1, line_number: 1, part_number: 'P-001', description: 'Bearing', qty: 2, unit_price: 1500 },
      { id: 21, invoice_id: 1, line_number: 2, part_number: 'P-002', description: 'Seal Kit', qty: 1, unit_price: 2000 },
    ]
    mockQuery.mockResolvedValueOnce([invoice])
    mockQuery.mockResolvedValueOnce(lines)

    const { GET } = await import('@/app/api/internal/invoices/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/invoices/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.invoice).toEqual(invoice)
    expect(body.lines).toHaveLength(2)
    expect(body.lines[0].part_number).toBe('P-001')
  })

  it('returns empty lines array when invoice has no line items', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 2, invoice_no: 'INV-002', status: 'Paid' }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/invoices/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/invoices/2'), {
      params: Promise.resolve({ id: '2' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.lines).toEqual([])
  })

  it('returns 500 when database throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValueOnce(new Error('DB failure'))

    const { GET } = await import('@/app/api/internal/invoices/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/invoices/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to load invoice')
  })
})
