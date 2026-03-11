import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { createMfaChallengeToken } from '@/lib/mfa'
export const dynamic = 'force-dynamic'

interface PortalUserRow {
  id: number
  email: string
  password_hash: string
  mfa_enabled: number
}

export async function POST(request: Request) {
  try {
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
