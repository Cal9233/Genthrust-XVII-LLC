import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyName = (session.user as any).companyName
    if (!companyName) {
      return NextResponse.json({
        companyName: null,
        stats: { activeSOs: 0, openInvoices: 0, openBalance: 0, activeROs: 0 },
        recentSalesOrders: [],
        recentInvoices: [],
        recentRepairOrders: [],
        noCompany: true,
      })
    }

    const [
      [{ activeSOs }],
      [{ openInvoices, openBalance }],
      [{ activeROs }],
      recentSOs,
      recentInvoices,
      recentROs,
    ] = await Promise.all([
      query<any[]>(
        `SELECT COUNT(*) as activeSOs FROM sales_orders
         WHERE customer_name = ? AND (status NOT IN ('Closed', 'Cancelled', 'Completed') OR status IS NULL)`,
        [companyName]
      ),
      query<any[]>(
        `SELECT COUNT(*) as openInvoices, COALESCE(SUM(open_balance), 0) as openBalance FROM invoices
         WHERE account_name = ? AND (status NOT IN ('Paid', 'Closed', 'Cancelled') OR status IS NULL)`,
        [companyName]
      ),
      query<any[]>(
        `SELECT COUNT(*) as activeROs FROM repair_orders
         WHERE vendor_name = ? AND (status NOT IN ('Closed', 'Cancelled', 'Completed') OR status IS NULL)`,
        [companyName]
      ),
      query<any[]>(
        `SELECT id, erp_so_id, so_number, customer_po, customer_name, status, priority,
                due_date, total, erp_created_at
         FROM sales_orders
         WHERE customer_name = ?
         ORDER BY erp_modified_at DESC
         LIMIT 10`,
        [companyName]
      ),
      query<any[]>(
        `SELECT id, erp_invoice_id, invoice_no, account_name, status, due_date,
                invoice_date, total, open_balance
         FROM invoices
         WHERE account_name = ?
         ORDER BY erp_modified_at DESC
         LIMIT 10`,
        [companyName]
      ),
      query<any[]>(
        `SELECT id, erp_po_id, ro_number, vendor_name, status, priority, due_date, total,
                erp_created_at, erp_modified_at
         FROM repair_orders
         WHERE vendor_name = ?
         ORDER BY erp_modified_at DESC
         LIMIT 10`,
        [companyName]
      ),
    ])

    return NextResponse.json({
      companyName,
      stats: {
        activeSOs,
        openInvoices,
        openBalance: parseFloat(openBalance) || 0,
        activeROs,
      },
      recentSalesOrders: recentSOs,
      recentInvoices,
      recentRepairOrders: recentROs,
    })
  } catch (error) {
    console.error('Portal dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    )
  }
}
