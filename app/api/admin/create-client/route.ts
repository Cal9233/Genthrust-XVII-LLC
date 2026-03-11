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
  const { email, password, name, company } = body as {
    email?: string
    password?: string
    name?: string
    company?: string
  }

  if (!email || !password || !name) {
    return NextResponse.json(
      { error: 'Missing required fields: email, password, name' },
      { status: 400 }
    )
  }

  // Check for duplicate email
  const existing = await query<any[]>(
    'SELECT id FROM clients WHERE email = ?',
    [email]
  )

  if (existing.length > 0) {
    return NextResponse.json(
      { error: 'A client with this email already exists' },
      { status: 409 }
    )
  }

  const passwordHash = await hashPassword(password)

  const result = await query<any>(
    'INSERT INTO clients (email, password_hash, name, company) VALUES (?, ?, ?, ?)',
    [email, passwordHash, name, company || null]
  )

  return NextResponse.json(
    { id: result.insertId, email },
    { status: 201 }
  )
}
