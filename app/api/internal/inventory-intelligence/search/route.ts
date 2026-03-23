import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inventoryQuery } from '@/lib/inventory-db'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
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
    console.error('Inventory search API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    const isConnError = error instanceof Error && (
      error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') ||
      error.message.includes('connect timeout') || error.message.includes('Connection lost')
    )
    return NextResponse.json(
      { error: isConnError ? 'Inventory database unavailable' : 'Failed to search inventory', details: isConnError ? 'Service unreachable' : undefined },
      { status: isConnError ? 503 : 500 }
    )
  }
}
