import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'

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
    console.error('Internal clients API error:', error)
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, is_active } = await request.json()

    if (!userId || typeof is_active !== 'number') {
      return NextResponse.json({ error: 'userId and is_active are required' }, { status: 400 })
    }

    await query(
      `UPDATE portal_users SET is_active = ?, updated_at = NOW() WHERE id = ?`,
      [is_active, userId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Internal clients PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    await query(
      `DELETE FROM portal_users WHERE id = ? AND is_active = 0`,
      [userId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Internal clients DELETE error:', error)
    return NextResponse.json({ error: 'Failed to reject client' }, { status: 500 })
  }
}
