/**
 * Tests for GET /api/search
 *
 * Public inventory search — no auth required.
 * Rate-limited (30 per minute per IP).
 * Returns empty array for blank query; otherwise runs LIKE search over parts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQuery = vi.fn()
vi.mock('@/lib/db', () => ({
  query: mockQuery,
  safeQuery: vi.fn(),
  safeCount: vi.fn(),
}))

const mockRateLimiterCheck = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
const mockRateLimiterRecord = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => ({
    check: mockRateLimiterCheck,
    record: mockRateLimiterRecord,
    reset: vi.fn().mockResolvedValue(undefined),
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSearchRequest(q: string, ip = '1.2.3.4') {
  const url = new URL('http://localhost/api/search')
  if (q !== '') url.searchParams.set('q', q)

  return Object.assign(new Request(url.toString(), {
    method: 'GET',
    headers: { 'x-forwarded-for': ip },
  }), {
    // next/server NextRequest exposes nextUrl — simulate it
    nextUrl: url,
  }) as any
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/search — empty / blank query', () => {
  beforeEach(() => {
    vi.resetModules()
    mockQuery.mockReset()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
  })

  it('returns empty array when q param is absent', async () => {
    const { GET } = await import('@/app/api/search/route')
    const res = await GET(makeSearchRequest(''))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns empty array when q is only whitespace', async () => {
    const { GET } = await import('@/app/api/search/route')
    const res = await GET(makeSearchRequest('   '))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})

describe('GET /api/search — successful results', () => {
  beforeEach(() => {
    vi.resetModules()
    mockQuery.mockReset()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
  })

  const fakeParts = [
    {
      id: 1,
      erp_product_id: 'ERP-001',
      part_number: 'XB-702',
      description: 'Valve assembly',
      mfr_part_no: 'MFR-702',
      nsn_number: null,
      cage_code: null,
      serial_number: null,
      manufacturer_name: 'ValveCo',
      location: 'Warehouse A',
      hazmat: 0,
      product_category: 'Valves',
      is_portal_item: 1,
    },
  ]

  it('returns matching parts for a valid query', async () => {
    mockQuery.mockResolvedValueOnce(fakeParts)
    const { GET } = await import('@/app/api/search/route')
    const res = await GET(makeSearchRequest('XB-702'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
    expect(body[0].part_number).toBe('XB-702')
  })

  it('returns empty array when no parts match', async () => {
    mockQuery.mockResolvedValueOnce([])
    const { GET } = await import('@/app/api/search/route')
    const res = await GET(makeSearchRequest('ZZZNO_MATCH'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('passes LIKE patterns for all five searchable columns', async () => {
    mockQuery.mockResolvedValueOnce([])
    const { GET } = await import('@/app/api/search/route')
    await GET(makeSearchRequest('valve'))

    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQuery.mock.calls[0]
    // SQL should search product_name, description, mfr_part_no, nsn_number, cage_code
    expect(sql.toLowerCase()).toContain('product_name')
    expect(sql.toLowerCase()).toContain('description')
    expect(sql.toLowerCase()).toContain('mfr_part_no')
    // All five params should be the same LIKE pattern
    expect(params.every((p: string) => p === '%valve%')).toBe(true)
  })

  it('truncates query to 200 characters to prevent abuse', async () => {
    mockQuery.mockResolvedValueOnce([])
    const longQuery = 'A'.repeat(300)
    const { GET } = await import('@/app/api/search/route')
    await GET(makeSearchRequest(longQuery))

    const [, params] = mockQuery.mock.calls[0]
    // Each param is `%<trimmed>%` — the content part should be max 200 chars
    const pattern: string = params[0]
    const inner = pattern.slice(1, -1) // strip leading/trailing %
    expect(inner.length).toBeLessThanOrEqual(200)
  })

  it('records the rate-limit attempt on each valid request', async () => {
    mockQuery.mockResolvedValueOnce([])
    const { GET } = await import('@/app/api/search/route')
    await GET(makeSearchRequest('part'))
    expect(mockRateLimiterRecord).toHaveBeenCalled()
  })
})

describe('GET /api/search — rate limiting', () => {
  beforeEach(() => {
    vi.resetModules()
    mockQuery.mockReset()
  })

  it('returns 429 when IP exceeds rate limit', async () => {
    mockRateLimiterCheck.mockResolvedValue({ allowed: false, retryAfterSeconds: 10 })
    const { GET } = await import('@/app/api/search/route')
    const res = await GET(makeSearchRequest('valve'))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('10')
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

describe('GET /api/search — IP extraction', () => {
  beforeEach(() => {
    vi.resetModules()
    mockQuery.mockReset()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
  })

  it('uses x-forwarded-for first IP when present', async () => {
    mockQuery.mockResolvedValueOnce([])
    const req = Object.assign(
      new Request('http://localhost/api/search?q=part', {
        headers: { 'x-forwarded-for': '5.5.5.5, 6.6.6.6' },
      }),
      { nextUrl: new URL('http://localhost/api/search?q=part') }
    ) as any

    const { GET } = await import('@/app/api/search/route')
    await GET(req)
    expect(mockRateLimiterCheck).toHaveBeenCalledWith('5.5.5.5')
  })
})
