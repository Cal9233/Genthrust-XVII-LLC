import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { inventoryQuery } from '@/lib/inventory-db'
import { getAllBotStatuses } from '@/lib/bot-helpers'
export const dynamic = 'force-dynamic'

async function safeCount(sql: string, useInventoryDb = false): Promise<Record<string, any>> {
  try {
    const rows = useInventoryDb
      ? await inventoryQuery<any[]>(sql)
      : await query<any[]>(sql)
    return rows[0] || {}
  } catch (error) {
    console.error('Status overview query failed:', error)
    return {}
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [
      // ERP stats
      rosRow,
      sosRow,
      invoicesRow,
      partsRow,
      // Clients
      clientsRow,
      // Inventory
      inventoryRow,
      alarmsRow,
      // Quotes
      quotesRow,
      // Automation - NET30 count
      net30Row,
    ] = await Promise.all([
      safeCount(`SELECT COUNT(*) as activeROs FROM repair_orders WHERE status NOT IN ('Closed', 'Cancelled', 'Completed') OR status IS NULL`),
      safeCount(`SELECT COUNT(*) as activeSOs FROM sales_orders WHERE status NOT IN ('Closed', 'Cancelled', 'Completed') OR status IS NULL`),
      safeCount(`SELECT COUNT(*) as openInvoices, COALESCE(SUM(open_balance), 0) as openBalance FROM invoices WHERE status NOT IN ('Paid', 'Closed', 'Cancelled') OR status IS NULL`),
      safeCount('SELECT COUNT(*) as totalParts FROM parts'),
      safeCount(`SELECT
        COUNT(*) as totalClients,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as activeClients,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as pendingClients
        FROM portal_users`),
      safeCount('SELECT COUNT(*) as totalSkus FROM inventory', true),
      safeCount('SELECT COUNT(*) as activeAlarms FROM inventory_alerts WHERE acknowledged_at IS NULL', true),
      safeCount(`SELECT
        COUNT(*) as totalQuotes,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingQuotes,
        SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processedQuotes
        FROM quote_requests`),
      safeCount(`SELECT COUNT(*) as dueSoon FROM invoices WHERE status NOT IN ('Paid', 'Closed', 'Cancelled') AND due_date <= DATE_ADD(NOW(), INTERVAL 7 DAY) AND due_date >= NOW()`),
    ])

    // Bot statuses — synchronous (reads Windows service state)
    let botSummary = { total: 0, running: 0, stopped: 0 }
    try {
      const statuses = getAllBotStatuses()
      botSummary = {
        total: statuses.length,
        running: statuses.filter(b => b.status === 'RUNNING').length,
        stopped: statuses.filter(b => b.status !== 'RUNNING').length,
      }
    } catch {
      // Bot status unavailable (e.g., not on Windows)
    }

    return NextResponse.json({
      bots: botSummary,
      erp: {
        activeROs: rosRow.activeROs || 0,
        activeSOs: sosRow.activeSOs || 0,
        openInvoices: invoicesRow.openInvoices || 0,
        openBalance: parseFloat(invoicesRow.openBalance) || 0,
        totalParts: partsRow.totalParts || 0,
      },
      automation: {
        dueSoon: net30Row.dueSoon || 0,
      },
      clients: {
        total: clientsRow.totalClients || 0,
        active: clientsRow.activeClients || 0,
        pending: clientsRow.pendingClients || 0,
      },
      inventory: {
        totalSkus: inventoryRow.totalSkus || 0,
        activeAlarms: alarmsRow.activeAlarms || 0,
      },
      quotes: {
        total: quotesRow.totalQuotes || 0,
        pending: quotesRow.pendingQuotes || 0,
        processed: quotesRow.processedQuotes || 0,
      },
    })
  } catch (error) {
    console.error('Status overview API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load status overview' }, { status: 500 })
  }
}
