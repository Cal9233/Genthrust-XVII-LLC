import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createRateLimiter } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

const searchLimiter = createRateLimiter({ maxAttempts: 30, windowMs: 60_000, name: 'search' })

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
  const rateCheck = await searchLimiter.check(ip)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } }
    )
  }
  await searchLimiter.record(ip)
  try {
    const searchParams = request.nextUrl.searchParams
    const searchQuery = searchParams.get('q')

    if (!searchQuery || searchQuery.trim() === '') {
      return NextResponse.json([])
    }

    // Limit search query length to prevent abuse
    const trimmed = searchQuery.trim().substring(0, 200)
    const searchPattern = `%${trimmed}%`

    // Query the parts table from the ERP cache
    // Uses LIKE for flexible matching (FULLTEXT requires 3+ char minimum)
    const sql = `
      SELECT
        id,
        erp_product_id,
        product_name AS part_number,
        description,
        mfr_part_no,
        nsn_number,
        cage_code,
        serial_no AS serial_number,
        manufacturer_name,
        warehouse_title AS location,
        hazmat,
        product_category,
        is_portal_item
      FROM parts
      WHERE product_name LIKE ?
        OR description LIKE ?
        OR mfr_part_no LIKE ?
        OR nsn_number LIKE ?
        OR cage_code LIKE ?
      ORDER BY product_name
      LIMIT 100
    `

    const results = await query(sql, [
      searchPattern, searchPattern, searchPattern, searchPattern, searchPattern
    ])

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Failed to search inventory' },
      { status: 500 }
    )
  }
}
