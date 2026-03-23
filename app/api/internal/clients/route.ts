import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from '@/lib/audit-logger'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

const PatchClientSchema = z.object({
  userId: z.number().int().positive(),
  is_active: z.number().int().min(0).max(1),
})

const DeleteClientSchema = z.object({
  userId: z.number().int().positive(),
})

function isInternalOrAdmin(session: any): boolean {
  const role = session?.user?.role
  return role === 'internal' || role === 'admin'
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || !isInternalOrAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clients = await query<any[]>(
      `SELECT u.id, u.email,
              CONCAT(u.first_name, ' ', u.last_name) AS contact_name,
              u.is_active, u.mfa_enabled, u.created_at, u.last_login,
              c.company_name
       FROM users_v2 u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.role = 'client'
       ORDER BY u.is_active ASC, u.id DESC`
    )

    return NextResponse.json({ clients })
  } catch (error) {
    console.error('Internal clients API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user || !isInternalOrAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = PatchClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'userId and is_active (0 or 1) are required' }, { status: 400 })
    }
    const { userId, is_active } = parsed.data

    // Verify target user exists and is a client before operating
    const targets = await query<any[]>(`SELECT id FROM users_v2 WHERE id = ? AND role = 'client'`, [userId])
    if (!targets || targets.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await query(
      `UPDATE users_v2 SET is_active = ?, updated_at = NOW() WHERE id = ?`,
      [is_active, userId]
    )

    // Keep portal_users in sync for MFA FK consistency
    await query(
      `UPDATE portal_users pu
       INNER JOIN users_v2 u ON pu.id = u.portal_user_id
       SET pu.is_active = ?, pu.updated_at = NOW()
       WHERE u.id = ?`,
      [is_active, userId]
    )

    const sessionRole = (session.user as any).role
    logAuditEvent({
      action: ACTION_TYPES.UPDATE,
      resource_type: RESOURCE_TYPES.CLIENT,
      resource_id: String(userId),
      user_id: session.user.id,
      user_email: session.user.email ?? null,
      user_role: sessionRole,
      success: true,
      status_code: 200,
      metadata: { is_active },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Internal clients PATCH error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user || !isInternalOrAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = DeleteClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    const { userId } = parsed.data

    // Verify target user exists and is a client before operating
    const targets = await query<any[]>(
      `SELECT id, portal_user_id FROM users_v2 WHERE id = ? AND role = 'client'`,
      [userId]
    )
    if (!targets || targets.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const result = await query<import('mysql2').ResultSetHeader>(
      `DELETE FROM users_v2 WHERE id = ? AND is_active = 0 AND role = 'client'`,
      [userId]
    )

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: 'Cannot delete an active user. Deactivate first.' },
        { status: 409 }
      )
    }

    // Also clean up portal_users row if one exists (maintains table consistency)
    const portalUserId = targets[0].portal_user_id
    if (portalUserId) {
      await query(`DELETE FROM portal_users WHERE id = ? AND is_active = 0`, [portalUserId])
    }

    const sessionRole = (session.user as any).role
    logAuditEvent({
      action: ACTION_TYPES.DELETE,
      resource_type: RESOURCE_TYPES.CLIENT,
      resource_id: String(userId),
      user_id: session.user.id,
      user_email: session.user.email ?? null,
      user_role: sessionRole,
      success: true,
      status_code: 200,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Internal clients DELETE error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to reject client' }, { status: 500 })
  }
}
