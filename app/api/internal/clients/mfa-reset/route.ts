import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
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

    // Delete factor and recovery codes, reset flag
    await query(`DELETE FROM mfa_factors WHERE user_id = ?`, [userId])
    await query(`DELETE FROM mfa_recovery_codes WHERE user_id = ?`, [userId])
    await query(`UPDATE portal_users SET mfa_enabled = 0 WHERE id = ?`, [userId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('MFA reset error:', error)
    return NextResponse.json({ error: 'Failed to reset MFA' }, { status: 500 })
  }
}
