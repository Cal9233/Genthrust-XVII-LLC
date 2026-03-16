import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import {
  generateTotpSecret,
  encryptSecret,
  generateQrCodeDataUrl,
} from '@/lib/mfa'
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from '@/lib/audit-logger'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'client') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = parseInt(session.user.id)
    const email = session.user.email!

    // Delete any existing pending factor
    await query(
      `DELETE FROM mfa_factors WHERE user_id = ? AND status = 'pending'`,
      [userId]
    )

    // Generate new TOTP secret
    const { secret, uri } = generateTotpSecret(email)

    // Encrypt the secret
    const { encrypted, iv, authTag } = encryptSecret(secret)

    // Store as pending
    await query(
      `INSERT INTO mfa_factors (user_id, factor_type, secret_encrypted, secret_iv, secret_auth_tag, status)
       VALUES (?, 'totp', ?, ?, ?, 'pending')
       ON DUPLICATE KEY UPDATE
         secret_encrypted = VALUES(secret_encrypted),
         secret_iv = VALUES(secret_iv),
         secret_auth_tag = VALUES(secret_auth_tag),
         status = 'pending',
         verified_at = NULL`,
      [userId, encrypted, iv, authTag]
    )

    // Generate QR code
    const qrCodeUrl = await generateQrCodeDataUrl(uri)

    logAuditEvent({
      action: ACTION_TYPES.MFA_ENROLL,
      resource_type: RESOURCE_TYPES.MFA,
      user_id: String(userId),
      user_email: email,
      user_role: 'client',
      success: true,
      status_code: 200,
    }).catch(() => {})

    return NextResponse.json({ qrCodeUrl })
  } catch (error) {
    console.error('MFA enroll error:', error)
    return NextResponse.json({ error: 'Enrollment failed' }, { status: 500 })
  }
}
