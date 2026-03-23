import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { z } from 'zod'
import { createRateLimiter } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(72),
  contact_name: z.string().min(1).max(255).transform(v => v.trim()),
  company_name: z.string().max(255).optional(),
})

const registerLimiter = createRateLimiter({ maxAttempts: 3, windowMs: 60 * 60 * 1000, name: 'register' })

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
  const rateCheck = await registerLimiter.check(ip)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } }
    )
  }
  await registerLimiter.record(ip)
  try {
    const body = await request.json()
    const parsed = RegisterSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, password, contact_name, company_name } = parsed.data

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

    // Insert into portal_users first to obtain portal_user_id.
    // portal_users.id is the FK target for mfa_factors and mfa_recovery_codes.
    const portalResult = await query<any>(
      `INSERT INTO portal_users (email, password_hash, contact_name, company_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, NOW(), NOW())`,
      [email, passwordHash, contact_name, companyId]
    )
    const portalUserId: number = portalResult.insertId

    // Split contact_name into first/last for users_v2
    const nameParts = contact_name.trim().split(' ')
    const firstName = nameParts[0] ?? contact_name
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : contact_name

    // Insert into unified users_v2 table with portal_user_id for MFA FK linkage
    await query(
      `INSERT INTO users_v2
         (email, first_name, last_name, role, password_hash, portal_user_id, company_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 'client', ?, ?, ?, 0, NOW(), NOW())`,
      [email, firstName, lastName, passwordHash, portalUserId, companyId]
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
