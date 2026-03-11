import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''

    if (q.length < 1) {
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
