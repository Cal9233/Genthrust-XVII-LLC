/**
 * Tests for auth.config.ts — the authorized() callback, signIn() provider gate,
 * jwt() callback, and session() callback.
 * These are pure functions that accept plain objects — no Next.js runtime needed.
 */
import { describe, it, expect } from 'vitest'
import { authConfig } from '@/auth.config'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AuthorizedArgs = Parameters<typeof authConfig.callbacks.authorized>[0]

function makeAuthorizedArgs(
  isLoggedIn: boolean,
  pathname: string,
  role?: string,
  mfaEnabled?: boolean
): AuthorizedArgs {
  const auth = isLoggedIn
    ? { user: { id: '1', email: 'test@test.com', role, mfaEnabled } }
    : null

  return {
    auth: auth as any,
    request: {
      nextUrl: new URL(`http://localhost${pathname}`),
    } as any,
  }
}

// ---------------------------------------------------------------------------
// authorized() callback — /internal routes
// ---------------------------------------------------------------------------

describe('authConfig.authorized — /internal routes', () => {
  it('redirects unauthenticated users away from /internal', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(false, '/internal'))
    // false means "not authorized" — NextAuth will redirect to signIn page
    expect(result).toBe(false)
  })

  it('allows internal role users to access /internal', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(true, '/internal', 'internal'))
    expect(result).toBe(true)
  })

  it('redirects client role users away from /internal to /portal', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(true, '/internal/erp', 'client'))
    expect(result).toBeInstanceOf(Response)
    const res = result as Response
    expect(res.headers.get('location')).toContain('/portal')
  })

  it('redirects users with no role away from /internal', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(true, '/internal', undefined))
    expect(result).toBeInstanceOf(Response)
  })
})

// ---------------------------------------------------------------------------
// authorized() callback — /portal routes
// ---------------------------------------------------------------------------

describe('authConfig.authorized — /portal routes', () => {
  it('redirects unauthenticated users from /portal to /login', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(false, '/portal'))
    expect(result).toBeInstanceOf(Response)
    const res = result as Response
    expect(res.headers.get('location')).toContain('/login')
  })

  it('allows authenticated client users to access /portal', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(true, '/portal', 'client', true))
    expect(result).toBe(true)
  })

  it('redirects client with mfaEnabled=false to /portal/mfa-setup', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(true, '/portal/dashboard', 'client', false))
    expect(result).toBeInstanceOf(Response)
    const res = result as Response
    expect(res.headers.get('location')).toContain('/portal/mfa-setup')
  })

  it('allows client already on /portal/mfa-setup even with mfaEnabled=false', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(true, '/portal/mfa-setup', 'client', false))
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// authorized() callback — /signin routes
// ---------------------------------------------------------------------------

describe('authConfig.authorized — /signin routes', () => {
  it('allows unauthenticated access to /signin', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(false, '/signin'))
    expect(result).toBe(true)
  })

  it('redirects authenticated internal user from /signin to /internal', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(true, '/signin', 'internal'))
    expect(result).toBeInstanceOf(Response)
    const res = result as Response
    expect(res.headers.get('location')).toContain('/internal')
  })

  it('redirects authenticated client from /signin to /portal', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(true, '/signin', 'client'))
    expect(result).toBeInstanceOf(Response)
    const res = result as Response
    expect(res.headers.get('location')).toContain('/portal')
  })
})

// ---------------------------------------------------------------------------
// authorized() callback — /login routes
// ---------------------------------------------------------------------------

describe('authConfig.authorized — /login routes', () => {
  it('allows unauthenticated access to /login', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(false, '/login'))
    expect(result).toBe(true)
  })

  it('redirects authenticated user from /login to /portal', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(true, '/login', 'client'))
    expect(result).toBeInstanceOf(Response)
    const res = result as Response
    expect(res.headers.get('location')).toContain('/portal')
  })
})

// ---------------------------------------------------------------------------
// authorized() callback — /register routes
// ---------------------------------------------------------------------------

describe('authConfig.authorized — /register routes', () => {
  it('allows unauthenticated access to /register', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(false, '/register'))
    expect(result).toBe(true)
  })

  it('redirects authenticated internal user from /register to /internal', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(true, '/register', 'internal'))
    expect(result).toBeInstanceOf(Response)
    const res = result as Response
    expect(res.headers.get('location')).toContain('/internal')
  })

  it('redirects authenticated client from /register to /portal', () => {
    const result = authConfig.callbacks.authorized(makeAuthorizedArgs(true, '/register', 'client'))
    expect(result).toBeInstanceOf(Response)
    const res = result as Response
    expect(res.headers.get('location')).toContain('/portal')
  })
})

// ---------------------------------------------------------------------------
// signIn() callback — provider gate
// ---------------------------------------------------------------------------

