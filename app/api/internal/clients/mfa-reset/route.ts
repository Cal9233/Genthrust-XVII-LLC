import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from '@/lib/audit-logger'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
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

    // Verify target user exists before performing deletion
    const users = await query<any[]>('SELECT id, email FROM portal_users WHERE id = ?', [parsedId])
    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const targetUser = users[0]

    // Delete factor and recovery codes, reset flag
    await query(`DELETE FROM mfa_factors WHERE user_id = ?`, [parsedId])
    await query(`DELETE FROM mfa_recovery_codes WHERE user_id = ?`, [parsedId])
    await query(`UPDATE portal_users SET mfa_enabled = 0 WHERE id = ?`, [parsedId])

    // Audit log the admin MFA reset
    logAuditEvent({
      action: ACTION_TYPES.MFA_DISABLE,
      resource_type: RESOURCE_TYPES.MFA,
      resource_id: String(parsedId),
      user_id: session.user.id ?? session.user.email ?? null,
      user_email: session.user.email ?? null,
      user_role: 'internal',
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
