import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { hashPassword } from '@/lib/password'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, contact_name, company_name } = body

    // Validation
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (!contact_name || typeof contact_name !== 'string') {
      return NextResponse.json({ error: 'Contact name is required' }, { status: 400 })
    }

    // Look up company
    let companyId: number | null = null
    if (company_name) {
      const companies = await query<any[]>(
        `SELECT id FROM companies WHERE company_name = ? LIMIT 1`,
        [company_name]
      )
      if (companies.length) {
        companyId = companies[0].id
      }
    }

    const passwordHash = await hashPassword(password)

    await query(
      `INSERT INTO portal_users (email, password_hash, contact_name, company_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, NOW(), NOW())`,
      [email.toLowerCase().trim(), passwordHash, contact_name.trim(), companyId]
    )

    return NextResponse.json(
      { message: 'Registration submitted — pending admin approval.' },
      { status: 201 }
    )
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'This email is already registered' }, { status: 409 })
    }
    console.error('Registration API error:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
