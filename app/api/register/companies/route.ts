import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// In-memory rate limiter: 5 requests per minute per IP (no external deps)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 5

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// Periodic cleanup to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(key)
  }
}, 60_000).unref?.()

export async function GET(request: Request) {
  try {
    // Rate limit by IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''

    // Require minimum 3 characters to prevent enumeration
    if (q.length < 3) {
      return NextResponse.json([])
    }

    const companies = await query<any[]>(
      `SELECT id, company_name FROM companies WHERE company_name LIKE ? ORDER BY company_name LIMIT 20`,
      [`%${q}%`]
    )

    return NextResponse.json(companies)
  } catch (error) {
    console.error('Company search API error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
