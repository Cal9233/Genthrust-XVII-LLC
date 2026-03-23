/**
 * Tests for GET /api/internal/repair-orders and GET /api/internal/repair-orders/[id]
 *
 * Auth: session.user.role must be 'internal' or 'admin'.
 * List: paginated, filterable by search (ro_number, vendor_name) and status.
 * Detail: returns order + line items, 404 for missing id.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mock declarations — must be at module scope before any imports
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
// GET /api/internal/repair-orders — list
// ---------------------------------------------------------------------------

describe('GET /api/internal/repair-orders', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/repair-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/repair-orders'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when user role is client', async () => {
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'client' } })
    const { GET } = await import('@/app/api/internal/repair-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/repair-orders'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when session has no user', async () => {
    mockAuth.mockResolvedValue({ user: null })
    const { GET } = await import('@/app/api/internal/repair-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/repair-orders'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with paginated results for internal role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    // COUNT query: route does Promise.all([query(...)]) → [[{ total }]] destructure
    // so query() itself must return [{ total: N }]
    mockQuery.mockResolvedValueOnce([{ total: 2 }])
    // Data rows query
    const rows = [
      { id: 1, ro_number: 'RO-001', vendor_name: 'AeroCorp', status: 'Open', priority: 'Normal', line_count: 3, total: 5000 },
      { id: 2, ro_number: 'RO-002', vendor_name: 'SkyFix', status: 'In Progress', priority: 'High', line_count: 1, total: 1200 },
    ]
    mockQuery.mockResolvedValueOnce(rows)

    const { GET } = await import('@/app/api/internal/repair-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/repair-orders?page=1&limit=10'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(10)
  })

  it('returns 200 with paginated results for admin role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession({ role: 'admin' }))
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([{ id: 3, ro_number: 'RO-003', vendor_name: 'AdminVendor', status: 'Closed', priority: 'Low', line_count: 0, total: 800 }])

    const { GET } = await import('@/app/api/internal/repair-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/repair-orders'))
    expect(res.status).toBe(200)
  })

  it('applies search filter to SQL when ?search= is provided', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([{ id: 1, ro_number: 'RO-SEARCH', vendor_name: 'SearchCorp', status: 'Open', line_count: 0, total: 0 }])

    const { GET } = await import('@/app/api/internal/repair-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/repair-orders?search=SEARCH'))
    expect(res.status).toBe(200)

    // Both COUNT and data queries should include LIKE params
    const countParams = mockQuery.mock.calls[0][1]
    expect(countParams).toContain('%SEARCH%')
  })

  it('applies status filter to SQL when ?status= is provided', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([{ id: 1, ro_number: 'RO-001', status: 'Open', line_count: 0, total: 0 }])

    const { GET } = await import('@/app/api/internal/repair-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/repair-orders?status=Open'))
    expect(res.status).toBe(200)

    const countParams = mockQuery.mock.calls[0][1]
    expect(countParams).toContain('Open')
  })

  it('returns empty data array with total=0 when no repair orders exist', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/repair-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/repair-orders'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.total).toBe(0)
  })

  it('enforces maximum limit of 200', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 5 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/repair-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/repair-orders?limit=9999'))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Limit should be capped at 200
    expect(body.limit).toBeLessThanOrEqual(200)
  })

  it('defaults page to 1 when page param is invalid', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/repair-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/repair-orders?page=notanumber'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.page).toBe(1)
  })

  it('returns 500 when database throws an error', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValueOnce(new Error('DB connection failed'))

    const { GET } = await import('@/app/api/internal/repair-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/repair-orders'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to load repair orders')
  })
})

// ---------------------------------------------------------------------------
// GET /api/internal/repair-orders/[id] — detail
// ---------------------------------------------------------------------------

describe('GET /api/internal/repair-orders/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/repair-orders/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/repair-orders/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { id: '5', role: 'client' } })
    const { GET } = await import('@/app/api/internal/repair-orders/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/repair-orders/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 404 when repair order does not exist', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([]) // empty rows — not found

    const { GET } = await import('@/app/api/internal/repair-orders/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/repair-orders/999'), {
      params: Promise.resolve({ id: '999' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('returns order detail with line items when found', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const order = { id: 1, ro_number: 'RO-001', vendor_name: 'AeroCorp', status: 'Open' }
    const lines = [
      { id: 10, repair_order_id: 1, line_number: 1, part_number: 'P-123', description: 'Valve' },
      { id: 11, repair_order_id: 1, line_number: 2, part_number: 'P-456', description: 'Seal' },
    ]
    mockQuery.mockResolvedValueOnce([order]) // order query
    mockQuery.mockResolvedValueOnce(lines)   // lines query

    const { GET } = await import('@/app/api/internal/repair-orders/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/repair-orders/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.order).toEqual(order)
    expect(body.lines).toHaveLength(2)
    expect(body.lines[0].part_number).toBe('P-123')
  })

  it('returns empty lines array when repair order has no line items', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 2, ro_number: 'RO-002', status: 'Closed' }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/repair-orders/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/repair-orders/2'), {
      params: Promise.resolve({ id: '2' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.lines).toEqual([])
  })

  it('returns 500 when database throws an error', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValueOnce(new Error('DB failure'))

    const { GET } = await import('@/app/api/internal/repair-orders/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/repair-orders/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to load repair order')
  })
})
