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
      role: (session.user as any).role,
    }

    // Test main DB (genthrust on port 3307)
    try {
      await query<any[]>('SELECT 1')
      results.mainDb = { connected: true }
    } catch (error) {
      console.error('Main DB connection error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
      results.mainDb = { connected: false }
    }

    // Test inventory DB (genthrust_inventory on port 3306)
    try {
      await inventoryQuery<any[]>('SELECT 1')
      results.inventoryDb = { connected: true }
    } catch (error) {
      console.error('Inventory DB connection error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
      results.inventoryDb = { connected: false }
    }

    // Check inventory DB connectivity (no schema leakage)
    try {
      await inventoryQuery<any[]>('SELECT 1')
      results.inventoryConnected = true
    } catch (error) {
      console.error('Inventory connectivity error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
      results.inventoryConnected = false
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Diagnostics API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json(
      { error: 'Diagnostics failed' },
      { status: 500 }
    )
  }
}
