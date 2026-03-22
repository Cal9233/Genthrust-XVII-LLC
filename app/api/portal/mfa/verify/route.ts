import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { decryptSecret, verifyTotpCode, generateRecoveryCodes } from '@/lib/mfa'
import { createRateLimiter } from '@/lib/rate-limit'
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from '@/lib/audit-logger'
import bcrypt from 'bcryptjs'
export const dynamic = 'force-dynamic'

const mfaVerifyLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 5 * 60 * 1000, name: 'mfa-verify' })

interface PendingFactorRow {
  id: number
  secret_encrypted: string
  secret_iv: string
  secret_auth_tag: string
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'client') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code } = await request.json()
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    }

    const userId = parseInt(session.user.id)
    const userKey = String(userId)

    // Rate limit: max 5 failed attempts per 5 minutes
    const rl = await mfaVerifyLimiter.check(userKey)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    // Get the pending factor
    const factors = await query<PendingFactorRow[]>(
      `SELECT id, secret_encrypted, secret_iv, secret_auth_tag
       FROM mfa_factors
       WHERE user_id = ? AND factor_type = 'totp' AND status = 'pending'`,
      [userId]
    )

    if (!factors.length) {
      return NextResponse.json({ error: 'No pending enrollment found' }, { status: 400 })
    }

    const factor = factors[0]
    const secret = decryptSecret(factor.secret_encrypted, factor.secret_iv, factor.secret_auth_tag)

    // Verify the TOTP code
    if (!(await verifyTotpCode(secret, code, userKey))) {
      await mfaVerifyLimiter.record(userKey)
      logAuditEvent({
        action: ACTION_TYPES.MFA_VERIFY,
        resource_type: RESOURCE_TYPES.MFA,
        user_id: String(userId),
        user_email: session.user.email ?? null,
        user_role: 'client',
        success: false,
        error_message: 'Invalid TOTP code during enrollment verification',
      }).catch(() => {})
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    // Success — reset rate limit counter
    await mfaVerifyLimiter.reset(userKey)

    // Mark factor as verified
    await query(
      `UPDATE mfa_factors SET status = 'verified', verified_at = NOW() WHERE id = ?`,
      [factor.id]
    )

    // Set mfa_enabled on user
    await query(
      `UPDATE portal_users SET mfa_enabled = 1 WHERE id = ?`,
      [userId]
    )

    // Delete any existing recovery codes and generate new ones
    await query(`DELETE FROM mfa_recovery_codes WHERE user_id = ?`, [userId])

    const recoveryCodes = generateRecoveryCodes(10)
    const hashes = await Promise.all(recoveryCodes.map(code => bcrypt.hash(code, 12)))
    const placeholders = hashes.map(() => '(?, ?)').join(', ')
    const values = hashes.flatMap((hash) => [userId, hash])
    await query(
      `INSERT INTO mfa_recovery_codes (user_id, code_hash) VALUES ${placeholders}`,
      values
    )

    logAuditEvent({
      action: ACTION_TYPES.MFA_VERIFY,
      resource_type: RESOURCE_TYPES.MFA,
      user_id: String(userId),
      user_email: session.user.email ?? null,
      user_role: 'client',
      success: true,
      status_code: 200,
    }).catch(() => {})

    return NextResponse.json({ success: true, recoveryCodes })
  } catch (error) {
    console.error('MFA verify error:', error)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
