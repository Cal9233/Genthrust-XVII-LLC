/**
 * Tests for GET/PATCH/DELETE /api/internal/clients
 *
 * Auth: session.user.role must be 'internal' or 'admin'.
 * GET:    returns list of portal clients with company info.
 * PATCH:  activates or deactivates a client (is_active 0|1); syncs portal_users.
 * DELETE: removes an inactive client; refuses deletion of active clients (409).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

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

vi.mock('@/lib/audit-logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  ACTION_TYPES: { UPDATE: 'UPDATE', DELETE: 'DELETE' },
  RESOURCE_TYPES: { CLIENT: 'CLIENT' },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInternalSession(overrides = {}) {
  return { user: { id: '1', email: 'admin@genthrust.net', role: 'internal', ...overrides } }
}

// ---------------------------------------------------------------------------
// GET /api/internal/clients
// ---------------------------------------------------------------------------

describe('GET /api/internal/clients', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/clients/route')
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'client' } })
    const { GET } = await import('@/app/api/internal/clients/route')
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 200 with client list for internal role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const clients = [
      { id: 10, email: 'alice@acme.com', contact_name: 'Alice Smith', is_active: 1, mfa_enabled: 1, company_name: 'ACME' },
      { id: 11, email: 'bob@parts.com', contact_name: 'Bob Jones', is_active: 0, mfa_enabled: 0, company_name: 'Parts Inc' },
    ]
    mockQuery.mockResolvedValueOnce(clients)

    const { GET } = await import('@/app/api/internal/clients/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clients).toHaveLength(2)
    expect(body.clients[0].email).toBe('alice@acme.com')
  })

  it('returns 200 with client list for admin role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession({ role: 'admin' }))
    mockQuery.mockResolvedValueOnce([{ id: 12, email: 'charlie@co.com', is_active: 1, company_name: 'Co' }])

    const { GET } = await import('@/app/api/internal/clients/route')
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('returns empty clients array when no portal clients exist', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/internal/clients/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clients).toEqual([])
  })

  it('returns 500 when database throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValueOnce(new Error('DB failure'))

    const { GET } = await import('@/app/api/internal/clients/route')
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to load clients')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/internal/clients — toggle is_active
// ---------------------------------------------------------------------------

describe('PATCH /api/internal/clients', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { PATCH } = await import('@/app/api/internal/clients/route')
    const res = await PATCH(new Request('http://localhost:3000/api/internal/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 10, is_active: 1 }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when userId is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { PATCH } = await import('@/app/api/internal/clients/route')
    const res = await PATCH(new Request('http://localhost:3000/api/internal/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: 1 }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('userId and is_active')
  })

  it('returns 400 when is_active is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { PATCH } = await import('@/app/api/internal/clients/route')
    const res = await PATCH(new Request('http://localhost:3000/api/internal/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 10 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when is_active is out of range (2)', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { PATCH } = await import('@/app/api/internal/clients/route')
    const res = await PATCH(new Request('http://localhost:3000/api/internal/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 10, is_active: 2 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when target user does not exist or is not a client', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([]) // SELECT user — not found

    const { PATCH } = await import('@/app/api/internal/clients/route')
    const res = await PATCH(new Request('http://localhost:3000/api/internal/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 999, is_active: 1 }),
    }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('User not found')
  })

  it('returns 200 and activates user (is_active=1)', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 10 }])         // user exists
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })   // UPDATE users_v2
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })   // UPDATE portal_users

    const { PATCH } = await import('@/app/api/internal/clients/route')
    const res = await PATCH(new Request('http://localhost:3000/api/internal/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 10, is_active: 1 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 200 and deactivates user (is_active=0)', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 11 }])
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })

    const { PATCH } = await import('@/app/api/internal/clients/route')
    const res = await PATCH(new Request('http://localhost:3000/api/internal/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 11, is_active: 0 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('syncs portal_users table after updating users_v2', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 10 }])
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })

    const { PATCH } = await import('@/app/api/internal/clients/route')
    await PATCH(new Request('http://localhost:3000/api/internal/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 10, is_active: 1 }),
    }))

    // Should have 3 query calls: SELECT user, UPDATE users_v2, UPDATE portal_users
    expect(mockQuery).toHaveBeenCalledTimes(3)
    const portalUpdateSql = mockQuery.mock.calls[2][0] as string
    expect(portalUpdateSql).toContain('portal_users')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/internal/clients — reject/remove client
// ---------------------------------------------------------------------------

describe('DELETE /api/internal/clients', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/internal/clients/route')
    const res = await DELETE(new Request('http://localhost:3000/api/internal/clients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 10 }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when userId is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { DELETE } = await import('@/app/api/internal/clients/route')
    const res = await DELETE(new Request('http://localhost:3000/api/internal/clients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('userId is required')
  })

  it('returns 404 when target user does not exist', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([]) // SELECT user — not found

    const { DELETE } = await import('@/app/api/internal/clients/route')
    const res = await DELETE(new Request('http://localhost:3000/api/internal/clients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 999 }),
    }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('User not found')
  })

  it('returns 409 when attempting to delete an active user', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 10, portal_user_id: null }]) // user found
    mockQuery.mockResolvedValueOnce({ affectedRows: 0 })                // DELETE fails (is_active=1)

    const { DELETE } = await import('@/app/api/internal/clients/route')
    const res = await DELETE(new Request('http://localhost:3000/api/internal/clients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 10 }),
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('Deactivate first')
  })

  it('returns 200 and deletes inactive user', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 11, portal_user_id: null }]) // user found, no portal row
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })                 // DELETE succeeds

    const { DELETE } = await import('@/app/api/internal/clients/route')
    const res = await DELETE(new Request('http://localhost:3000/api/internal/clients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 11 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('also deletes portal_users row when portal_user_id is set', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 12, portal_user_id: 99 }]) // user has portal row
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })               // DELETE users_v2
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })               // DELETE portal_users

    const { DELETE } = await import('@/app/api/internal/clients/route')
    const res = await DELETE(new Request('http://localhost:3000/api/internal/clients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 12 }),
    }))
    expect(res.status).toBe(200)
    // Total 3 queries: SELECT, DELETE users_v2, DELETE portal_users
    expect(mockQuery).toHaveBeenCalledTimes(3)
    const portalDeleteSql = mockQuery.mock.calls[2][0] as string
    expect(portalDeleteSql).toContain('portal_users')
  })

  it('skips portal_users delete when portal_user_id is null', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValueOnce([{ id: 13, portal_user_id: null }])
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 })

    const { DELETE } = await import('@/app/api/internal/clients/route')
    const res = await DELETE(new Request('http://localhost:3000/api/internal/clients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 13 }),
    }))
    expect(res.status).toBe(200)
    // Only 2 queries: SELECT + DELETE users_v2
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  it('returns 500 when database throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValueOnce(new Error('DB crash'))

    const { DELETE } = await import('@/app/api/internal/clients/route')
    const res = await DELETE(new Request('http://localhost:3000/api/internal/clients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 10 }),
    }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to reject client')
  })
})
