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
  it('allows the first request when no history exists', async () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })
    const result = await limiter.check('user-1')
    expect(result.allowed).toBe(true)
    expect(result.retryAfterSeconds).toBe(0)
  })

  it('allows requests up to maxAttempts', async () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })
    await limiter.record('user-2')
    await limiter.record('user-2')
    const result = await limiter.check('user-2')
    expect(result.allowed).toBe(true)
  })

  it('blocks when maxAttempts is reached', async () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })
    await limiter.record('user-3')
    await limiter.record('user-3')
    await limiter.record('user-3')
    const result = await limiter.check('user-3')
    expect(result.allowed).toBe(false)
  })

  it('blocks after exceeding maxAttempts', async () => {
    const limiter = createRateLimiter({ maxAttempts: 2, windowMs: 60_000 })
    await limiter.record('user-4')
    await limiter.record('user-4')
    await limiter.record('user-4') // one over
    const result = await limiter.check('user-4')
    expect(result.allowed).toBe(false)
  })
})

describe('createRateLimiter — check does not increment counter', () => {
  it('check without record never blocks', async () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })
    for (let i = 0; i < 100; i++) {
      const result = await limiter.check('read-only-user')
      expect(result.allowed).toBe(true)
    }
  })
})

describe('createRateLimiter — reset clears the counter', () => {
  it('allows requests again after reset', async () => {
    const limiter = createRateLimiter({ maxAttempts: 2, windowMs: 60_000 })
    await limiter.record('user-5')
    await limiter.record('user-5')
    expect((await limiter.check('user-5')).allowed).toBe(false)

    await limiter.reset('user-5')
    expect((await limiter.check('user-5')).allowed).toBe(true)
  })

  it('reset on an unknown key is a no-op', async () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })
    await expect(limiter.reset('nonexistent-user')).resolves.not.toThrow()
  })
})

describe('createRateLimiter — retryAfterSeconds', () => {
  it('returns a positive retryAfterSeconds when blocked', async () => {
    const limiter = createRateLimiter({ maxAttempts: 1, windowMs: 60_000 })
    await limiter.record('user-6')
    const result = await limiter.check('user-6')
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1)
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('returns 0 retryAfterSeconds when allowed', async () => {
    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000 })
    const result = await limiter.check('user-7')
    expect(result.retryAfterSeconds).toBe(0)
  })
})

describe('createRateLimiter — window expiry', () => {
  it('allows requests again after the window expires', async () => {
    const limiter = createRateLimiter({ maxAttempts: 1, windowMs: 50 }) // 50ms window
    await limiter.record('expiry-user')
    expect((await limiter.check('expiry-user')).allowed).toBe(false)

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 100))
    expect((await limiter.check('expiry-user')).allowed).toBe(true)
  })
})

describe('createRateLimiter — key isolation', () => {
  it('different keys have independent counters', async () => {
    const limiter = createRateLimiter({ maxAttempts: 2, windowMs: 60_000 })
    await limiter.record('alpha')
    await limiter.record('alpha')
    // alpha is blocked
    expect((await limiter.check('alpha')).allowed).toBe(false)
    // beta is unaffected
    expect((await limiter.check('beta')).allowed).toBe(true)
  })
})

describe('createRateLimiter — maxAttempts of 0', () => {
  it('blocks immediately on first check after any record', async () => {
    const limiter = createRateLimiter({ maxAttempts: 0, windowMs: 60_000 })
    await limiter.record('zero-user')
    expect((await limiter.check('zero-user')).allowed).toBe(false)
  })
})
