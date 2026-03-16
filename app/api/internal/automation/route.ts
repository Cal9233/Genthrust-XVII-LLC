import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  getAllRepairOrderItems,
  getNet30PaymentDates,
  getFollowupROs,
  getOpenPurchaseOrders,
  getActiveRepairOrders,
} from '@/lib/erp-client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch RO list once; PO list is a separate endpoint so it runs in parallel
    const [roItems, purchaseOrders] = await Promise.all([
      getAllRepairOrderItems().catch(err => {
        console.error('RO list fetch error:', err)
        return [] as any[]
      }),
      getOpenPurchaseOrders().catch(err => {
        console.error('PO fetch error:', err)
        return []
      }),
    ])

    // Process the single RO list through all three views in parallel
    const [net30, followups, repairOrders] = await Promise.all([
      getNet30PaymentDates(roItems).catch(err => {
        console.error('NET30 fetch error:', err)
        return { summary: { past_due: 0, due_soon: 0, upcoming: 0 }, orders: [] }
      }),
      getFollowupROs(roItems).catch(err => {
        console.error('Followup ROs fetch error:', err)
        return { statuses: { Approved: 0, Delivered: 0 }, orders: [] }
      }),
      getActiveRepairOrders(50, roItems).catch(err => {
        console.error('RO fetch error:', err)
        return []
      }),
    ])

    return NextResponse.json({ net30, followups, purchaseOrders, repairOrders })
  } catch (error) {
    console.error('Automation API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load automation data' }, { status: 500 })
  }
}
