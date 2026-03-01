import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { hashPassword } from '@/lib/password'

export async function POST(request: NextRequest) {
  const session = await auth()

  // Only internal team can create client accounts
  if (!session?.user?.email?.toLowerCase().endsWith('@genthrust.net')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { email, password, name, company } = body

  if (!email || !password || !name) {
    return NextResponse.json(
      { error: 'Email, password, and name are required.' },
      { status: 400 }
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 }
    )
  }

  try {
    const passwordHash = await hashPassword(password)

    await query(
      'INSERT INTO clients (email, password_hash, name, company) VALUES (?, ?, ?, ?)',
      [email, passwordHash, name, company || null]
    )

    return NextResponse.json({ message: 'Client account created.' }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'A client with this email already exists.' },
        { status: 409 }
      )
    }
    console.error('Failed to create client:', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
