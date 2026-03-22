/**
 * Rate limiter factory — Upstash Redis when UPSTASH_REDIS_REST_URL is set,
 * in-memory Map fallback otherwise.
 *
 * Usage:
 *   const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 5 * 60 * 1000, name: 'login' })
 *   const result = await limiter.check(userId)
 *   if (!result.allowed) return 429 with Retry-After: result.retryAfterSeconds
 *   await limiter.record(userId)    // call ONLY on failures (or always, depending on use case)
 *   await limiter.reset(userId)     // call on success to clear the counter
 */

import { logAuditEvent, ACTION_TYPES } from '@/lib/audit-logger'

interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimiterOptions {
  /** Maximum attempts allowed within the window */
  maxAttempts: number
  /** Window duration in milliseconds */
  windowMs: number
  /** Optional label for audit logging and Redis key namespacing (e.g. 'mfa-verify') */
  name?: string
}

export interface CheckResult {
  allowed: boolean
  /** Seconds until the window resets (only meaningful when allowed === false) */
  retryAfterSeconds: number
}

// One-time warning so logs are not flooded
let _fallbackWarningEmitted = false

function emitFallbackWarning() {
  if (!_fallbackWarningEmitted) {
    console.warn('[rate-limit] No UPSTASH_REDIS_REST_URL — using in-memory fallback (not suitable for production)')
    _fallbackWarningEmitted = true
  }
}

// ---------------------------------------------------------------------------
// Redis singleton — created once, shared across all limiter instances.
// Importing the module at the top level allows vi.mock() to intercept it.
// The actual Redis instance is only constructed when the URL is present.
// ---------------------------------------------------------------------------
import type { Redis as RedisType } from '@upstash/redis'

let _redisInstance: RedisType | null = null

async function getRedis(): Promise<RedisType> {
  if (!_redisInstance) {
    const { Redis } = await import('@upstash/redis')
    _redisInstance = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return _redisInstance
}

// ---------------------------------------------------------------------------
// Redis implementation
// ---------------------------------------------------------------------------

function createRedisRateLimiter({ maxAttempts, windowMs, name }: RateLimiterOptions) {
  const limiterName = name ?? 'default'

  function redisKey(key: string): string {
    return `rl:${limiterName}:${key}`
  }

  return {
    async record(key: string): Promise<void> {
      const redis = await getRedis()
      const rk = redisKey(key)
      const pipeline = redis.pipeline()
      pipeline.incr(rk)
      pipeline.pexpire(rk, windowMs)
      await pipeline.exec()
    },

    async check(key: string): Promise<CheckResult> {
      const redis = await getRedis()
      const rk = redisKey(key)
      const [count, pttl] = await Promise.all([
        redis.get<number>(rk),
        redis.pttl(rk),
      ])

      const currentCount = count ?? 0

      if (currentCount >= maxAttempts) {
        // pttl is -2 if key does not exist, -1 if no expiry — both should not happen here
        const remainingMs = pttl > 0 ? pttl : windowMs
        const retryAfterSeconds = Math.max(Math.ceil(remainingMs / 1000), 1)

        logAuditEvent({
          action: ACTION_TYPES.RATE_LIMITED,
          user_id: key,
          success: false,
          status_code: 429,
          metadata: { limiter: limiterName, attempts: currentCount, maxAttempts, retryAfterSeconds },
        }).catch(() => {})

        return { allowed: false, retryAfterSeconds }
      }

      return { allowed: true, retryAfterSeconds: 0 }
    },

    async reset(key: string): Promise<void> {
      const redis = await getRedis()
      await redis.del(redisKey(key))
    },
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback implementation
// ---------------------------------------------------------------------------

function createMemoryRateLimiter({ maxAttempts, windowMs, name }: RateLimiterOptions) {
  emitFallbackWarning()

  const store = new Map<string, RateLimitEntry>()
  const limiterName = name ?? 'unknown'

  function getEntry(key: string): RateLimitEntry | null {
    const entry = store.get(key)
    if (!entry) return null
    if (Date.now() >= entry.resetAt) {
      store.delete(key)
      return null
    }
    return entry
  }

  return {
    async check(key: string): Promise<CheckResult> {
      const entry = getEntry(key)
      if (!entry) return { allowed: true, retryAfterSeconds: 0 }
      if (entry.count >= maxAttempts) {
        const retryAfterSeconds = Math.ceil((entry.resetAt - Date.now()) / 1000)

        logAuditEvent({
          action: ACTION_TYPES.RATE_LIMITED,
          user_id: key,
          success: false,
          status_code: 429,
          metadata: { limiter: limiterName, attempts: entry.count, maxAttempts, retryAfterSeconds },
        }).catch(() => {})

        return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) }
      }
      return { allowed: true, retryAfterSeconds: 0 }
    },

    async record(key: string): Promise<void> {
      const entry = getEntry(key)
      if (entry) {
        entry.count++
      } else {
        store.set(key, { count: 1, resetAt: Date.now() + windowMs })
      }
    },

    async reset(key: string): Promise<void> {
      store.delete(key)
    },
  }
}

// ---------------------------------------------------------------------------
// Factory — selects implementation based on environment
// ---------------------------------------------------------------------------

export function createRateLimiter(options: RateLimiterOptions) {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    return createRedisRateLimiter(options)
  }
  return createMemoryRateLimiter(options)
}
