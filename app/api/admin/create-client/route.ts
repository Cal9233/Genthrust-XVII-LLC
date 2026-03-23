import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

const CreateClientSchema = z.object({
  email: z.string().email().max(255).transform(v => v.toLowerCase().trim()),
  password: z.string().min(8).max(72),
  contact_name: z.string().min(1).max(255).transform(v => v.trim()),
  company_id: z.number().int().positive().optional(),
})

export async function POST(request: Request) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role

    // /api/admin/* routes are admin-only
    if (!session?.user || role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateClientSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, password, contact_name, company_id } = parsed.data
    const passwordHash = await hashPassword(password)

    // Insert into portal_users first to obtain portal_user_id.
    // portal_users.id is the FK target for mfa_factors and mfa_recovery_codes.
    const portalResult = await query<any>(
      'INSERT INTO portal_users (email, password_hash, contact_name, company_id, is_active) VALUES (?, ?, ?, ?, 1)',
      [email, passwordHash, contact_name, company_id || null]
    )
    const portalUserId: number = portalResult.insertId

    // Split contact_name into first/last for users_v2
    const nameParts = contact_name.trim().split(' ')
    const firstName = nameParts[0] ?? contact_name
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : contact_name

    // Insert into unified users_v2 with portal_user_id for MFA FK linkage
    const v2Result = await query<any>(
      `INSERT INTO users_v2
         (email, first_name, last_name, role, password_hash, portal_user_id, company_id, is_active)
       VALUES (?, ?, ?, 'client', ?, ?, ?, 1)`,
      [email, firstName, lastName, passwordHash, portalUserId, company_id || null]
    )

    return NextResponse.json(
      { id: v2Result.insertId, email },
      { status: 201 }
    )
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'A client with this email already exists' },
        { status: 409 }
      )
    }
    console.error('Admin create-client error:', error instanceof Error ? { message: error.message } : error)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
