/**
 * Tests for the four MFA API routes:
 *   POST /api/portal/mfa/enroll
 *   POST /api/portal/mfa/verify
 *   POST /api/portal/mfa/disable
 *   GET  /api/portal/mfa/status
 *
 * All DB, auth, MFA crypto, and rate-limiter calls are mocked so tests are
 * deterministic and never touch a real database or TOTP library.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — declared before any import that resolves them
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
  ACTION_TYPES: {
    MFA_ENROLL: 'MFA_ENROLL',
    MFA_VERIFY: 'MFA_VERIFY',
    MFA_DISABLE: 'MFA_DISABLE',
  },
  RESOURCE_TYPES: { MFA: 'MFA', USER: 'USER' },
}))

const mockRateLimiterCheck = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
const mockRateLimiterRecord = vi.fn().mockResolvedValue(undefined)
const mockRateLimiterReset = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => ({
    check: mockRateLimiterCheck,
    record: mockRateLimiterRecord,
    reset: mockRateLimiterReset,
  }),
}))

const mockGenerateTotpSecret = vi.fn()
const mockEncryptSecret = vi.fn()
const mockGenerateQrCodeDataUrl = vi.fn()
const mockDecryptSecret = vi.fn()
const mockVerifyTotpCode = vi.fn()
const mockGenerateRecoveryCodes = vi.fn()
vi.mock('@/lib/mfa', () => ({
  generateTotpSecret: mockGenerateTotpSecret,
  encryptSecret: mockEncryptSecret,
  generateQrCodeDataUrl: mockGenerateQrCodeDataUrl,
  decryptSecret: mockDecryptSecret,
  verifyTotpCode: mockVerifyTotpCode,
  generateRecoveryCodes: mockGenerateRecoveryCodes,
}))

// bcrypt is used only in verify/disable routes; mock it to avoid real hashing
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$hashed$'),
    compare: vi.fn().mockResolvedValue(false),
  },
  hash: vi.fn().mockResolvedValue('$hashed$'),
  compare: vi.fn().mockResolvedValue(false),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(role = 'client', overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: '42',
      email: 'test@genthrust.net',
      role,
      companyId: 1,
      ...overrides,
    },
  }
}

function makeRequest(body: unknown, method = 'POST') {
  return new Request('http://localhost/api/portal/mfa', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// POST /api/portal/mfa/enroll
// ---------------------------------------------------------------------------

describe('POST /api/portal/mfa/enroll', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockGenerateTotpSecret.mockReset()
    mockEncryptSecret.mockReset()
    mockGenerateQrCodeDataUrl.mockReset()
  })

  it('returns 401 when unauthenticated (no session)', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/portal/mfa/enroll/route')
    const res = await POST()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when session role is not "client"', async () => {
    mockAuth.mockResolvedValue(makeSession('internal'))
    const { POST } = await import('@/app/api/portal/mfa/enroll/route')
    const res = await POST()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 for admin role', async () => {
    mockAuth.mockResolvedValue(makeSession('admin'))
    const { POST } = await import('@/app/api/portal/mfa/enroll/route')
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('generates QR code and returns qrCodeUrl on success', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    // soft-delete pending + INSERT
    mockQuery.mockResolvedValue({ affectedRows: 0, insertId: 0 })
    mockGenerateTotpSecret.mockReturnValue({
      secret: 'BASE32SECRET',
      uri: 'otpauth://totp/test',
    })
    mockEncryptSecret.mockReturnValue({
      encrypted: 'enc',
      iv: 'iv',
      authTag: 'tag',
    })
    mockGenerateQrCodeDataUrl.mockResolvedValue('data:image/png;base64,abc123')

    const { POST } = await import('@/app/api/portal/mfa/enroll/route')
    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.qrCodeUrl).toBe('data:image/png;base64,abc123')
  })

  it('soft-deletes any pending factor before inserting new one', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValue({ affectedRows: 0, insertId: 0 })
    mockGenerateTotpSecret.mockReturnValue({ secret: 'S', uri: 'otpauth://totp/x' })
    mockEncryptSecret.mockReturnValue({ encrypted: 'e', iv: 'i', authTag: 't' })
    mockGenerateQrCodeDataUrl.mockResolvedValue('data:image/png;base64,qr')

    const { POST } = await import('@/app/api/portal/mfa/enroll/route')
    await POST()

    // First query should be the soft-delete UPDATE
    expect(mockQuery).toHaveBeenCalled()
    const [firstSql] = mockQuery.mock.calls[0]
    expect(firstSql.toLowerCase()).toContain('update mfa_factors')
    expect(firstSql.toLowerCase()).toContain('deleted_at')
  })

  it('does not expose the raw TOTP secret in the response', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValue({ affectedRows: 0, insertId: 0 })
    mockGenerateTotpSecret.mockReturnValue({ secret: 'SECRETVALUE', uri: 'otpauth://totp/x' })
    mockEncryptSecret.mockReturnValue({ encrypted: 'e', iv: 'i', authTag: 't' })
    mockGenerateQrCodeDataUrl.mockResolvedValue('data:image/png;base64,qr')

    const { POST } = await import('@/app/api/portal/mfa/enroll/route')
    const res = await POST()
    const body = await res.json()

    expect(body).not.toHaveProperty('secret')
    expect(JSON.stringify(body)).not.toContain('SECRETVALUE')
  })
})

// ---------------------------------------------------------------------------
// POST /api/portal/mfa/verify
// ---------------------------------------------------------------------------

describe('POST /api/portal/mfa/verify', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockVerifyTotpCode.mockReset()
    mockDecryptSecret.mockReset()
    mockGenerateRecoveryCodes.mockReset()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
    mockRateLimiterReset.mockResolvedValue(undefined)
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/portal/mfa/verify/route')
    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when role is not "client"', async () => {
    mockAuth.mockResolvedValue(makeSession('internal'))
    const { POST } = await import('@/app/api/portal/mfa/verify/route')
    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when code is missing from body', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    const { POST } = await import('@/app/api/portal/mfa/verify/route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Code is required')
  })

  it('returns 400 when code is not a string', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    const { POST } = await import('@/app/api/portal/mfa/verify/route')
    const res = await POST(makeRequest({ code: 123456 }))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate-limited', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockRateLimiterCheck.mockResolvedValue({ allowed: false, retryAfterSeconds: 120 })
    const { POST } = await import('@/app/api/portal/mfa/verify/route')
    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('120')
  })

  it('returns 400 when no pending enrollment factor is found', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([]) // no pending factors
    mockDecryptSecret.mockReturnValue('SECRET')
    const { POST } = await import('@/app/api/portal/mfa/verify/route')
    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No pending enrollment')
  })

  it('returns 400 when TOTP code is invalid', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([{
      id: 7,
      secret_encrypted: 'enc',
      secret_iv: 'iv',
      secret_auth_tag: 'tag',
    }])
    mockDecryptSecret.mockReturnValue('PLAINTEXT_SECRET')
    mockVerifyTotpCode.mockResolvedValue(false)

    const { POST } = await import('@/app/api/portal/mfa/verify/route')
    const res = await POST(makeRequest({ code: '000000' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid code')
    // Must record the failed attempt
    expect(mockRateLimiterRecord).toHaveBeenCalled()
  })

  it('activates factor, sets mfa_enabled=1, returns recoveryCodes on success', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([{
      id: 7,
      secret_encrypted: 'enc',
      secret_iv: 'iv',
      secret_auth_tag: 'tag',
    }])
    mockDecryptSecret.mockReturnValue('PLAINTEXT_SECRET')
    mockVerifyTotpCode.mockResolvedValue(true)
    mockGenerateRecoveryCodes.mockReturnValue(['AAAA-BBBB-CCCC', 'DDDD-EEEE-FFFF'])
    // UPDATE mfa_factors, UPDATE portal_users, DELETE recovery codes, INSERT recovery codes
    mockQuery.mockResolvedValue({ affectedRows: 1, insertId: 0 })

    const { POST } = await import('@/app/api/portal/mfa/verify/route')
    const res = await POST(makeRequest({ code: '654321' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.recoveryCodes)).toBe(true)
    expect(body.recoveryCodes).toHaveLength(2)
    // Rate limit must be reset after success
    expect(mockRateLimiterReset).toHaveBeenCalled()
  })

  it('sets mfa_enabled=1 on portal_users after successful verification', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([{
      id: 7,
      secret_encrypted: 'e',
      secret_iv: 'i',
      secret_auth_tag: 't',
    }])
    mockDecryptSecret.mockReturnValue('S')
    mockVerifyTotpCode.mockResolvedValue(true)
    mockGenerateRecoveryCodes.mockReturnValue(['X'])
    mockQuery.mockResolvedValue({ affectedRows: 1, insertId: 0 })

    const { POST } = await import('@/app/api/portal/mfa/verify/route')
    await POST(makeRequest({ code: '111111' }))

    // Find the query that updates portal_users — mfa_enabled = 1 is in the SQL string
    const updateUserCall = mockQuery.mock.calls.find(
      ([sql]: [string]) => sql.toLowerCase().includes('portal_users') && sql.toLowerCase().includes('mfa_enabled')
    )
    expect(updateUserCall).toBeDefined()
    expect(updateUserCall![0]).toContain('mfa_enabled = 1')
  })
})

// ---------------------------------------------------------------------------
// POST /api/portal/mfa/disable
// ---------------------------------------------------------------------------

describe('POST /api/portal/mfa/disable', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockVerifyTotpCode.mockReset()
    mockDecryptSecret.mockReset()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
    mockRateLimiterReset.mockResolvedValue(undefined)
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/portal/mfa/disable/route')
    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when role is not "client"', async () => {
    mockAuth.mockResolvedValue(makeSession('internal'))
    const { POST } = await import('@/app/api/portal/mfa/disable/route')
    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when code is missing', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    const { POST } = await import('@/app/api/portal/mfa/disable/route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Code is required')
  })

  it('returns 429 when rate-limited', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockRateLimiterCheck.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 })
    const { POST } = await import('@/app/api/portal/mfa/disable/route')
    const res = await POST(makeRequest({ code: '000000' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  it('returns 400 when no verified MFA factor found', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([]) // no verified factors
    const { POST } = await import('@/app/api/portal/mfa/disable/route')
    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No MFA factor found')
  })

  it('returns 400 when TOTP code is invalid and no matching recovery code', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([{
      secret_encrypted: 'enc',
      secret_iv: 'iv',
      secret_auth_tag: 'tag',
    }])
    mockDecryptSecret.mockReturnValue('SECRET')
    mockVerifyTotpCode.mockResolvedValue(false)
    // No recovery codes to check
    mockQuery.mockResolvedValueOnce([])

    const { POST } = await import('@/app/api/portal/mfa/disable/route')
    const res = await POST(makeRequest({ code: 'BAD-CODE-XXXX' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid code')
    expect(mockRateLimiterRecord).toHaveBeenCalled()
  })

  it('disables MFA via valid TOTP code — soft-deletes factor and resets flag', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([{
      secret_encrypted: 'enc',
      secret_iv: 'iv',
      secret_auth_tag: 'tag',
    }])
    mockDecryptSecret.mockReturnValue('SECRET')
    mockVerifyTotpCode.mockResolvedValue(true)
    mockQuery.mockResolvedValue({ affectedRows: 1 })

    const { POST } = await import('@/app/api/portal/mfa/disable/route')
    const res = await POST(makeRequest({ code: '654321' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockRateLimiterReset).toHaveBeenCalled()
  })

  it('sets mfa_enabled=0 on portal_users after disabling', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([{
      secret_encrypted: 'e',
      secret_iv: 'i',
      secret_auth_tag: 't',
    }])
    mockDecryptSecret.mockReturnValue('S')
    mockVerifyTotpCode.mockResolvedValue(true)
    mockQuery.mockResolvedValue({ affectedRows: 1 })

    const { POST } = await import('@/app/api/portal/mfa/disable/route')
    await POST(makeRequest({ code: '777777' }))

    const updateUserCall = mockQuery.mock.calls.find(
      ([sql]: [string]) => sql.toLowerCase().includes('portal_users') && sql.toLowerCase().includes('mfa_enabled')
    )
    expect(updateUserCall).toBeDefined()
    // mfa_enabled = 0 is in the SQL string; the only param is the user id
    expect(updateUserCall![0]).toContain('mfa_enabled = 0')
  })

  it('accepts a valid recovery code when TOTP fails', async () => {
    const bcrypt = await import('bcryptjs')
    const compareMock = vi.mocked(bcrypt.default.compare)
    compareMock.mockResolvedValueOnce(true as never) // first recovery code matches

    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([{
      secret_encrypted: 'enc',
      secret_iv: 'iv',
      secret_auth_tag: 'tag',
    }])
    mockDecryptSecret.mockReturnValue('SECRET')
    mockVerifyTotpCode.mockResolvedValue(false) // TOTP fails
    // Recovery codes lookup
    mockQuery.mockResolvedValueOnce([{ id: 5, code_hash: '$hash$' }])
    // Subsequent UPDATE queries
    mockQuery.mockResolvedValue({ affectedRows: 1 })

    const { POST } = await import('@/app/api/portal/mfa/disable/route')
    const res = await POST(makeRequest({ code: 'AAAA-BBBB-CCCC' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// GET /api/portal/mfa/status
// ---------------------------------------------------------------------------

describe('GET /api/portal/mfa/status', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/portal/mfa/status/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 401 when role is not "client"', async () => {
    mockAuth.mockResolvedValue(makeSession('internal'))
    const { GET } = await import('@/app/api/portal/mfa/status/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns enabled=false when mfa_enabled=0 in DB', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([{ mfa_enabled: 0 }])

    const { GET } = await import('@/app/api/portal/mfa/status/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.enabled).toBe(false)
    expect(body.recoveryCodesRemaining).toBe(0)
  })

  it('returns enabled=true with recovery code count when mfa_enabled=1', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([{ mfa_enabled: 1 }])
    mockQuery.mockResolvedValueOnce([{ count: 8 }])

    const { GET } = await import('@/app/api/portal/mfa/status/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.enabled).toBe(true)
    expect(body.recoveryCodesRemaining).toBe(8)
  })

  it('returns enabled=false when user row is not found in portal_users', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([]) // no row

    const { GET } = await import('@/app/api/portal/mfa/status/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.enabled).toBe(false)
  })

  it('does not query recovery codes when MFA is disabled', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([{ mfa_enabled: 0 }])

    const { GET } = await import('@/app/api/portal/mfa/status/route')
    await GET()

    // Only one query should fire (the portal_users one)
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('queries recovery codes when MFA is enabled', async () => {
    mockAuth.mockResolvedValue(makeSession('client'))
    mockQuery.mockResolvedValueOnce([{ mfa_enabled: 1 }])
    mockQuery.mockResolvedValueOnce([{ count: 10 }])

    const { GET } = await import('@/app/api/portal/mfa/status/route')
    await GET()

    expect(mockQuery).toHaveBeenCalledTimes(2)
    const recoveryQuery = mockQuery.mock.calls[1][0] as string
    expect(recoveryQuery.toLowerCase()).toContain('mfa_recovery_codes')
  })
})
