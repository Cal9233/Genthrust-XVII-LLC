import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'

async function safeCount(sql: string): Promise<Record<string, any>> {
  try {
    const rows = await query<any[]>(sql)
    return rows[0] || {}
  } catch {
    return {}
  }
}

async function safeQuery(sql: string): Promise<any[]> {
  try {
    return await query<any[]>(sql)
  } catch {
    return []
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Run all queries in parallel — each wrapped safely so missing tables return 0
    const [
      partsRow,
      companiesRow,
      rosRow,
      sosRow,
      invoicesRow,
      quotesRow,
      rfqsRow,
      documentsRow,
      catalogRow,
      recentROs,
      recentSOs,
      recentInvoices,
    ] = await Promise.all([
      safeCount('SELECT COUNT(*) as totalParts FROM parts'),
      safeCount('SELECT COUNT(*) as totalCompanies FROM companies'),
      safeCount(`SELECT COUNT(*) as activeROs FROM repair_orders WHERE status NOT IN ('Closed', 'Cancelled', 'Completed') OR status IS NULL`),
      safeCount(`SELECT COUNT(*) as activeSOs FROM sales_orders WHERE status NOT IN ('Closed', 'Cancelled', 'Completed') OR status IS NULL`),
      safeCount(`SELECT COUNT(*) as openInvoices, COALESCE(SUM(open_balance), 0) as openBalance FROM invoices WHERE status NOT IN ('Paid', 'Closed', 'Cancelled') OR status IS NULL`),
      safeCount(`SELECT COUNT(*) as pendingQuotes FROM quotes WHERE stage NOT IN ('Closed', 'Won', 'Lost') OR stage IS NULL`),
      safeCount(`SELECT COUNT(*) as pendingRfqs FROM rfqs WHERE status NOT IN ('Closed', 'Completed') OR status IS NULL`),
      safeCount('SELECT COUNT(*) as totalDocuments FROM documents'),
      safeCount('SELECT COUNT(*) as catalogItems FROM catalog_items'),
      // Recent repair orders
      safeQuery(`
        SELECT id, erp_po_id, ro_number, vendor_name, status, priority, due_date, total,
               erp_created_at, erp_modified_at
        FROM repair_orders
        ORDER BY erp_modified_at DESC
        LIMIT 10
      `),
      // Recent sales orders
      safeQuery(`
        SELECT id, erp_so_id, so_number, customer_po, customer_name, status, priority,
               due_date, total, erp_created_at
        FROM sales_orders
        ORDER BY erp_modified_at DESC
        LIMIT 10
      `),
      // Recent invoices
      safeQuery(`
        SELECT id, erp_invoice_id, invoice_no, account_name, status, due_date,
               invoice_date, total, open_balance
        FROM invoices
        ORDER BY erp_modified_at DESC
        LIMIT 10
      `),
    ])

    return NextResponse.json({
      stats: {
        totalParts: partsRow.totalParts || 0,
        totalCompanies: companiesRow.totalCompanies || 0,
        activeROs: rosRow.activeROs || 0,
        activeSOs: sosRow.activeSOs || 0,
        openInvoices: invoicesRow.openInvoices || 0,
        openBalance: parseFloat(invoicesRow.openBalance) || 0,
        pendingQuotes: quotesRow.pendingQuotes || 0,
        pendingRfqs: rfqsRow.pendingRfqs || 0,
        totalDocuments: documentsRow.totalDocuments || 0,
        catalogItems: catalogRow.catalogItems || 0,
      },
      recentRepairOrders: recentROs,
      recentSalesOrders: recentSOs,
      recentInvoices: recentInvoices,
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    )
  }
}
