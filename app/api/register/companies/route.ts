import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createRateLimiter } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Rate limiter: 5 requests per minute per IP
// Counter incremented on every request (not just failures).
// ---------------------------------------------------------------------------
const companySearchLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 60_000,
  name: 'company-search',
})

export async function GET(request: Request) {
  try {
    // Rate limit by IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

    const result = await companySearchLimiter.check(ip)
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
    // Record on every request (search volume limiter, not just failures)
    await companySearchLimiter.record(ip)

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
