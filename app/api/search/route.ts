import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

// In-memory rate limiter: 30 requests per minute per IP
const searchAttempts = new Map<string, { count: number; resetAt: number }>()
const SEARCH_LIMIT = 30
const SEARCH_WINDOW_MS = 60 * 1000 // 1 minute

function checkSearchRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = searchAttempts.get(ip)
  if (!entry || now >= entry.resetAt) {
    searchAttempts.set(ip, { count: 1, resetAt: now + SEARCH_WINDOW_MS })
    return true
  }
  if (entry.count >= SEARCH_LIMIT) return false
  entry.count++
  return true
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
  if (!checkSearchRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 })
  }
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
