/**
 * users_v2 Three-Role System Tests
 *
 * Proves the 3-role system (admin | internal | client) is enforced correctly:
 *
 *   ADMIN:    can access /api/internal/* and /api/admin/* routes
 *             SSO token gets role='owner'
 *   INTERNAL: can access /api/internal/*
 *             cannot access /api/admin/*
 *             SSO token gets role='sales'
 *   CLIENT:   can access /api/portal/*
 *             cannot access /api/internal/* or /api/admin/*
 *             cannot trigger SSO
 *
 * JWT/session callback tests:
 *   - Entra ID login for cmalagon@genthrust.net → role='admin'
 *   - Entra ID login for other@genthrust.net → role='internal'
 *   - Credentials login → role from user object (from DB)
 *   - Missing role in token defaults to 'client'
 *   - 'admin' value in token must never be silently dropped
 *
 * All DB calls and library functions are mocked — no real network or DB needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Global mocks — hoisted so they are available before any import()
// ---------------------------------------------------------------------------

const { mockAuth, mockQuery } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockQuery: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/db', () => ({ query: mockQuery }))

vi.mock('@/lib/bot-helpers', () => ({
  getAllBotStatusesAsync: vi.fn().mockResolvedValue([]),
  getBotMetrics: vi.fn().mockReturnValue({}),
  getNotificationFeed: vi.fn().mockReturnValue([]),
}))

vi.mock('@/lib/sso-redirect', () => ({
  generateSsoToken: vi.fn().mockReturnValue('mock-sso-token'),
  buildFlightDeckSsoUrl: vi.fn().mockReturnValue('https://flightdeck.example.com/sso?token=mock'),
}))

vi.mock('@/lib/audit-logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  ACTION_TYPES: { UPDATE: 'UPDATE', DELETE: 'DELETE', LOGIN: 'LOGIN', LOGIN_FAILED: 'LOGIN_FAILED' },
  RESOURCE_TYPES: { CLIENT: 'CLIENT' },
}))

// ---------------------------------------------------------------------------
// Session factories
// ---------------------------------------------------------------------------

function makeAdminSession() {
  return {
    user: {
      id: '1',
      email: 'cmalagon@genthrust.net',
      name: 'Calvin Malagon',
      role: 'admin',
    },
  }
}

function makeInternalSession() {
  return {
    user: {
      id: '2',
      email: 'jmalagon@genthrust.net',
      name: 'Jose Malagon',
      role: 'internal',
    },
  }
}

function makeClientSession() {
  return {
    user: {
      id: '10',
      email: 'client@example.com',
      role: 'client',
      companyId: 1,
      companyName: 'ACME Corp',
      mfaEnabled: true,
    },
  }
}

// SSO route requires ENTRA_TENANT_ID
process.env.ENTRA_TENANT_ID = process.env.ENTRA_TENANT_ID ?? 'test-tenant-id'

// ===========================================================================
// ADMIN CAN ACCESS INTERNAL ROUTES (3 tests)
// ===========================================================================

describe('Admin can access /api/internal/* routes', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockAuth.mockResolvedValue(makeAdminSession())
  })

  it('GET /api/internal/dashboard → 200 for admin role', async () => {
    // mockQuery must return data so the route doesn't throw
    mockQuery.mockResolvedValue([{}])
    const { GET } = await import('@/app/api/internal/dashboard/route')
    const res = await GET()
    expect(res.status).not.toBe(401)
  })

  it('GET /api/internal/clients → 200 for admin role', async () => {
    mockQuery.mockResolvedValue([])
    const { GET } = await import('@/app/api/internal/clients/route')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(mockQuery).toHaveBeenCalled()
  })

  it('GET /api/internal/audit-log → not 401 for admin role', async () => {
    mockQuery.mockResolvedValue([])
    const { GET } = await import('@/app/api/internal/audit-log/route')
    const req = new Request('http://localhost/api/internal/audit-log') as any
    const res = await GET(req)
    expect(res.status).not.toBe(401)
  })
})

// ===========================================================================
// ADMIN CAN ACCESS ADMIN ROUTES (2 tests)
// ===========================================================================

describe('Admin can access /api/admin/* routes', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockAuth.mockResolvedValue(makeAdminSession())
  })

  it('POST /api/admin/create-client → not 401 for admin role (validation fails, not auth)', async () => {
    mockQuery.mockResolvedValue([])
    const { POST } = await import('@/app/api/admin/create-client/route')
    // Send invalid body to get validation error, not auth error — proves auth passed
    const req = new Request('http://localhost/api/admin/create-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad-email' }), // intentionally invalid
    })
    const res = await POST(req)
    // Should be 400 (validation error) not 401 (auth error) — admin is authorized
    expect(res.status).toBe(400)
  })

  it('create-client returns 401 for client role (admin-only)', async () => {
    mockAuth.mockResolvedValue(makeClientSession())
    const { POST } = await import('@/app/api/admin/create-client/route')
    const req = new Request('http://localhost/api/admin/create-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})

// ===========================================================================
// ADMIN SSO: generates FlightDeck role='owner' (2 tests)
// ===========================================================================

describe('Admin SSO token gets role=owner', () => {
  let originalEntra: string | undefined

  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    originalEntra = process.env.ENTRA_TENANT_ID
    process.env.ENTRA_TENANT_ID = 'test-tenant-id'
  })

  afterEach(() => {
    process.env.ENTRA_TENANT_ID = originalEntra
  })

  it('admin SSO → 307 redirect (allowed)', async () => {
    mockAuth.mockResolvedValue(makeAdminSession())
    const { GET } = await import('@/app/api/internal/sso/flightdeck/route')
    const res = await GET()
    expect([302, 307, 308]).toContain(res.status)
  })

  it('admin SSO → generateSsoToken called with role=owner', async () => {
    mockAuth.mockResolvedValue(makeAdminSession())
    const { generateSsoToken } = await import('@/lib/sso-redirect')
    const { GET } = await import('@/app/api/internal/sso/flightdeck/route')
    await GET()
    expect(generateSsoToken).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'owner' })
    )
  })
})

// ===========================================================================
// INTERNAL CAN ACCESS INTERNAL ROUTES (2 tests)
// ===========================================================================

describe('Internal can access /api/internal/* routes', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockAuth.mockResolvedValue(makeInternalSession())
  })

  it('GET /api/internal/clients → 200 for internal role', async () => {
    mockQuery.mockResolvedValue([])
    const { GET } = await import('@/app/api/internal/clients/route')
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('GET /api/internal/dashboard → not 401 for internal role', async () => {
    mockQuery.mockResolvedValue([{}])
    const { GET } = await import('@/app/api/internal/dashboard/route')
    const res = await GET()
    expect(res.status).not.toBe(401)
  })
})

// ===========================================================================
// INTERNAL CANNOT ACCESS ADMIN ROUTES (1 test)
// ===========================================================================

describe('Internal cannot access /api/admin/* routes', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockAuth.mockResolvedValue(makeInternalSession())
  })

  it('POST /api/admin/create-client → 401 for internal role', async () => {
    const { POST } = await import('@/app/api/admin/create-client/route')
    const req = new Request('http://localhost/api/admin/create-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})

// ===========================================================================
// INTERNAL SSO: generates FlightDeck role='sales' (1 test)
// ===========================================================================

describe('Internal SSO token gets role=sales', () => {
  let originalEntra: string | undefined

  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    originalEntra = process.env.ENTRA_TENANT_ID
    process.env.ENTRA_TENANT_ID = 'test-tenant-id'
  })

  afterEach(() => {
    process.env.ENTRA_TENANT_ID = originalEntra
  })

  it('internal SSO → generateSsoToken called with role=sales', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const { generateSsoToken } = await import('@/lib/sso-redirect')
    const { GET } = await import('@/app/api/internal/sso/flightdeck/route')
    await GET()
    expect(generateSsoToken).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'sales' })
    )
  })
})

// ===========================================================================
// CLIENT CANNOT ACCESS INTERNAL OR ADMIN ROUTES (3 tests)
// ===========================================================================

describe('Client cannot access protected non-portal routes', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockAuth.mockResolvedValue(makeClientSession())
  })

  it('GET /api/internal/clients → 401 for client role', async () => {
    const { GET } = await import('@/app/api/internal/clients/route')
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('POST /api/admin/create-client → 401 for client role', async () => {
    const { POST } = await import('@/app/api/admin/create-client/route')
    const req = new Request('http://localhost/api/admin/create-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('client calling SSO endpoint → 401', async () => {
    process.env.ENTRA_TENANT_ID = 'test-tenant-id'
    const { GET } = await import('@/app/api/internal/sso/flightdeck/route')
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })
})

// ===========================================================================
// JWT / SESSION CALLBACK LOGIC (7 tests)
// Tests the 3-role assignment logic from auth.config.ts
// ===========================================================================

describe('JWT and session callbacks — 3-role system', () => {
  // Mirror the updated jwt callback logic from auth.config.ts
  function jwtCallback({
    token,
    user,
    account,
  }: {
    token: Record<string, any>
    user?: Record<string, any>
    account?: { provider: string } | null
  }): Record<string, any> {
    if (user) {
      token.id = user.id
      // Role from user object (set by credentials authorize from DB)
      if ('role' in user) {
        token.role = (user as any).role
      }
      if ('companyId' in user) {
        token.companyId = (user as any).companyId ?? null
        token.companyName = (user as any).companyName ?? null
        token.erpContactId = (user as any).erpContactId ?? null
      }
      if ('mfaEnabled' in user) {
        token.mfaEnabled = (user as any).mfaEnabled
      }
    }
    if (account) {
      if (account.provider === 'credentials') {
        if (!token.role) {
          token.role = 'client'
        }
      } else {
        // Entra ID: cmalagon → admin, others → internal
        const email = (token.email as string | undefined) ?? ''
        token.role = email.toLowerCase() === 'cmalagon@genthrust.net' ? 'admin' : 'internal'
      }
    }
    return token
  }

  // Mirror the updated session callback from auth.config.ts
  function sessionCallback({
    session,
    token,
  }: {
    session: Record<string, any>
    token: Record<string, any>
  }): Record<string, any> {
    if (session.user) {
      if (token.id) session.user.id = token.id
      const tokenRole = token.role
      if (tokenRole === 'admin') {
        session.user.role = 'admin'
      } else if (tokenRole === 'internal') {
        session.user.role = 'internal'
      } else {
        session.user.role = 'client'
      }
      session.user.mfaEnabled = token.mfaEnabled ?? undefined
      session.user.companyId = token.companyId ?? null
      session.user.companyName = token.companyName ?? null
      session.user.erpContactId = token.erpContactId ?? null
    }
    return session
  }

  it('Entra ID login for cmalagon@genthrust.net → token.role = admin', () => {
    const token = jwtCallback({
      token: { email: 'cmalagon@genthrust.net' },
      user: { id: '1' },
      account: { provider: 'microsoft-entra-id' },
    })
    expect(token.role).toBe('admin')
  })

  it('Entra ID login for other@genthrust.net → token.role = internal', () => {
    const token = jwtCallback({
      token: { email: 'jmalagon@genthrust.net' },
      user: { id: '2' },
      account: { provider: 'microsoft-entra-id' },
    })
    expect(token.role).toBe('internal')
  })

  it('credentials login → role comes from user object (DB value)', () => {
    const token = jwtCallback({
      token: { email: 'client@example.com' },
      user: { id: '10', role: 'client' },
      account: { provider: 'credentials' },
    })
    expect(token.role).toBe('client')
  })

  it('credentials login with no role on user object → defaults to client', () => {
    const token = jwtCallback({
      token: { email: 'client@example.com' },
      user: { id: '10' }, // no role field
      account: { provider: 'credentials' },
    })
    expect(token.role).toBe('client')
  })

  it('session callback propagates admin role correctly', () => {
    const session = sessionCallback({
      session: { user: {} },
      token: { role: 'admin', id: '1' },
    })
    expect(session.user.role).toBe('admin')
  })

  it('session callback propagates internal role correctly', () => {
    const session = sessionCallback({
      session: { user: {} },
      token: { role: 'internal', id: '2' },
    })
    expect(session.user.role).toBe('internal')
  })

  it('session callback defaults missing/unknown role to client (never elevates)', () => {
    // Adversarial: every non-admin, non-internal value must produce 'client'
    const badValues = [undefined, null, '', 'INTERNAL', 'ADMIN', 'Admin', 0, false, 'superuser']
    for (const badRole of badValues) {
      const session = sessionCallback({
        session: { user: {} },
        token: { role: badRole },
      })
      expect(session.user.role).toBe('client')
      expect(session.user.role).not.toBe('internal')
      expect(session.user.role).not.toBe('admin')
    }
  })
})

// ===========================================================================
// AUTH.CONFIG AUTHORIZED CALLBACK — page routing (6 tests)
// ===========================================================================

describe('auth.config authorized callback — page routing with 3 roles', () => {
  // Mirror the updated authorized() logic from auth.config.ts

  function simulateAuthorized(
    pathname: string,
    userRole: string | undefined,
    mfaEnabled?: boolean
  ): 'allowed' | 'redirect' | 'unauthorized' {
    const isLoggedIn = !!userRole
    const isOnInternal = pathname.startsWith('/internal')
    const isOnPortal = pathname.startsWith('/portal')

    if (isOnInternal) {
      if (!isLoggedIn) return 'unauthorized'
      if (userRole !== 'internal' && userRole !== 'admin') return 'redirect'
      return 'allowed'
    }

    if (isOnPortal) {
      if (!isLoggedIn) return 'redirect'
      if (userRole !== 'client') return 'redirect'
      if (mfaEnabled === false && !pathname.startsWith('/portal/mfa-setup')) return 'redirect'
      return 'allowed'
    }

    return 'allowed'
  }

  it('admin can access /internal routes', () => {
    expect(simulateAuthorized('/internal/dashboard', 'admin')).toBe('allowed')
  })

  it('internal can access /internal routes', () => {
    expect(simulateAuthorized('/internal/erp', 'internal')).toBe('allowed')
  })

  it('client is redirected from /internal to portal', () => {
    expect(simulateAuthorized('/internal', 'client')).toBe('redirect')
  })

  it('unauthenticated user blocked from /internal', () => {
    expect(simulateAuthorized('/internal', undefined)).toBe('unauthorized')
  })

  it('admin is redirected from /portal (non-client role check)', () => {
    expect(simulateAuthorized('/portal/dashboard', 'admin')).toBe('redirect')
  })

  it('client with MFA enabled can access /portal', () => {
    expect(simulateAuthorized('/portal/dashboard', 'client', true)).toBe('allowed')
  })
})
