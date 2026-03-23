import crypto from 'crypto'
import { vi } from 'vitest'

const TEST_SECRET = 'test-secret-key-for-sso-redirect-testing-1234567890'

// Mock auth before importing route
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/auth'
import { GET } from '@/app/api/internal/sso/flightdeck/route'

const mockAuth = vi.mocked(auth)

describe('GET /api/internal/sso/flightdeck', () => {
  beforeEach(() => {
    process.env.SSO_REDIRECT_SECRET = TEST_SECRET
    process.env.ENTRA_TENANT_ID = 'test-tenant-id'
    mockAuth.mockReset()
  })

  afterEach(() => {
    delete process.env.SSO_REDIRECT_SECRET
    delete process.env.ENTRA_TENANT_ID
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any)
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when session has no user', async () => {
    mockAuth.mockResolvedValue({ user: null } as any)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({
      user: { email: 'client@example.com', name: 'Client', role: 'client' },
    } as any)
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when role is missing', async () => {
    mockAuth.mockResolvedValue({
      user: { email: 'user@example.com', name: 'User' },
    } as any)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 401 when email is null', async () => {
    mockAuth.mockResolvedValue({
      user: { email: null, name: 'Internal User', role: 'internal' },
    } as any)
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Incomplete session')
  })

  it('returns 401 when name is null', async () => {
    mockAuth.mockResolvedValue({
      user: { email: 'user@genthrust.net', name: null, role: 'internal' },
    } as any)
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Incomplete session')
  })

  it('redirects admin users to FlightDeck SSO endpoint', async () => {
    mockAuth.mockResolvedValue({
      // cal@genthrust.net has role='admin' in the 3-role system
      user: { email: 'cal@genthrust.net', name: 'Cal Malagon', role: 'admin' },
    } as any)

    const res = await GET()
    // NextResponse.redirect returns 307 by default
    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toBeTruthy()
    expect(location).toContain(
      'https://app.genthrust.org/api/auth/sso-redirect?token='
    )
  })

  it('redirect URL contains a valid JWT with correct claims (admin → role=owner)', async () => {
    mockAuth.mockResolvedValue({
      // Admin role maps to FlightDeck role='owner'
      user: { email: 'cal@genthrust.net', name: 'Cal Malagon', role: 'admin' },
    } as any)

    const res = await GET()
    const location = res.headers.get('location')!
    const url = new URL(location)
    const token = url.searchParams.get('token')!

    // Token should be 3-part JWT
    const parts = token.split('.')
    expect(parts).toHaveLength(3)

    // Verify payload claims
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    expect(payload.email).toBe('cal@genthrust.net')
    expect(payload.name).toBe('Cal Malagon')
    expect(payload.role).toBe('owner')
    expect(payload.tenantId).toBe('test-tenant-id')
    expect(typeof payload.iat).toBe('number')
  })

  it('redirect URL contains a correctly signed JWT', async () => {
    mockAuth.mockResolvedValue({
      user: { email: 'cal@genthrust.net', name: 'Cal Malagon', role: 'admin' },
    } as any)

    const res = await GET()
    const location = res.headers.get('location')!
    const url = new URL(location)
    const token = url.searchParams.get('token')!
    const [headerB64, payloadB64, signatureB64] = token.split('.')

    // Independently verify HMAC signature
    const expected = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url')

    expect(signatureB64).toBe(expected)
  })

  it('redirect includes default redirect=/ parameter', async () => {
    mockAuth.mockResolvedValue({
      user: { email: 'cal@genthrust.net', name: 'Cal Malagon', role: 'admin' },
    } as any)

    const res = await GET()
    const location = res.headers.get('location')!
    const url = new URL(location)
    expect(url.searchParams.get('redirect')).toBe('/')
  })
})
