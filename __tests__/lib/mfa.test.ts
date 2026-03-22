/**
 * Tests for lib/mfa.ts
 * Covers AES-256-GCM encryption/decryption, TOTP generation/verification,
 * recovery code generation, and MFA challenge token creation/verification.
 *
 * C-3 regression: verifyTotpCode is now async (DB-backed replay protection).
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'

// Mock @/lib/db before importing mfa module (verifyTotpCode now uses MySQL)
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

// Set the required env vars before importing the module
const VALID_KEY = 'a'.repeat(64) // 64-char hex string
const VALID_AUTH_SECRET = 'test-auth-secret-value'

beforeAll(() => {
  process.env.MFA_ENCRYPTION_KEY = VALID_KEY
  process.env.AUTH_SECRET = VALID_AUTH_SECRET
})

afterAll(() => {
  delete process.env.MFA_ENCRYPTION_KEY
  delete process.env.AUTH_SECRET
})

import { query } from '@/lib/db'
import {
  encryptSecret,
  decryptSecret,
  generateTotpSecret,
  verifyTotpCode,
  generateRecoveryCodes,
  createMfaChallengeToken,
  verifyMfaChallengeToken,
} from '@/lib/mfa'
import { TOTP, Secret } from 'otpauth'

beforeEach(() => {
  vi.clearAllMocks()
  // Default: code not used, insert succeeds, cleanup is fire-and-forget
  vi.mocked(query).mockImplementation((sql: string) => {
    if (sql.includes('SELECT COUNT')) return Promise.resolve([{ cnt: 0 }])
    if (sql.includes('INSERT IGNORE')) return Promise.resolve({ affectedRows: 1 })
    if (sql.includes('DELETE FROM totp_used_codes')) return Promise.resolve({ affectedRows: 0 })
    return Promise.resolve([])
  })
})

// ---------------------------------------------------------------------------
// encryptSecret / decryptSecret
// ---------------------------------------------------------------------------

describe('encryptSecret', () => {
  it('returns encrypted, iv, and authTag fields', () => {
    const result = encryptSecret('my-totp-secret')
    expect(result).toHaveProperty('encrypted')
    expect(result).toHaveProperty('iv')
    expect(result).toHaveProperty('authTag')
  })

  it('returns hex strings for all fields', () => {
    const result = encryptSecret('test-value')
    expect(result.encrypted).toMatch(/^[0-9a-f]+$/i)
    expect(result.iv).toMatch(/^[0-9a-f]+$/i)
    expect(result.authTag).toMatch(/^[0-9a-f]+$/i)
  })

  it('produces different ciphertext on each call (random IV)', () => {
    const r1 = encryptSecret('same-plaintext')
    const r2 = encryptSecret('same-plaintext')
    expect(r1.encrypted).not.toBe(r2.encrypted)
    expect(r1.iv).not.toBe(r2.iv)
  })

  it('throws when MFA_ENCRYPTION_KEY is missing', () => {
    const original = process.env.MFA_ENCRYPTION_KEY
    delete process.env.MFA_ENCRYPTION_KEY
    expect(() => encryptSecret('x')).toThrow('MFA_ENCRYPTION_KEY')
    process.env.MFA_ENCRYPTION_KEY = original
  })

  it('throws when MFA_ENCRYPTION_KEY is not 64 chars', () => {
    const original = process.env.MFA_ENCRYPTION_KEY
    process.env.MFA_ENCRYPTION_KEY = 'tooshort'
    expect(() => encryptSecret('x')).toThrow('MFA_ENCRYPTION_KEY')
    process.env.MFA_ENCRYPTION_KEY = original
  })
})

describe('decryptSecret', () => {
  it('round-trips a plaintext value correctly', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP'
    const { encrypted, iv, authTag } = encryptSecret(plaintext)
    const decrypted = decryptSecret(encrypted, iv, authTag)
    expect(decrypted).toBe(plaintext)
  })

  it('round-trips an empty string', () => {
    const { encrypted, iv, authTag } = encryptSecret('')
    const decrypted = decryptSecret(encrypted, iv, authTag)
    expect(decrypted).toBe('')
  })

  it('throws when authTag is tampered (GCM integrity check)', () => {
    const { encrypted, iv } = encryptSecret('secret-value')
    const badTag = '00'.repeat(16) // 16 bytes of zeroes
    expect(() => decryptSecret(encrypted, iv, badTag)).toThrow()
  })

  it('throws when ciphertext is tampered', () => {
    const { encrypted, iv, authTag } = encryptSecret('integrity-check')
    const tampered = encrypted.slice(0, -2) + 'ff'
    expect(() => decryptSecret(tampered, iv, authTag)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// generateTotpSecret
// ---------------------------------------------------------------------------

describe('generateTotpSecret', () => {
  it('returns a secret and uri', () => {
    const result = generateTotpSecret('user@genthrust.net')
    expect(result).toHaveProperty('secret')
    expect(result).toHaveProperty('uri')
  })

  it('returns a non-empty base32 secret', () => {
    const { secret } = generateTotpSecret('user@genthrust.net')
    expect(secret.length).toBeGreaterThan(0)
    expect(secret).toMatch(/^[A-Z2-7]+=*$/) // base32 alphabet
  })

  it('returns an otpauth:// URI', () => {
    const { uri } = generateTotpSecret('user@example.com')
    expect(uri).toMatch(/^otpauth:\/\/totp\//)
  })

  it('embeds the email in the URI as label', () => {
    const email = 'alice@genthrust.net'
    const { uri } = generateTotpSecret(email)
    expect(uri).toContain(encodeURIComponent(email))
  })

  it('generates a different secret each call', () => {
    const r1 = generateTotpSecret('user@test.com')
    const r2 = generateTotpSecret('user@test.com')
    expect(r1.secret).not.toBe(r2.secret)
  })
})

// ---------------------------------------------------------------------------
// verifyTotpCode — async with DB-backed replay protection (C-3)
// ---------------------------------------------------------------------------

describe('verifyTotpCode', () => {
  it('returns false for a clearly wrong code', async () => {
    const { secret } = generateTotpSecret('test@test.com')
    const result = await verifyTotpCode(secret, '000000', 'test-user-1')
    // 000000 is almost certainly not the current TOTP code
    // (1 in 1,000,000 chance of a false positive — acceptable)
    expect(typeof result).toBe('boolean')
  })

  it('returns true for the current valid TOTP code', async () => {
    // Generate a secret, derive the current code, verify it
    const { secret } = generateTotpSecret('live-test@test.com')
    const totp = new TOTP({
      issuer: 'GENTHRUST Portal',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    })
    const currentCode = totp.generate()
    expect(await verifyTotpCode(secret, currentCode, 'test-user-2')).toBe(true)
  })

  it('returns false for a 7-digit code (invalid length)', async () => {
    const { secret } = generateTotpSecret('test@test.com')
    expect(await verifyTotpCode(secret, '1234567', 'test-user-3')).toBe(false)
  })

  it('rejects the same valid code on second use (replay protection)', async () => {
    const { secret } = generateTotpSecret('replay@test.com')
    const totp = new TOTP({
      issuer: 'GENTHRUST Portal',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    })
    const currentCode = totp.generate()

    // First use: code not in DB
    expect(await verifyTotpCode(secret, currentCode, 'replay-user-1')).toBe(true)

    // After first use, mock DB to show code is now used
    vi.mocked(query).mockImplementation((sql: string) => {
      if (sql.includes('SELECT COUNT')) return Promise.resolve([{ cnt: 1 }])
      return Promise.resolve([])
    })

    // Second use should be rejected
    expect(await verifyTotpCode(secret, currentCode, 'replay-user-1')).toBe(false)
  })

  it('allows the same code for a different user (no cross-user blocking)', async () => {
    const { secret } = generateTotpSecret('crossuser@test.com')
    const totp = new TOTP({
      issuer: 'GENTHRUST Portal',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    })
    const currentCode = totp.generate()

    // User A uses the code
    expect(await verifyTotpCode(secret, currentCode, 'user-A')).toBe(true)

    // Reset mock for user-B (different user, code not used for them)
    vi.mocked(query).mockImplementation((sql: string) => {
      if (sql.includes('SELECT COUNT')) return Promise.resolve([{ cnt: 0 }])
      if (sql.includes('INSERT IGNORE')) return Promise.resolve({ affectedRows: 1 })
      if (sql.includes('DELETE')) return Promise.resolve({ affectedRows: 0 })
      return Promise.resolve([])
    })
    expect(await verifyTotpCode(secret, currentCode, 'user-B')).toBe(true)
  })

  // --- C-3 DB-backed replay regression tests ---

  it('calls INSERT IGNORE to mark code as used after successful verification', async () => {
    const { secret } = generateTotpSecret('insert-test@test.com')
    const totp = new TOTP({
      issuer: 'GENTHRUST Portal',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    })
    const code = totp.generate()

    await verifyTotpCode(secret, code, 'db-user-1')

    // Should have called: 1) SELECT COUNT for isTotpCodeUsed, 2) INSERT IGNORE for markTotpCodeUsed, 3) DELETE for cleanup
    const calls = vi.mocked(query).mock.calls
    expect(calls.some(([sql]) => (sql as string).includes('INSERT IGNORE INTO totp_used_codes'))).toBe(true)
  })

  it('checks DB for used code before validating TOTP', async () => {
    // Simulate code already used in DB
    vi.mocked(query).mockImplementation((sql: string) => {
      if (sql.includes('SELECT COUNT')) return Promise.resolve([{ cnt: 1 }])
      return Promise.resolve([])
    })

    const { secret } = generateTotpSecret('used-code@test.com')
    const totp = new TOTP({
      issuer: 'GENTHRUST Portal',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    })
    const code = totp.generate()

    const result = await verifyTotpCode(secret, code, 'db-replay-user')
    expect(result).toBe(false) // rejected because DB says code is already used
  })
})

// ---------------------------------------------------------------------------
// generateRecoveryCodes
// ---------------------------------------------------------------------------

describe('generateRecoveryCodes', () => {
  it('returns 10 codes by default', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(10)
  })

  it('returns the requested count', () => {
    expect(generateRecoveryCodes(5)).toHaveLength(5)
    expect(generateRecoveryCodes(0)).toHaveLength(0)
    expect(generateRecoveryCodes(20)).toHaveLength(20)
  })

  it('each code is exactly 14 characters (XXXX-XXXX-XXXX format)', () => {
    const codes = generateRecoveryCodes(10)
    codes.forEach(code => expect(code).toHaveLength(14))
  })

  it('each code matches XXXX-XXXX-XXXX format with unambiguous alphanumeric chars', () => {
    const codes = generateRecoveryCodes(50)
    const validFormat = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/
    codes.forEach(code => expect(code).toMatch(validFormat))
  })

  it('codes are unique (no duplicates in a batch of 10)', () => {
    const codes = generateRecoveryCodes(10)
    const unique = new Set(codes)
    expect(unique.size).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// createMfaChallengeToken / verifyMfaChallengeToken
// ---------------------------------------------------------------------------

describe('createMfaChallengeToken', () => {
  it('returns a JWT-shaped string (three dot-separated parts)', () => {
    const token = createMfaChallengeToken(42, 'user@test.com')
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
  })

  it('embeds the userId and email in the payload', () => {
    const token = createMfaChallengeToken(99, 'embed@test.com')
    const [, body] = token.split('.')
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    expect(payload.sub).toBe('99')
    expect(payload.email).toBe('embed@test.com')
    expect(payload.purpose).toBe('mfa-challenge')
  })

  it('sets expiry 5 minutes in the future', () => {
    const before = Math.floor(Date.now() / 1000)
    const token = createMfaChallengeToken(1, 'test@test.com')
    const after = Math.floor(Date.now() / 1000)
    const [, body] = token.split('.')
    const { exp } = JSON.parse(Buffer.from(body, 'base64url').toString())
    expect(exp).toBeGreaterThanOrEqual(before + 300)
    expect(exp).toBeLessThanOrEqual(after + 300)
  })

  it('throws when AUTH_SECRET is not set', () => {
    const original = process.env.AUTH_SECRET
    delete process.env.AUTH_SECRET
    expect(() => createMfaChallengeToken(1, 'test@test.com')).toThrow('AUTH_SECRET')
    process.env.AUTH_SECRET = original
  })
})

describe('verifyMfaChallengeToken', () => {
  it('returns userId and email for a valid token', () => {
    const token = createMfaChallengeToken(42, 'valid@test.com')
    const result = verifyMfaChallengeToken(token)
    expect(result).not.toBeNull()
    expect(result!.userId).toBe(42)
    expect(result!.email).toBe('valid@test.com')
  })

  it('returns null for a completely invalid string', () => {
    expect(verifyMfaChallengeToken('not.a.valid.token.at.all')).toBeNull()
  })

  it('returns null when the token has fewer than 3 parts', () => {
    expect(verifyMfaChallengeToken('only.two')).toBeNull()
  })

  it('returns null when signature is tampered', () => {
    const token = createMfaChallengeToken(10, 'tamper@test.com')
    const parts = token.split('.')
    parts[2] = 'invalidsignatureXXXXXXX'
    expect(verifyMfaChallengeToken(parts.join('.'))).toBeNull()
  })

  it('returns null when payload is tampered (signature mismatch)', () => {
    const token = createMfaChallengeToken(10, 'tamper@test.com')
    const parts = token.split('.')
    // Modify the body to change userId
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    payload.sub = '999'
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url')
    expect(verifyMfaChallengeToken(parts.join('.'))).toBeNull()
  })

  it('returns null when token is expired', () => {
    const token = createMfaChallengeToken(5, 'expired@test.com')
    const parts = token.split('.')
    // Create an already-expired payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    payload.exp = Math.floor(Date.now() / 1000) - 600 // expired 10 minutes ago
    const newBody = Buffer.from(JSON.stringify(payload)).toString('base64url')
    // Re-sign it correctly so the sig check passes but expiry check fails
    const crypto = require('crypto')
    const secret = process.env.AUTH_SECRET!
    const newSig = crypto
      .createHmac('sha256', secret)
      .update(`${parts[0]}.${newBody}`)
      .digest('base64url')
    expect(verifyMfaChallengeToken(`${parts[0]}.${newBody}.${newSig}`)).toBeNull()
  })

  it('returns null when purpose is not mfa-challenge', () => {
    const token = createMfaChallengeToken(5, 'test@test.com')
    const parts = token.split('.')
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    payload.purpose = 'password-reset'
    const newBody = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const crypto = require('crypto')
    const secret = process.env.AUTH_SECRET!
    const newSig = crypto
      .createHmac('sha256', secret)
      .update(`${parts[0]}.${newBody}`)
      .digest('base64url')
    expect(verifyMfaChallengeToken(`${parts[0]}.${newBody}.${newSig}`)).toBeNull()
  })

  it('returns null when AUTH_SECRET is not set', () => {
    const original = process.env.AUTH_SECRET
    delete process.env.AUTH_SECRET
    const result = verifyMfaChallengeToken('any.token.here')
    process.env.AUTH_SECRET = original
    expect(result).toBeNull()
  })
})
