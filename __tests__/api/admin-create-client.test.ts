/**
 * Tests for POST /api/admin/create-client
 *
 * Admin-only route.  Creates portal_users + users_v2 rows with is_active=1.
 * Returns 401 for any non-admin session.
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

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('$hashed$'),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(role: string, overrides: Record<string, unknown> = {}) {
  return {
    user: { id: '1', email: 'admin@genthrust.net', role, ...overrides },
  }
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/create-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  email: 'newclient@example.com',
  password: 'StrongPass1!',
  contact_name: 'Bob Builder',
  company_id: 3,
}

// ---------------------------------------------------------------------------
// Auth guard — 401
// ---------------------------------------------------------------------------

describe('POST /api/admin/create-client — auth guard', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated (no session)', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/admin/create-client/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when role is "client"', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    const { POST } = await import('@/app/api/admin/create-client/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when role is "internal" (not admin)', async () => {
    mockAuth.mockResolvedValue(makeSession('internal'))
    const { POST } = await import('@/app/api/admin/create-client/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 when role field is absent', async () => {
    mockAuth.mockResolvedValue({ user: { id: '1', email: 'x@x.com' } })
    const { POST } = await import('@/app/api/admin/create-client/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// Input validation — 400
// ---------------------------------------------------------------------------

describe('POST /api/admin/create-client — input validation', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockAuth.mockResolvedValue(makeSession('admin'))
  })

  it('returns 400 when email is missing', async () => {
    const { POST } = await import('@/app/api/admin/create-client/route')
    const { email: _, ...noEmail } = validBody
    const res = await POST(makeRequest(noEmail))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns 400 when email is malformed', async () => {
    const { POST } = await import('@/app/api/admin/create-client/route')
    const res = await POST(makeRequest({ ...validBody, email: 'notvalid' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is too short (< 8 chars)', async () => {
    const { POST } = await import('@/app/api/admin/create-client/route')
    const res = await POST(makeRequest({ ...validBody, password: 'short' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when contact_name is missing', async () => {
    const { POST } = await import('@/app/api/admin/create-client/route')
    const { contact_name: _, ...noName } = validBody
    const res = await POST(makeRequest(noName))
    expect(res.status).toBe(400)
  })

  it('returns 400 when contact_name is empty string', async () => {
    const { POST } = await import('@/app/api/admin/create-client/route')
    const res = await POST(makeRequest({ ...validBody, contact_name: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when company_id is not a positive integer', async () => {
    const { POST } = await import('@/app/api/admin/create-client/route')
    const res = await POST(makeRequest({ ...validBody, company_id: -1 }))
    expect(res.status).toBe(400)
  })

  it('returns field-level details in the 400 response', async () => {
    const { POST } = await import('@/app/api/admin/create-client/route')
    const res = await POST(makeRequest({ ...validBody, email: 'bad' }))
    const body = await res.json()
    expect(body.details).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Duplicate email — 409
// ---------------------------------------------------------------------------

describe('POST /api/admin/create-client — duplicate email', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockAuth.mockResolvedValue(makeSession('admin'))
  })

  it('returns 409 when email already exists in DB', async () => {
    mockQuery.mockRejectedValueOnce(
      Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' })
    )
    const { POST } = await import('@/app/api/admin/create-client/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('already exists')
  })
})

// ---------------------------------------------------------------------------
// Successful creation — 201
// ---------------------------------------------------------------------------

describe('POST /api/admin/create-client — successful creation', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockAuth.mockResolvedValue(makeSession('admin'))
  })

  it('returns 201 with id and email for a valid admin request', async () => {
    mockQuery
      .mockResolvedValueOnce({ insertId: 10 })   // portal_users INSERT
      .mockResolvedValueOnce({ insertId: 11 })   // users_v2 INSERT

    const { POST } = await import('@/app/api/admin/create-client/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(11)
    expect(body.email).toBe('newclient@example.com')
  })

  it('normalises email to lowercase before inserting', async () => {
    mockQuery
      .mockResolvedValueOnce({ insertId: 20 })
      .mockResolvedValueOnce({ insertId: 21 })

    const { POST } = await import('@/app/api/admin/create-client/route')
    await POST(makeRequest({ ...validBody, email: 'UPPER@EXAMPLE.COM' }))

    const portalInsertCall = mockQuery.mock.calls.find(
      ([sql]: [string]) => sql.toLowerCase().includes('portal_users')
    )
    expect(portalInsertCall![1]).toContain('upper@example.com')
  })

  it('creates user with is_active=1 (admin-created clients are immediately active)', async () => {
    mockQuery
      .mockResolvedValueOnce({ insertId: 30 })
      .mockResolvedValueOnce({ insertId: 31 })

    const { POST } = await import('@/app/api/admin/create-client/route')
    await POST(makeRequest(validBody))

    // is_active = 1 is a literal in the SQL, not a param
    const portalInsertCall = mockQuery.mock.calls.find(
      ([sql]: [string]) => sql.toLowerCase().includes('portal_users')
    )
    expect(portalInsertCall).toBeDefined()
    expect(portalInsertCall![0]).toContain('is_active) VALUES')
    expect(portalInsertCall![0]).toMatch(/VALUES\s*\(.*,\s*1\)/s)
  })

  it('works without company_id (optional field)', async () => {
    const { company_id: _, ...noCompany } = validBody
    mockQuery
      .mockResolvedValueOnce({ insertId: 40 })
      .mockResolvedValueOnce({ insertId: 41 })

    const { POST } = await import('@/app/api/admin/create-client/route')
    const res = await POST(makeRequest(noCompany))
    expect(res.status).toBe(201)
  })

  it('inserts portal_user_id into users_v2 for MFA FK linkage', async () => {
    mockQuery
      .mockResolvedValueOnce({ insertId: 50 })  // portal_users -> portalUserId = 50
      .mockResolvedValueOnce({ insertId: 51 })

    const { POST } = await import('@/app/api/admin/create-client/route')
    await POST(makeRequest(validBody))

    const v2InsertCall = mockQuery.mock.calls.find(
      ([sql]: [string]) => sql.toLowerCase().includes('users_v2')
    )
    expect(v2InsertCall).toBeDefined()
    // portalUserId (50) should be passed to users_v2 INSERT
    expect(v2InsertCall![1]).toContain(50)
  })
})
