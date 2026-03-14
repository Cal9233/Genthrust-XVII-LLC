import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { hashPassword } from '@/lib/password'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user || session.user.role !== 'internal') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { email, password, contact_name, company_id } = body as {
    email?: string
    password?: string
    contact_name?: string
    company_id?: number
  }

  if (!email || !password || !contact_name) {
    return NextResponse.json(
      { error: 'Missing required fields: email, password, contact_name' },
      { status: 400 }
    )
  }

  const passwordHash = await hashPassword(password)

  try {
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
    throw error
  }
}
