/**
 * Tests for GET /api/internal/sales-orders and GET /api/internal/sales-orders/[id]
 *
 * Auth: session.user.role must be 'internal' or 'admin'.
 * List: paginated, filterable by search (so_number, customer_name, customer_po) and status.
 * Detail: returns order + line items, 404 for missing id.
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
// GET /api/internal/sales-orders — list
// ---------------------------------------------------------------------------

describe('GET /api/internal/sales-orders', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/sales-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/sales-orders'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when role is client', async () => {
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'client' } })
    const { GET } = await import('@/app/api/internal/sales-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/sales-orders'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when session has no user', async () => {
    mockAuth.mockResolvedValue({ user: null })
    const { GET } = await import('@/app/api/internal/sales-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/sales-orders'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with paginated results for internal role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 2 }])
    const rows = [
      { id: 1, so_number: 'SO-001', customer_name: 'AeroCorp', status: 'Open', priority: 'High', total: 9000, line_count: 4 },
      { id: 2, so_number: 'SO-002', customer_name: 'SkyFix', status: 'Closed', priority: 'Low', total: 300, line_count: 1 },
    ]
    mockQuery.mockResolvedValueOnce(rows)

    const { GET } = await import('@/app/api/internal/sales-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/sales-orders?page=1&limit=20'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it('returns 200 for admin role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession({ role: 'admin' }))
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/sales-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/sales-orders'))
    expect(res.status).toBe(200)
  })

  it('applies search filter across so_number, customer_name, customer_po', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([{ id: 1, so_number: 'SO-FIND', status: 'Open', line_count: 0 }])

    const { GET } = await import('@/app/api/internal/sales-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/sales-orders?search=FIND'))
    expect(res.status).toBe(200)

    const countParams = mockQuery.mock.calls[0][1]
    const likeCount = (countParams as string[]).filter(p => String(p).includes('%FIND%')).length
    expect(likeCount).toBe(3)
  })

  it('applies status filter when ?status= is provided', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 1 }])
    mockQuery.mockResolvedValueOnce([{ id: 1, so_number: 'SO-001', status: 'Shipped', line_count: 0 }])

    const { GET } = await import('@/app/api/internal/sales-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/sales-orders?status=Shipped'))
    expect(res.status).toBe(200)

    const countParams = mockQuery.mock.calls[0][1]
    expect(countParams).toContain('Shipped')
  })

  it('returns empty data array with total=0 when no sales orders exist', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/sales-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/sales-orders'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.total).toBe(0)
  })

  it('enforces maximum limit of 200', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ total: 0 }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/sales-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/sales-orders?limit=9999'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.limit).toBeLessThanOrEqual(200)
  })

  it('returns 500 when database throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'))

    const { GET } = await import('@/app/api/internal/sales-orders/route')
    const res = await GET(makeRequest('http://localhost:3000/api/internal/sales-orders'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to load sales orders')
  })
})

// ---------------------------------------------------------------------------
// GET /api/internal/sales-orders/[id] — detail
// ---------------------------------------------------------------------------

describe('GET /api/internal/sales-orders/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/sales-orders/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/sales-orders/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { id: '5', role: 'client' } })
    const { GET } = await import('@/app/api/internal/sales-orders/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/sales-orders/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 404 when sales order does not exist', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/sales-orders/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/sales-orders/9999'), {
      params: Promise.resolve({ id: '9999' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('returns order detail with line items when found', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const order = { id: 1, so_number: 'SO-001', customer_name: 'AeroCorp', status: 'Open', total: 9000 }
    const lines = [
      { id: 30, sales_order_id: 1, line_number: 1, part_number: 'P-A1', description: 'Engine Mount', qty: 1, unit_price: 5000 },
      { id: 31, sales_order_id: 1, line_number: 2, part_number: 'P-A2', description: 'Bracket', qty: 2, unit_price: 2000 },
    ]
    mockQuery.mockResolvedValueOnce([order])
    mockQuery.mockResolvedValueOnce(lines)

    const { GET } = await import('@/app/api/internal/sales-orders/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/sales-orders/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.order).toEqual(order)
    expect(body.lines).toHaveLength(2)
    expect(body.lines[1].part_number).toBe('P-A2')
  })

  it('returns empty lines array when sales order has no line items', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 2, so_number: 'SO-002', status: 'Closed' }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/sales-orders/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/sales-orders/2'), {
      params: Promise.resolve({ id: '2' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.lines).toEqual([])
  })

  it('returns 500 when database throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValueOnce(new Error('DB crash'))

    const { GET } = await import('@/app/api/internal/sales-orders/[id]/route')
    const res = await GET(new Request('http://localhost:3000/api/internal/sales-orders/1'), {
      params: Promise.resolve({ id: '1' }),
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to load sales order')
  })
})
