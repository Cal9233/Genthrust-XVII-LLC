import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { decryptSecret, verifyTotpCode } from '@/lib/mfa'
import { createRateLimiter } from '@/lib/rate-limit'
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from '@/lib/audit-logger'
import bcrypt from 'bcryptjs'
export const dynamic = 'force-dynamic'

const mfaDisableLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 5 * 60 * 1000, name: 'mfa-disable' })

interface FactorRow {
  secret_encrypted: string
  secret_iv: string
  secret_auth_tag: string
}

interface RecoveryCodeRow {
  id: number
  code_hash: string
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
    const rl = await mfaDisableLimiter.check(userKey)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    // Get verified factor
    const factors = await query<FactorRow[]>(
      `SELECT secret_encrypted, secret_iv, secret_auth_tag
       FROM mfa_factors WHERE user_id = ? AND factor_type = 'totp' AND status = 'verified' AND deleted_at IS NULL`,
      [userId]
    )

    if (!factors.length) {
      return NextResponse.json({ error: 'No MFA factor found' }, { status: 400 })
    }

    const factor = factors[0]
    const secret = decryptSecret(factor.secret_encrypted, factor.secret_iv, factor.secret_auth_tag)

    // Verify with TOTP code first
    let codeValid = await verifyTotpCode(secret, code, userKey)

    // Try as recovery code
    let usedRecoveryCodeId: number | null = null
    if (!codeValid) {
      const recoveryCodes = await query<RecoveryCodeRow[]>(
        `SELECT id, code_hash FROM mfa_recovery_codes WHERE user_id = ? AND used_at IS NULL AND deleted_at IS NULL`,
        [userId]
      )
      for (const rc of recoveryCodes) {
        if (await bcrypt.compare(code.toUpperCase(), rc.code_hash)) {
          codeValid = true
          usedRecoveryCodeId = rc.id
          break
        }
      }
    }

    if (!codeValid) {
      await mfaDisableLimiter.record(userKey)
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    // Success — reset rate limit counter
    await mfaDisableLimiter.reset(userKey)

    // Mark the used recovery code before bulk delete
    if (usedRecoveryCodeId !== null) {
      await query(
        `UPDATE mfa_recovery_codes SET used_at = NOW() WHERE id = ?`,
        [usedRecoveryCodeId]
      )
    }

    // Soft-delete factor and recovery codes, reset flag
    await query(`UPDATE mfa_factors SET deleted_at = NOW(), status = 'pending' WHERE user_id = ? AND deleted_at IS NULL`, [userId])
    await query(`UPDATE mfa_recovery_codes SET deleted_at = NOW() WHERE user_id = ? AND deleted_at IS NULL`, [userId])
    await query(`UPDATE portal_users SET mfa_enabled = 0 WHERE id = ?`, [userId])

    logAuditEvent({
      action: ACTION_TYPES.MFA_DISABLE,
      resource_type: RESOURCE_TYPES.MFA,
      user_id: String(userId),
      user_email: session.user.email ?? null,
      user_role: 'client',
      success: true,
      status_code: 200,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('MFA disable error:', error)
    return NextResponse.json({ error: 'Failed to disable MFA' }, { status: 500 })
  }
}
