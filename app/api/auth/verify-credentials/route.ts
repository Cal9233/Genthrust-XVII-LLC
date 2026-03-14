import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { createMfaChallengeToken } from '@/lib/mfa'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// In-memory rate limiter: 5 attempts per 60 seconds per IP
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60_000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true
  }

  entry.count++
  return false
}

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

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const rows = await query<PortalUserRow[]>(
      `SELECT pu.id, pu.email, pu.password_hash, pu.mfa_enabled
       FROM portal_users pu
       WHERE pu.email = ? AND pu.is_active = 1`,
      [email]
    )

    if (!rows.length) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const user = rows[0]
    const isValid = await verifyPassword(password, user.password_hash)

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

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
