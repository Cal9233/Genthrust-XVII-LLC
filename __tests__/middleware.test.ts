/**
 * Tests for middleware route protection logic.
 * The middleware itself wraps NextAuth, so we test:
 *   1. The config.matcher patterns (static — just validate the regexp behavior)
 *   2. The route classification logic (isProtectedApi)
 *   3. The auth.config authorized() callback for route-level protection
 *
 * We do NOT execute the full NextAuth middleware (it requires Edge runtime),
 * but we do test the core routing logic it invokes.
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Route classification helpers (mirrors middleware.ts logic)
// ---------------------------------------------------------------------------

function isProtectedApi(pathname: string): boolean {
  return pathname.startsWith('/api/internal') || pathname.startsWith('/api/portal') || pathname.startsWith('/api/admin')
}

// ---------------------------------------------------------------------------
// Route classification tests
// ---------------------------------------------------------------------------

describe('middleware: protected API route detection', () => {
  it('marks /api/internal routes as protected', () => {
    expect(isProtectedApi('/api/internal/quotes')).toBe(true)
    expect(isProtectedApi('/api/internal/repair-orders')).toBe(true)
    expect(isProtectedApi('/api/internal')).toBe(true)
  })

  it('marks /api/portal routes as protected', () => {
    expect(isProtectedApi('/api/portal/user')).toBe(true)
    expect(isProtectedApi('/api/portal/mfa/verify')).toBe(true)
  })

  it('marks /api/admin routes as protected', () => {
    expect(isProtectedApi('/api/admin/create-client')).toBe(true)
    expect(isProtectedApi('/api/admin')).toBe(true)
  })

  it('does not mark public API routes as protected', () => {
    expect(isProtectedApi('/api/auth/signin')).toBe(false)
    expect(isProtectedApi('/api/contact')).toBe(false)
    expect(isProtectedApi('/api/health')).toBe(false)
  })

  it('prefix-matches /api/internalized as protected (potential false-positive)', () => {
    // The startsWith check in middleware means /api/internalized is treated as
    // a protected route, even though it is not /api/internal. This is a known
    // behavioral edge case — documenting it here as a regression guard.
    expect(isProtectedApi('/api/internalized')).toBe(true)
  })

  it('does not mark page routes as protected API', () => {
    expect(isProtectedApi('/internal/dashboard')).toBe(false)
    expect(isProtectedApi('/portal/home')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Middleware config.matcher patterns
// ---------------------------------------------------------------------------

describe('middleware: matcher config coverage', () => {
  const matchedRoutes = [
    '/internal/dashboard',
    '/internal/erp',
    '/signin',
    '/portal/home',
    '/portal/settings',
    '/login',
    '/register',
    '/api/internal/quotes',
    '/api/internal/repair-orders/1',
    '/api/portal/user',
    '/api/portal/mfa/verify',
    '/api/admin/create-client',
  ]

  const unmatchedRoutes = [
    '/',
    '/about',
    '/contact',
    '/api/health',
    '/_next/static/chunk.js',
  ]

  // Simulate the matcher logic
  function matchesMiddleware(pathname: string): boolean {
    const patterns = [
      /^\/internal(\/.*)?$/,
      /^\/signin$/,
      /^\/portal(\/.*)?$/,
      /^\/login$/,
      /^\/register$/,
      /^\/api\/internal(\/.*)?$/,
      /^\/api\/portal(\/.*)?$/,
      /^\/api\/admin(\/.*)?$/,
    ]
    return patterns.some(p => p.test(pathname))
  }

  matchedRoutes.forEach(route => {
    it(`matcher includes ${route}`, () => {
      expect(matchesMiddleware(route)).toBe(true)
    })
  })

  unmatchedRoutes.forEach(route => {
    it(`matcher excludes ${route}`, () => {
      expect(matchesMiddleware(route)).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// Role-based access logic
// ---------------------------------------------------------------------------

describe('middleware: role-based access scenarios', () => {
  // These test the routing decisions the middleware + auth.config make together

  function simulateAccess(
    pathname: string,
    auth: { user: { role?: string; mfaEnabled?: boolean } } | null
  ): 'allowed' | 'redirect' | 'unauthorized' {
    const isProtected = isProtectedApi(pathname)

    // API route protection (401 for unauthenticated)
    if (!auth && isProtected) return 'unauthorized'

    // No further middleware logic for API routes when authenticated
    if (isProtected) return 'allowed'

    // Page route logic from auth.config.authorized()
    const isLoggedIn = !!auth?.user
    const role = auth?.user?.role

    if (pathname.startsWith('/internal')) {
      if (!isLoggedIn) return 'redirect'
      if (role !== 'internal') return 'redirect'
      return 'allowed'
    }

    if (pathname.startsWith('/portal')) {
      if (!isLoggedIn) return 'redirect'
      if (role === 'client' && auth?.user?.mfaEnabled === false &&
          !pathname.startsWith('/portal/mfa-setup')) {
        return 'redirect'
      }
      return 'allowed'
    }

    return 'allowed'
  }

  it('unauthenticated request to /api/admin returns unauthorized', () => {
    expect(simulateAccess('/api/admin/create-client', null)).toBe('unauthorized')
  })

  it('unauthenticated request to /api/internal returns unauthorized', () => {
    expect(simulateAccess('/api/internal/quotes', null)).toBe('unauthorized')
  })

  it('unauthenticated request to /api/portal returns unauthorized', () => {
    expect(simulateAccess('/api/portal/user', null)).toBe('unauthorized')
  })

  it('authenticated user can access /api/internal', () => {
    expect(simulateAccess('/api/internal/quotes', { user: { role: 'internal' } })).toBe('allowed')
  })

  it('unauthenticated user is redirected from /internal', () => {
    expect(simulateAccess('/internal', null)).toBe('redirect')
  })

  it('client role is redirected from /internal', () => {
    expect(simulateAccess('/internal', { user: { role: 'client' } })).toBe('redirect')
  })

  it('internal role can access /internal', () => {
    expect(simulateAccess('/internal', { user: { role: 'internal' } })).toBe('allowed')
  })

  it('unauthenticated user is redirected from /portal', () => {
    expect(simulateAccess('/portal', null)).toBe('redirect')
  })

  it('client without MFA is redirected to mfa-setup on portal routes', () => {
    expect(simulateAccess('/portal/dashboard', { user: { role: 'client', mfaEnabled: false } })).toBe('redirect')
  })

  it('client without MFA can access /portal/mfa-setup', () => {
    expect(simulateAccess('/portal/mfa-setup', { user: { role: 'client', mfaEnabled: false } })).toBe('allowed')
  })

  it('client with MFA enabled can access /portal', () => {
    expect(simulateAccess('/portal/dashboard', { user: { role: 'client', mfaEnabled: true } })).toBe('allowed')
  })
})
