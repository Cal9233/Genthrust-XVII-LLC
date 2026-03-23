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

    if (!session?.user || session.user.role !== 'internal') {
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

    const result = await query<any>(
      'INSERT INTO portal_users (email, password_hash, contact_name, company_id, is_active) VALUES (?, ?, ?, ?, 1)',
      [email, passwordHash, contact_name, company_id || null]
    )

    return NextResponse.json(
      { id: result.insertId, email },
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
