import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { InventoryItem } from '@/types/inventory'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const searchQuery = searchParams.get('q')

    if (!searchQuery || searchQuery.trim() === '') {
      return NextResponse.json([])
    }

    // Escape special characters and prepare search pattern
    const searchPattern = `%${searchQuery.trim()}%`

    // Important: Wrap 'condition' in backticks as it's a reserved word
    const sql = `
      SELECT 
        id,
        part_number,
        serial_number,
        description,
        quantity,
        location,
        bin,
        \`condition\`,
        cost,
        sell_price,
        source_file
      FROM inventory
      WHERE part_number LIKE ? OR description LIKE ?
      ORDER BY part_number
      LIMIT 100
    `

    const results = await query<InventoryItem[]>(sql, [searchPattern, searchPattern])

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Failed to search inventory' },
      { status: 500 }
    )
  }
}
