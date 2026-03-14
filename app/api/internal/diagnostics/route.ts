import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inventoryQuery } from '@/lib/inventory-db'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      session: {
        email: session.user.email,
        role: (session.user as any).role,
      },
    }

    // Test main DB (genthrust on port 3307)
    try {
      const rows = await query<any[]>('SELECT 1 as test')
      results.mainDb = { connected: true, result: rows[0] }
    } catch (error) {
      console.error('Main DB connection error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
      results.mainDb = { connected: false }
    }

    // Test inventory DB (genthrust_inventory on port 3306)
    try {
      const rows = await inventoryQuery<any[]>('SELECT 1 as test')
      results.inventoryDb = { connected: true, result: rows[0] }
    } catch (error) {
      console.error('Inventory DB connection error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
      results.inventoryDb = { connected: false }
    }

    // Check inventory tables exist
    try {
      const tables = await inventoryQuery<any[]>('SHOW TABLES')
      results.inventoryTables = tables.map((t: any) => Object.values(t)[0])
    } catch (error) {
      console.error('Inventory tables error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
      results.inventoryTables = { connected: false }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Diagnostics API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json(
      { error: 'Diagnostics failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
