import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { decryptSecret, verifyTotpCode, generateRecoveryCodes } from '@/lib/mfa'
import bcrypt from 'bcryptjs'

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
    if (!verifyTotpCode(secret, code)) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

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
    for (const code of recoveryCodes) {
      const hash = await bcrypt.hash(code, 12)
      await query(
        `INSERT INTO mfa_recovery_codes (user_id, code_hash) VALUES (?, ?)`,
        [userId, hash]
      )
    }

    return NextResponse.json({ success: true, recoveryCodes })
  } catch (error) {
    console.error('MFA verify error:', error)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