describe('authConfig.callbacks.signIn — provider gate', () => {
  it('allows credentials provider unconditionally', async () => {
    const result = await authConfig.callbacks.signIn!({
      user: { email: 'anyone@anywhere.com', id: '1' },
      account: { provider: 'credentials', type: 'credentials' } as any,
      profile: undefined,
      credentials: undefined,
      email: undefined,
    })
    expect(result).toBe(true)
  })

  it('allows Entra login with a @genthrust.net email', async () => {
    const result = await authConfig.callbacks.signIn!({
      user: { email: 'user@genthrust.net', id: '2' },
      account: { provider: 'microsoft-entra-id', type: 'oauth' } as any,
      profile: undefined,
      credentials: undefined,
      email: undefined,
    })
    expect(result).toBe(true)
  })

  it('rejects Entra login with a non-genthrust.net email', async () => {
    const result = await authConfig.callbacks.signIn!({
      user: { email: 'attacker@gmail.com', id: '3' },
      account: { provider: 'microsoft-entra-id', type: 'oauth' } as any,
      profile: undefined,
      credentials: undefined,
      email: undefined,
    })
    expect(result).toBe(false)
  })

  it('rejects Entra login when email is missing', async () => {
    const result = await authConfig.callbacks.signIn!({
      user: { email: null, id: '4' } as any,
      account: { provider: 'microsoft-entra-id', type: 'oauth' } as any,
      profile: undefined,
      credentials: undefined,
      email: undefined,
    })
    expect(result).toBe(false)
  })

  it('falls back to profile.preferred_username for Entra profile', async () => {
    const result = await authConfig.callbacks.signIn!({
      user: { id: '5' } as any,
      account: { provider: 'microsoft-entra-id', type: 'oauth' } as any,
      profile: { preferred_username: 'user@genthrust.net' } as any,
      credentials: undefined,
      email: undefined,
    })
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// jwt() callback
// ---------------------------------------------------------------------------

describe('authConfig.callbacks.jwt — token building', () => {
  it('sets role to "client" for credentials provider', async () => {
    const token = {}
    const result = await authConfig.callbacks.jwt!({
      token,
      user: { id: '10', email: 'client@test.com' } as any,
      account: { provider: 'credentials', type: 'credentials' } as any,
      profile: undefined,
      session: undefined,
      trigger: undefined as any,
    })
    expect(result.role).toBe('client')
  })

  it('sets role to "internal" for non-credentials provider', async () => {
    const token = {}
    const result = await authConfig.callbacks.jwt!({
      token,
      user: { id: '20', email: 'staff@genthrust.net' } as any,
      account: { provider: 'microsoft-entra-id', type: 'oauth' } as any,
      profile: undefined,
      session: undefined,
      trigger: undefined as any,
    })
    expect(result.role).toBe('internal')
  })

  it('carries companyId and mfaEnabled from user to token', async () => {
    const token = {}
    const result = await authConfig.callbacks.jwt!({
      token,
      user: { id: '30', email: 'portal@test.com', companyId: 5, mfaEnabled: true } as any,
      account: { provider: 'credentials', type: 'credentials' } as any,
      profile: undefined,
      session: undefined,
      trigger: undefined as any,
    })
    expect(result.companyId).toBe(5)
    expect(result.mfaEnabled).toBe(true)
  })

  it('preserves existing token fields when no user present', async () => {
    const token = { role: 'client', id: '99' }
    const result = await authConfig.callbacks.jwt!({
      token,
      user: undefined as any,
      account: null,
      profile: undefined,
      session: undefined,
      trigger: undefined as any,
    })
    expect(result.role).toBe('client')
    expect(result.id).toBe('99')
  })
})

// ---------------------------------------------------------------------------
// session() callback
// ---------------------------------------------------------------------------

describe('authConfig.callbacks.session — session hydration', () => {
  it('sets role to "internal" from token', async () => {
    const session = { user: { email: 'staff@genthrust.net', id: '', name: '' }, expires: '' }
    const result = await authConfig.callbacks.session!({
      session: session as any,
      token: { role: 'internal', id: '10' } as any,
      user: undefined as any,
      trigger: 'update',
      newSession: undefined,
    })
    expect(result.user.role).toBe('internal')
  })

  it('defaults role to "client" when token role is missing', async () => {
    const session = { user: { email: 'unknown@test.com', id: '' }, expires: '' }
    const result = await authConfig.callbacks.session!({
      session: session as any,
      token: {} as any,
      user: undefined as any,
      trigger: 'update',
      newSession: undefined,
    })
    expect(result.user.role).toBe('client')
  })

  it('never sets role to "internal" for empty/unknown token.role', async () => {
    const session = { user: { email: 'hack@evil.com', id: '' }, expires: '' }
    const result = await authConfig.callbacks.session!({
      session: session as any,
      token: { role: '' } as any,
      user: undefined as any,
      trigger: 'update',
      newSession: undefined,
    })
    expect(result.user.role).toBe('client')
  })

  it('sets companyId and mfaEnabled from token', async () => {
    const session = { user: { email: 'client@test.com', id: '' }, expires: '' }
    const result = await authConfig.callbacks.session!({
      session: session as any,
      token: { role: 'client', companyId: 7, mfaEnabled: false } as any,
      user: undefined as any,
      trigger: 'update',
      newSession: undefined,
    })
    expect((result.user as any).companyId).toBe(7)
    expect((result.user as any).mfaEnabled).toBe(false)
  })
})
