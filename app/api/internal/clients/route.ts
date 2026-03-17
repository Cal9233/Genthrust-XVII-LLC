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

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clients = await query<any[]>(
      `SELECT pu.id, pu.email, pu.contact_name, pu.is_active, pu.mfa_enabled, pu.created_at, pu.last_login,
              c.company_name
       FROM portal_users pu
       LEFT JOIN companies c ON pu.company_id = c.id
       ORDER BY pu.is_active ASC, pu.id DESC`
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
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = PatchClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'userId and is_active (0 or 1) are required' }, { status: 400 })
    }
    const { userId, is_active } = parsed.data

    await query(
      `UPDATE portal_users SET is_active = ?, updated_at = NOW() WHERE id = ?`,
      [is_active, userId]
    )

    logAuditEvent({
      action: ACTION_TYPES.UPDATE,
      resource_type: RESOURCE_TYPES.CLIENT,
      resource_id: String(userId),
      user_id: session.user.id,
      user_email: session.user.email ?? null,
      user_role: 'internal',
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
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = DeleteClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    const { userId } = parsed.data

    await query(
      `DELETE FROM portal_users WHERE id = ? AND is_active = 0`,
      [userId]
    )

    logAuditEvent({
      action: ACTION_TYPES.DELETE,
      resource_type: RESOURCE_TYPES.CLIENT,
      resource_id: String(userId),
      user_id: session.user.id,
      user_email: session.user.email ?? null,
      user_role: 'internal',
      success: true,
      status_code: 200,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Internal clients DELETE error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to reject client' }, { status: 500 })
  }
}
