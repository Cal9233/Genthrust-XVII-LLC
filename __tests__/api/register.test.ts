/**
 * Tests for:
 *   POST /api/register        — client self-registration
 *   GET  /api/register/companies — company search (typeahead)
 *
 * No DB or external services are hit — all mocked.
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

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('$hashed$'),
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

function makeRegisterRequest(body: Record<string, unknown>, ip = '10.0.0.1') {
  return new Request('http://localhost/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

const validRegisterBody = {
  email: 'newuser@example.com',
  password: 'SecurePass1!',
  contact_name: 'Alice Smith',
  company_name: 'AcmeCorp',
}

// ---------------------------------------------------------------------------
// POST /api/register — input validation (400)
// ---------------------------------------------------------------------------

describe('POST /api/register — input validation', () => {
  beforeEach(() => {
    vi.resetModules()
    mockQuery.mockReset()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
  })

  it('returns 400 when email is missing', async () => {
    const { POST } = await import('@/app/api/register/route')
    const { email: _, ...noEmail } = validRegisterBody
    const res = await POST(makeRegisterRequest(noEmail) as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns 400 when email is malformed', async () => {
    const { POST } = await import('@/app/api/register/route')
    const res = await POST(makeRegisterRequest({ ...validRegisterBody, email: 'notanemail' }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is too short (< 8 chars)', async () => {
    const { POST } = await import('@/app/api/register/route')
    const res = await POST(makeRegisterRequest({ ...validRegisterBody, password: 'short' }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when contact_name is missing', async () => {
    const { POST } = await import('@/app/api/register/route')
    const { contact_name: _, ...noName } = validRegisterBody
    const res = await POST(makeRegisterRequest(noName) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when contact_name is empty string', async () => {
    const { POST } = await import('@/app/api/register/route')
    const res = await POST(makeRegisterRequest({ ...validRegisterBody, contact_name: '' }) as any)
    expect(res.status).toBe(400)
  })

  it('returns field-level details in the 400 response', async () => {
    const { POST } = await import('@/app/api/register/route')
    const res = await POST(makeRegisterRequest({ ...validRegisterBody, email: 'bad' }) as any)
    const body = await res.json()
    expect(body.details).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// POST /api/register — rate limiting (429)
// ---------------------------------------------------------------------------

describe('POST /api/register — rate limiting', () => {
  beforeEach(() => {
    vi.resetModules()
    mockQuery.mockReset()
  })

  it('returns 429 when IP is rate-limited before even parsing body', async () => {
    mockRateLimiterCheck.mockResolvedValue({ allowed: false, retryAfterSeconds: 3600 })
    const { POST } = await import('@/app/api/register/route')
    const res = await POST(makeRegisterRequest(validRegisterBody) as any)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('3600')
    // DB must NOT be called
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// POST /api/register — duplicate email (409)
// ---------------------------------------------------------------------------

describe('POST /api/register — duplicate email', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
  })

  it('returns 409 when email already exists (ER_DUP_ENTRY from DB)', async () => {
    mockQuery
      .mockResolvedValueOnce([]) // company lookup: not found
      .mockRejectedValueOnce(Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' }))

    const { POST } = await import('@/app/api/register/route')
    const res = await POST(makeRegisterRequest({ ...validRegisterBody, company_name: undefined }) as any)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('already registered')
  })
})

// ---------------------------------------------------------------------------
// POST /api/register — successful registration (201)
// ---------------------------------------------------------------------------

describe('POST /api/register — successful registration', () => {
  beforeEach(() => {
    vi.resetModules()
    mockQuery.mockReset()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
  })

  it('returns 201 with pending approval message for valid input', async () => {
    mockQuery
      .mockResolvedValueOnce([{ id: 5 }])           // company lookup
      .mockResolvedValueOnce({ insertId: 99 })       // portal_users INSERT
      .mockResolvedValueOnce({ insertId: 100 })      // users_v2 INSERT

    const { POST } = await import('@/app/api/register/route')
    const res = await POST(makeRegisterRequest(validRegisterBody) as any)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.message).toContain('pending')
  })

  it('creates user with is_active=0 (inactive until admin approval)', async () => {
    mockQuery
      .mockResolvedValueOnce([])                     // company not found
      .mockResolvedValueOnce({ insertId: 50 })       // portal_users
      .mockResolvedValueOnce({ insertId: 51 })       // users_v2

    const { POST } = await import('@/app/api/register/route')
    await POST(makeRegisterRequest(validRegisterBody) as any)

    // is_active = 0 is a literal in the SQL, not a param
    const portalInsertCall = mockQuery.mock.calls.find(
      ([sql]: [string]) => sql.toLowerCase().includes('portal_users') && sql.toLowerCase().includes('insert')
    )
    expect(portalInsertCall).toBeDefined()
    // The SQL has literal 0 for is_active — not passed as a param
    expect(portalInsertCall![0]).toMatch(/VALUES\s*\(.*,\s*0\s*,/s)
  })

  it('normalises email to lowercase before inserting', async () => {
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ insertId: 60 })
      .mockResolvedValueOnce({ insertId: 61 })

    const { POST } = await import('@/app/api/register/route')
    await POST(makeRegisterRequest({ ...validRegisterBody, email: 'UPPER@EXAMPLE.COM' }) as any)

    const insertCall = mockQuery.mock.calls.find(
      ([sql]: [string]) => sql.toLowerCase().includes('portal_users')
    )
    expect(insertCall![1]).toContain('upper@example.com')
  })

  it('works without company_name (companyId becomes null)', async () => {
    const { company_name: _, ...noCompany } = validRegisterBody
    mockQuery
      .mockResolvedValueOnce({ insertId: 70 })
      .mockResolvedValueOnce({ insertId: 71 })

    const { POST } = await import('@/app/api/register/route')
    const res = await POST(makeRegisterRequest(noCompany) as any)
    expect(res.status).toBe(201)
  })
})

// ---------------------------------------------------------------------------
// GET /api/register/companies — company search
// ---------------------------------------------------------------------------

describe('GET /api/register/companies', () => {
  beforeEach(() => {
    vi.resetModules()
    mockQuery.mockReset()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
  })

  function makeCompaniesRequest(q: string, ip = '1.2.3.4') {
    return new Request(`http://localhost/api/register/companies?q=${encodeURIComponent(q)}`, {
      headers: { 'x-forwarded-for': ip },
    })
  }

  it('returns empty array when query is shorter than 3 characters', async () => {
    const { GET } = await import('@/app/api/register/companies/route')
    const res = await GET(makeCompaniesRequest('AB'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns matching companies for a 3+ character query', async () => {
    mockQuery.mockResolvedValueOnce([
      { id: 1, company_name: 'AcmeCorp' },
      { id: 2, company_name: 'Acme Industries' },
    ])

    const { GET } = await import('@/app/api/register/companies/route')
    const res = await GET(makeCompaniesRequest('Acm'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0]).toHaveProperty('id')
    expect(body[0]).toHaveProperty('company_name')
  })

  it('returns empty array when no companies match', async () => {
    mockQuery.mockResolvedValueOnce([])
    const { GET } = await import('@/app/api/register/companies/route')
    const res = await GET(makeCompaniesRequest('xyz'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns empty array when q param is missing', async () => {
    const { GET } = await import('@/app/api/register/companies/route')
    const res = await GET(new Request('http://localhost/api/register/companies'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns 429 when rate-limited', async () => {
    mockRateLimiterCheck.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 })
    const { GET } = await import('@/app/api/register/companies/route')
    const res = await GET(makeCompaniesRequest('Acm'))
    expect(res.status).toBe(429)
  })
})
