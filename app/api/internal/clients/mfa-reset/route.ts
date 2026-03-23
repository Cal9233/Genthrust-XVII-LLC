import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from '@/lib/audit-logger'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (!session?.user || (role !== 'internal' && role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Validate userId is a positive integer
    const parsedId = parseInt(String(userId), 10)
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return NextResponse.json({ error: 'userId must be a positive integer' }, { status: 400 })
    }

    // Look up the user in users_v2 — userId refers to users_v2.id
    const users = await query<any[]>(
      `SELECT id, email, portal_user_id FROM users_v2 WHERE id = ? AND role = 'client'`,
      [parsedId]
    )
    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const targetUser = users[0]
    const portalUserId: number | null = targetUser.portal_user_id

    if (!portalUserId) {
      // No portal_user_id means no MFA factors can exist for this user
      return NextResponse.json({ error: 'User has no MFA record to reset' }, { status: 404 })
    }

    // Soft-delete factor and recovery codes using portal_user_id (FK target for mfa_factors)
    await query(
      `UPDATE mfa_factors SET deleted_at = NOW(), status = 'pending' WHERE user_id = ? AND deleted_at IS NULL`,
      [portalUserId]
    )
    await query(
      `UPDATE mfa_recovery_codes SET deleted_at = NOW() WHERE user_id = ? AND deleted_at IS NULL`,
      [portalUserId]
    )

    // Reset mfa_enabled in both tables to keep them in sync
    await query(`UPDATE users_v2 SET mfa_enabled = 0, updated_at = NOW() WHERE id = ?`, [parsedId])
    await query(`UPDATE portal_users SET mfa_enabled = 0, updated_at = NOW() WHERE id = ?`, [portalUserId])

    // Audit log the admin MFA reset
    logAuditEvent({
      action: ACTION_TYPES.MFA_DISABLE,
      resource_type: RESOURCE_TYPES.MFA,
      resource_id: String(parsedId),
      user_id: session.user.id ?? session.user.email ?? null,
      user_email: session.user.email ?? null,
      user_role: role,
      success: true,
      status_code: 200,
      metadata: {
        target_user_id: parsedId,
        target_user_email: targetUser.email,
        admin_action: 'mfa_reset',
      },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('MFA reset error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to reset MFA' }, { status: 500 })
  }
}
