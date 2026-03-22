/**
 * Tests for lib/rate-limit.ts — Redis path
 *
 * Sets UPSTASH_REDIS_REST_URL before importing so createRateLimiter
 * returns the Redis implementation. @upstash/redis is mocked entirely.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Environment — must be set BEFORE module import
// ---------------------------------------------------------------------------
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

// ---------------------------------------------------------------------------
// Mock audit-logger
// ---------------------------------------------------------------------------
vi.mock('@/lib/audit-logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  ACTION_TYPES: { RATE_LIMITED: 'RATE_LIMITED' },
}))

// ---------------------------------------------------------------------------
// Redis mock instances — captured so tests can configure return values
// ---------------------------------------------------------------------------
const mockExec = vi.fn().mockResolvedValue([1, 1])
const mockIncrChain = vi.fn()
const mockPexpireChain = vi.fn()

const mockPipelineInstance = {
  incr: mockIncrChain,
  pexpire: mockPexpireChain,
  exec: mockExec,
}

const mockGet = vi.fn()
const mockPttl = vi.fn()
const mockDel = vi.fn().mockResolvedValue(1)
const mockPipeline = vi.fn().mockReturnValue(mockPipelineInstance)

// A proper constructor mock using function declaration so `new` works
function MockRedis(this: any) {
  this.get = mockGet
  this.pttl = mockPttl
  this.del = mockDel
  this.pipeline = mockPipeline
}

vi.mock('@upstash/redis', () => ({
  Redis: MockRedis,
}))

// Import AFTER mocks and env are configured
import { createRateLimiter } from '@/lib/rate-limit'
import { logAuditEvent } from '@/lib/audit-logger'

beforeEach(() => {
  vi.clearAllMocks()
  mockExec.mockResolvedValue([1, 1])
  mockDel.mockResolvedValue(1)
  // Chain methods return `this` (the pipeline object) for fluent API
  mockIncrChain.mockReturnValue(mockPipelineInstance)
  mockPexpireChain.mockReturnValue(mockPipelineInstance)
  mockPipeline.mockReturnValue(mockPipelineInstance)
})

describe('Redis rate limiter — record()', () => {
  it('calls INCR and PEXPIRE via pipeline with correct key prefix', async () => {
    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000, name: 'login' })
    await limiter.record('192.0.2.1')

    expect(mockPipeline).toHaveBeenCalled()
    expect(mockIncrChain).toHaveBeenCalledWith('rl:login:192.0.2.1')
    expect(mockPexpireChain).toHaveBeenCalledWith('rl:login:192.0.2.1', 60_000)
    expect(mockExec).toHaveBeenCalled()
  })
})

describe('Redis rate limiter — check() under limit', () => {
  it('returns allowed:true when count is below maxAttempts', async () => {
    mockGet.mockResolvedValue(2)
    mockPttl.mockResolvedValue(30_000)

    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000, name: 'mfa-verify' })
    const result = await limiter.check('user-42')

    expect(result.allowed).toBe(true)
    expect(result.retryAfterSeconds).toBe(0)
  })

  it('returns allowed:true when no key exists yet (count null)', async () => {
    mockGet.mockResolvedValue(null)
    mockPttl.mockResolvedValue(-2)

    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000, name: 'test' })
    const result = await limiter.check('new-user')

    expect(result.allowed).toBe(true)
  })
})

describe('Redis rate limiter — check() at/over limit', () => {
  it('returns allowed:false with correct retryAfterSeconds when count >= maxAttempts', async () => {
    mockGet.mockResolvedValue(5) // exactly at max
    mockPttl.mockResolvedValue(45_000) // 45 seconds remaining

    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000, name: 'verify-credentials' })
    const result = await limiter.check('10.0.0.1')

    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBe(45) // ceil(45000 / 1000)
  })

  it('fires audit log when rate limit hit', async () => {
    mockGet.mockResolvedValue(10) // over max
    mockPttl.mockResolvedValue(20_000)

    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000, name: 'audit-test' })
    await limiter.check('blocked-user')

    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status_code: 429,
        metadata: expect.objectContaining({ limiter: 'audit-test', maxAttempts: 5 }),
      })
    )
  })

  it('returns retryAfterSeconds of at least 1 when pttl is 0 or negative', async () => {
    mockGet.mockResolvedValue(5)
    mockPttl.mockResolvedValue(0) // edge: expired or missing

    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000, name: 'edge' })
    const result = await limiter.check('edge-user')

    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1)
  })
})

describe('Redis rate limiter — reset()', () => {
  it('calls DEL with the correct namespaced key', async () => {
    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000, name: 'mfa-disable' })
    await limiter.reset('user-99')

    expect(mockDel).toHaveBeenCalledWith('rl:mfa-disable:user-99')
  })
})

describe('Redis rate limiter — key prefix', () => {
  it('includes limiter name in Redis key: rl:{name}:{key}', async () => {
    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000, name: 'company-search' })
    await limiter.record('172.16.0.5')

    expect(mockIncrChain).toHaveBeenCalledWith('rl:company-search:172.16.0.5')
    expect(mockPexpireChain).toHaveBeenCalledWith('rl:company-search:172.16.0.5', 60_000)
  })
})
