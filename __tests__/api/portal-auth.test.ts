/**
 * Unit tests for lib/portal-auth.ts — getPortalContext()
 *
 * Verifies all failure modes return null and the success path returns a
 * fully populated PortalContext. Each test controls auth() and query()
 * via mocks; no real DB or NextAuth runtime is touched.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
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

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'user-42',
      email: 'client@test.com',
      role: 'client',
      companyId: 1,
      ...overrides,
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getPortalContext', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns PortalContext when session is valid and company is found', async () => {
    mockAuth.mockResolvedValue(makeSession({ companyId: 1 }))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])

    const { getPortalContext } = await import('@/lib/portal-auth')
    const ctx = await getPortalContext()

    expect(ctx).not.toBeNull()
    expect(ctx!.userId).toBe('user-42')
    expect(ctx!.companyId).toBe(1)
    expect(ctx!.companyName).toBe('ACME Corp')

    // Must query companies by numeric id
    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('FROM companies')
    expect(sql).toContain('WHERE id = ?')
    expect(params).toContain(1)
  })

  it('returns null when auth() returns null (no session)', async () => {
    mockAuth.mockResolvedValue(null)

    const { getPortalContext } = await import('@/lib/portal-auth')
    const ctx = await getPortalContext()

    expect(ctx).toBeNull()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns null when session has no user object', async () => {
    mockAuth.mockResolvedValue({})

    const { getPortalContext } = await import('@/lib/portal-auth')
    const ctx = await getPortalContext()

    expect(ctx).toBeNull()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns null when role is not "client" (e.g. "internal")', async () => {
    mockAuth.mockResolvedValue(makeSession({ role: 'internal', companyId: 1 }))

    const { getPortalContext } = await import('@/lib/portal-auth')
    const ctx = await getPortalContext()

    expect(ctx).toBeNull()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns null when companyId is null', async () => {
    mockAuth.mockResolvedValue(makeSession({ companyId: null }))

    const { getPortalContext } = await import('@/lib/portal-auth')
    const ctx = await getPortalContext()

    expect(ctx).toBeNull()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns null when companyId is undefined', async () => {
    mockAuth.mockResolvedValue(makeSession({ companyId: undefined }))

    const { getPortalContext } = await import('@/lib/portal-auth')
    const ctx = await getPortalContext()

    expect(ctx).toBeNull()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns null when companyId is a string (wrong type)', async () => {
    mockAuth.mockResolvedValue(makeSession({ companyId: '1' }))

    const { getPortalContext } = await import('@/lib/portal-auth')
    const ctx = await getPortalContext()

    expect(ctx).toBeNull()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns null when companyId is not found in companies table (empty result)', async () => {
    mockAuth.mockResolvedValue(makeSession({ companyId: 999 }))
    mockQuery.mockResolvedValueOnce([])

    const { getPortalContext } = await import('@/lib/portal-auth')
    const ctx = await getPortalContext()

    expect(ctx).toBeNull()
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  // Boundary: companyId = 0 is falsy — treated as missing
  it('returns null when companyId is 0 (falsy boundary)', async () => {
    mockAuth.mockResolvedValue(makeSession({ companyId: 0 }))

    const { getPortalContext } = await import('@/lib/portal-auth')
    const ctx = await getPortalContext()

    expect(ctx).toBeNull()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  // Boundary: negative companyId — falsy check passes but should not match real row
  it('returns null when companyId is negative and not found in DB', async () => {
    mockAuth.mockResolvedValue(makeSession({ companyId: -1 }))
    mockQuery.mockResolvedValueOnce([])

    const { getPortalContext } = await import('@/lib/portal-auth')
    const ctx = await getPortalContext()

    expect(ctx).toBeNull()
  })
})
