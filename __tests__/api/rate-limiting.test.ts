/**
 * Tests for lib/rate-limit.ts
 * Verifies window behavior, check/record/reset semantics, and retry-after calculation.
 * Mocks audit-logger to avoid DB dependency.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock audit-logger before importing the module under test
vi.mock('@/lib/audit-logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  ACTION_TYPES: {
    RATE_LIMITED: 'RATE_LIMITED',
  },
}))

import { createRateLimiter } from '@/lib/rate-limit'

describe('createRateLimiter — basic allow/deny', () => {
  it('allows the first request when no history exists', () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })
    const result = limiter.check('user-1')
    expect(result.allowed).toBe(true)
    expect(result.retryAfterSeconds).toBe(0)
  })

  it('allows requests up to maxAttempts', () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })
    limiter.record('user-2')
    limiter.record('user-2')
    const result = limiter.check('user-2')
    expect(result.allowed).toBe(true)
  })

  it('blocks when maxAttempts is reached', () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })
    limiter.record('user-3')
    limiter.record('user-3')
    limiter.record('user-3')
    const result = limiter.check('user-3')
    expect(result.allowed).toBe(false)
  })

  it('blocks after exceeding maxAttempts', () => {
    const limiter = createRateLimiter({ maxAttempts: 2, windowMs: 60_000 })
    limiter.record('user-4')
    limiter.record('user-4')
    limiter.record('user-4') // one over
    const result = limiter.check('user-4')
    expect(result.allowed).toBe(false)
  })
})

describe('createRateLimiter — check does not increment counter', () => {
  it('check without record never blocks', () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })
    for (let i = 0; i < 100; i++) {
      const result = limiter.check('read-only-user')
      expect(result.allowed).toBe(true)
    }
  })
})

describe('createRateLimiter — reset clears the counter', () => {
  it('allows requests again after reset', () => {
    const limiter = createRateLimiter({ maxAttempts: 2, windowMs: 60_000 })
    limiter.record('user-5')
    limiter.record('user-5')
    expect(limiter.check('user-5').allowed).toBe(false)

    limiter.reset('user-5')
    expect(limiter.check('user-5').allowed).toBe(true)
  })

  it('reset on an unknown key is a no-op', () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })
    expect(() => limiter.reset('nonexistent-user')).not.toThrow()
  })
})

describe('createRateLimiter — retryAfterSeconds', () => {
  it('returns a positive retryAfterSeconds when blocked', () => {
    const limiter = createRateLimiter({ maxAttempts: 1, windowMs: 60_000 })
    limiter.record('user-6')
    const result = limiter.check('user-6')
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1)
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('returns 0 retryAfterSeconds when allowed', () => {
    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000 })
    const result = limiter.check('user-7')
    expect(result.retryAfterSeconds).toBe(0)
  })
})

describe('createRateLimiter — window expiry', () => {
  it('allows requests again after the window expires', async () => {
    const limiter = createRateLimiter({ maxAttempts: 1, windowMs: 50 }) // 50ms window
    limiter.record('expiry-user')
    expect(limiter.check('expiry-user').allowed).toBe(false)

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(limiter.check('expiry-user').allowed).toBe(true)
  })
})

describe('createRateLimiter — key isolation', () => {
  it('different keys have independent counters', () => {
    const limiter = createRateLimiter({ maxAttempts: 2, windowMs: 60_000 })
    limiter.record('alpha')
    limiter.record('alpha')
    // alpha is blocked
    expect(limiter.check('alpha').allowed).toBe(false)
    // beta is unaffected
    expect(limiter.check('beta').allowed).toBe(true)
  })
})

describe('createRateLimiter — maxAttempts of 0', () => {
  it('blocks immediately on first check after any record', () => {
    const limiter = createRateLimiter({ maxAttempts: 0, windowMs: 60_000 })
    limiter.record('zero-user')
    expect(limiter.check('zero-user').allowed).toBe(false)
  })
})
