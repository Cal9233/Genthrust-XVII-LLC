import crypto from 'crypto'
import { generateSsoToken, buildFlightDeckSsoUrl } from '@/lib/sso-redirect'

const TEST_SECRET = 'test-secret-key-for-sso-redirect-testing-1234567890'

const TEST_CLAIMS = {
  email: 'cal@genthrust.net',
  name: 'Cal Malagon',
  role: 'owner',
  tenantId: '52596c51-0a48-402a-9c2f-1ae331b2af36',
}

describe('generateSsoToken', () => {
  beforeEach(() => {
    process.env.SSO_REDIRECT_SECRET = TEST_SECRET
  })

  afterEach(() => {
    delete process.env.SSO_REDIRECT_SECRET
  })

  it('generates a valid 3-part JWT', () => {
    const token = generateSsoToken(TEST_CLAIMS)
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
    // All parts should be non-empty base64url strings
    parts.forEach((part) => {
      expect(part.length).toBeGreaterThan(0)
      expect(part).toMatch(/^[A-Za-z0-9_-]+$/)
    })
  })

  it('produces correct HS256 JWT header', () => {
    const token = generateSsoToken(TEST_CLAIMS)
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString())
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' })
  })

  it('includes all claims plus iat in the payload', () => {
    const token = generateSsoToken(TEST_CLAIMS)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    expect(payload.email).toBe(TEST_CLAIMS.email)
    expect(payload.name).toBe(TEST_CLAIMS.name)
    expect(payload.role).toBe(TEST_CLAIMS.role)
    expect(payload.tenantId).toBe(TEST_CLAIMS.tenantId)
    expect(typeof payload.iat).toBe('number')
  })

  it('sets iat to current unix timestamp', () => {
    const before = Math.floor(Date.now() / 1000)
    const token = generateSsoToken(TEST_CLAIMS)
    const after = Math.floor(Date.now() / 1000)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    expect(payload.iat).toBeGreaterThanOrEqual(before)
    expect(payload.iat).toBeLessThanOrEqual(after)
  })

  it('produces a valid HMAC-SHA256 signature', () => {
    const token = generateSsoToken(TEST_CLAIMS)
    const [headerB64, payloadB64, signatureB64] = token.split('.')

    // Independently compute expected signature
    const expected = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url')

    expect(signatureB64).toBe(expected)
  })

  it('produces different signatures with different secrets', () => {
    const token1 = generateSsoToken(TEST_CLAIMS)

    process.env.SSO_REDIRECT_SECRET = 'different-secret-key'
    const token2 = generateSsoToken(TEST_CLAIMS)

    const sig1 = token1.split('.')[2]
    const sig2 = token2.split('.')[2]
    expect(sig1).not.toBe(sig2)
  })

  it('throws when SSO_REDIRECT_SECRET is not set', () => {
    delete process.env.SSO_REDIRECT_SECRET
    expect(() => generateSsoToken(TEST_CLAIMS)).toThrow('SSO_REDIRECT_SECRET is not configured')
  })

  it('throws when SSO_REDIRECT_SECRET is empty string', () => {
    process.env.SSO_REDIRECT_SECRET = ''
    expect(() => generateSsoToken(TEST_CLAIMS)).toThrow('SSO_REDIRECT_SECRET is not configured')
  })

  // Security: verify that claims cannot override iat via spread
  it('uses generated iat even if claims object has extra properties', () => {
    const claimsWithIat = { ...TEST_CLAIMS, iat: 0 } as any
    const token = generateSsoToken(claimsWithIat)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    // iat should be overridden by the generated timestamp, not 0
    expect(payload.iat).toBeGreaterThan(0)
  })

  // Security: note that expiry enforcement is on the FlightDeck receiver side.
  // This JWT intentionally has no `exp` claim — FlightDeck checks iat + 60s window.
  it('does not include exp claim (expiry enforced by receiver)', () => {
    const token = generateSsoToken(TEST_CLAIMS)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    expect(payload.exp).toBeUndefined()
  })

  it('handles long email and name strings', () => {
    const longClaims = {
      ...TEST_CLAIMS,
      email: 'a'.repeat(200) + '@genthrust.net',
      name: 'A'.repeat(300),
    }
    const token = generateSsoToken(longClaims)
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    expect(payload.email).toBe(longClaims.email)
    expect(payload.name).toBe(longClaims.name)
  })
})

describe('buildFlightDeckSsoUrl', () => {
  it('builds correct URL with default redirect', () => {
    const url = buildFlightDeckSsoUrl('test-token')
    expect(url).toBe(
      'https://workspace-cals-projects-8137565b.vercel.app/api/auth/sso-redirect?token=test-token&redirect=%2F'
    )
  })

  it('builds correct URL with custom redirect', () => {
    const url = buildFlightDeckSsoUrl('test-token', '/dashboard')
    expect(url).toBe(
      'https://workspace-cals-projects-8137565b.vercel.app/api/auth/sso-redirect?token=test-token&redirect=%2Fdashboard'
    )
  })

  it('encodes special characters in token', () => {
    const url = buildFlightDeckSsoUrl('token+with/special=chars')
    expect(url).toContain('token=token%2Bwith%2Fspecial%3Dchars')
  })
})
