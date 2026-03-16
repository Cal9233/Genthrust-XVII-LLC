/**
 * Simple in-memory rate limiter keyed by arbitrary string (e.g. userId).
 *
 * Usage:
 *   const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 5 * 60 * 1000 })
 *   const result = limiter.check(userId)
 *   if (!result.allowed) return 429 with Retry-After: result.retryAfterSeconds
 *   limiter.record(userId)          // call ONLY on failures (or always, depending on use case)
 *   limiter.reset(userId)           // call on success to clear the counter
 */

import { logAuditEvent, ACTION_TYPES } from '@/lib/audit-logger'

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimiterOptions {
  /** Maximum attempts allowed within the window */
  maxAttempts: number
  /** Window duration in milliseconds */
  windowMs: number
  /** Optional label for audit logging (e.g. 'mfa-verify', 'chat') */
  name?: string
}

interface CheckResult {
  allowed: boolean
  /** Seconds until the window resets (only meaningful when allowed === false) */
  retryAfterSeconds: number
}

export function createRateLimiter({ maxAttempts, windowMs, name }: RateLimiterOptions) {
  const store = new Map<string, RateLimitEntry>()

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
    /** Check whether the key is still within limits (does NOT increment). */
    check(key: string): CheckResult {
      const entry = getEntry(key)
      if (!entry) return { allowed: true, retryAfterSeconds: 0 }
      if (entry.count >= maxAttempts) {
        const retryAfterSeconds = Math.ceil((entry.resetAt - Date.now()) / 1000)

        // Audit: log rate limit hit (fire-and-forget)
        logAuditEvent({
          action: ACTION_TYPES.RATE_LIMITED,
          user_id: key,
          success: false,
          status_code: 429,
          metadata: { limiter: name ?? 'unknown', attempts: entry.count, maxAttempts, retryAfterSeconds },
        }).catch(() => {})

        return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) }
      }
      return { allowed: true, retryAfterSeconds: 0 }
    },

    /** Record one attempt against the key. Creates the window on first call. */
    record(key: string): void {
      const entry = getEntry(key)
      if (entry) {
        entry.count++
      } else {
        store.set(key, { count: 1, resetAt: Date.now() + windowMs })
      }
    },

    /** Reset the counter for a key (e.g. on successful verification). */
    reset(key: string): void {
      store.delete(key)
    },
  }
}
