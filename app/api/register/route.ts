import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
  contact_name: z.string().min(1).max(255).transform(v => v.trim()),
  company_name: z.string().max(255).optional(),
})

// In-memory rate limiter: 3 registrations per hour per IP
const registerAttempts = new Map<string, { count: number; resetAt: number }>()
const REGISTER_LIMIT = 3
const REGISTER_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkRegisterRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = registerAttempts.get(ip)
  if (!entry || now >= entry.resetAt) {
    registerAttempts.set(ip, { count: 1, resetAt: now + REGISTER_WINDOW_MS })
    return true
  }
  if (entry.count >= REGISTER_LIMIT) return false
  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
  if (!checkRegisterRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many registration attempts. Please try again later.' }, { status: 429 })
  }
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

    await query(
      `INSERT INTO portal_users (email, password_hash, contact_name, company_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, NOW(), NOW())`,
      [email, passwordHash, contact_name, companyId]
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
