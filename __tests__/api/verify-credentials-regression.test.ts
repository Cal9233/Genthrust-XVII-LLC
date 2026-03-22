/**
 * Regression tests for verify-credentials route (C-6: rate limiter fix)
 * Verifies: record on failure only, reset on success, 429 when limited.
 *
 * The createRateLimiter module is mocked so tests are fully deterministic
 * and do not depend on timing or in-process state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Track the mock limiter methods so we can assert on them
const mockCheck = vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
const mockRecord = vi.fn()
const mockReset = vi.fn()

vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({
    check: mockCheck,
    record: mockRecord,
    reset: mockReset,
  })),
}))

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

vi.mock('@/lib/password', () => ({
  verifyPassword: vi.fn(),
}))

vi.mock('@/lib/mfa', () => ({
  createMfaChallengeToken: vi.fn().mockReturnValue('mock-mfa-token'),
}))

// audit-logger is imported by rate-limit; mock to avoid DB dependency
vi.mock('@/lib/audit-logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  ACTION_TYPES: { RATE_LIMITED: 'RATE_LIMITED' },
}))

import { query } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

function makeRequest(body: Record<string, unknown>, ip = '1.2.3.4'): Request {
  return new Request('http://localhost/api/auth/verify-credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/verify-credentials — rate limiter regression (C-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheck.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
  })

  it('returns 429 when rate limited', async () => {
    mockCheck.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })
    const { POST } = await import('@/app/api/auth/verify-credentials/route')
    const res = await POST(makeRequest({ email: 'test@test.com', password: 'pass' }))
    expect(res.status).toBe(429)
  })

  it('records failure when user not found', async () => {
    vi.mocked(query).mockResolvedValueOnce([]) // no user
    const { POST } = await import('@/app/api/auth/verify-credentials/route')
    const res = await POST(makeRequest({ email: 'unknown@test.com', password: 'pass' }))
    expect(res.status).toBe(401)
    expect(mockRecord).toHaveBeenCalledWith('1.2.3.4:unknown@test.com')
  })

  it('records failure when password is wrong', async () => {
    vi.mocked(query).mockResolvedValueOnce([
      { id: 1, email: 'test@co.com', password_hash: 'hash', mfa_enabled: 0 },
    ])
    vi.mocked(verifyPassword).mockResolvedValue(false)
    const { POST } = await import('@/app/api/auth/verify-credentials/route')
    const res = await POST(makeRequest({ email: 'test@co.com', password: 'wrong' }))
    expect(res.status).toBe(401)
    expect(mockRecord).toHaveBeenCalledWith('1.2.3.4:test@co.com')
  })

  it('resets counter on successful authentication (no MFA)', async () => {
    vi.mocked(query).mockResolvedValueOnce([
      { id: 1, email: 'ok@co.com', password_hash: 'hash', mfa_enabled: 0 },
    ])
    vi.mocked(verifyPassword).mockResolvedValue(true)
    const { POST } = await import('@/app/api/auth/verify-credentials/route')
    const res = await POST(makeRequest({ email: 'ok@co.com', password: 'correct' }))
    expect(res.status).toBe(200)
    expect(mockReset).toHaveBeenCalledWith('1.2.3.4:ok@co.com')
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('resets counter on successful authentication (with MFA)', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ id: 1, email: 'mfa@co.com', password_hash: 'hash', mfa_enabled: 1 }])
      .mockResolvedValueOnce([{ id: 10 }]) // verified factor exists
    vi.mocked(verifyPassword).mockResolvedValue(true)
    const { POST } = await import('@/app/api/auth/verify-credentials/route')
    const res = await POST(makeRequest({ email: 'mfa@co.com', password: 'correct' }))
    expect(res.status).toBe(200)
    expect(mockReset).toHaveBeenCalledWith('1.2.3.4:mfa@co.com')
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('does not record a failure when rate-limited (check is the gate)', async () => {
    mockCheck.mockReturnValue({ allowed: false, retryAfterSeconds: 60 })
    const { POST } = await import('@/app/api/auth/verify-credentials/route')
    await POST(makeRequest({ email: 'blocked@test.com', password: 'any' }))
    // record() should never be called — the request was short-circuited at check()
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('does not call reset when the request fails validation (bad email format)', async () => {
    const { POST } = await import('@/app/api/auth/verify-credentials/route')
    const res = await POST(makeRequest({ email: 'not-an-email', password: 'pass' }))
    expect(res.status).toBe(400)
    expect(mockReset).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
  })
})
