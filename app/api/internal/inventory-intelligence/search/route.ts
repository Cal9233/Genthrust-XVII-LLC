import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inventoryQuery } from '@/lib/inventory-db'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const condition = searchParams.get('condition') || ''

    if (!q.trim()) {
      return NextResponse.json({ query: '', count: 0, results: [] })
    }

    const searchTerm = `%${q}%`
    let sql: string
    let params: any[]

    if (condition) {
      sql = `
        SELECT part_number, description, \`condition\`, quantity,
               warehouse_code, unit_price, serial_number
        FROM inventory
        WHERE part_number LIKE ? AND \`condition\` = ?
        ORDER BY part_number
        LIMIT 50
      `
      params = [searchTerm, condition.toUpperCase()]
    } else {
      sql = `
        SELECT part_number, description, \`condition\`, quantity,
               warehouse_code, unit_price, serial_number
        FROM inventory
        WHERE part_number LIKE ?
        ORDER BY part_number
        LIMIT 50
      `
      params = [searchTerm]
    }

    const results = await inventoryQuery<any[]>(sql, params)

    return NextResponse.json({
      query: q,
      count: results.length,
      results,
    })
  } catch (error) {
    console.error('Inventory search API error:', error)
    return NextResponse.json({ error: 'Failed to search inventory' }, { status: 500 })
  }
}
