import { NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { createMfaChallengeToken } from '@/lib/mfa'
import { createRateLimiter } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

const VerifyCredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(72),
})

// ---------------------------------------------------------------------------
// Rate limiter: 5 failed attempts per 60 seconds per IP
// Counter is only incremented on failure; reset on success.
// ---------------------------------------------------------------------------

const loginLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 60_000,
  name: 'verify-credentials',
})

interface PortalUserRow {
  id: number
  email: string
  password_hash: string
  mfa_enabled: number
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // Parse and validate body first so we can key the rate limiter on ip:email.
    // This prevents both IP spoofing bypasses and cross-account brute-force from
    // a single IP.
    const body = await request.json()
    const parsed = VerifyCredentialsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid credentials format' }, { status: 400 })
    }
    const { email, password } = parsed.data

    // Rate limiter key: ip:email — binds both dimensions simultaneously
    const rateLimitKey = `${ip}:${email}`
    const rateCheck = await loginLimiter.check(rateLimitKey)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const rows = await query<PortalUserRow[]>(
      `SELECT pu.id, pu.email, pu.password_hash, pu.mfa_enabled
       FROM portal_users pu
       WHERE pu.email = ? AND pu.is_active = 1`,
      [email]
    )

    if (!rows.length) {
      await loginLimiter.record(rateLimitKey)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const user = rows[0]
    const isValid = await verifyPassword(password, user.password_hash)

    if (!isValid) {
      await loginLimiter.record(rateLimitKey)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Credentials verified — clear any accumulated failure count
    await loginLimiter.reset(rateLimitKey)

    if (user.mfa_enabled === 0) {
      // No MFA enrolled — allow direct login, portal layout will force enrollment
      return NextResponse.json({ mfaRequired: false })
    }

    // MFA is enabled — check if factor actually exists (verified)
    const factors = await query<{ id: number }[]>(
      `SELECT id FROM mfa_factors WHERE user_id = ? AND factor_type = 'totp' AND status = 'verified'`,
      [user.id]
    )

    const mfaToken = createMfaChallengeToken(user.id, user.email)

    return NextResponse.json({
      mfaRequired: true,
      mfaToken,
      needsEnrollment: factors.length === 0,
    })
  } catch (error) {
    console.error('verify-credentials error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
