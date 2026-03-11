import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
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

    const [net30, followups, purchaseOrders, repairOrders] = await Promise.all([
      getNet30PaymentDates().catch(err => {
        console.error('NET30 fetch error:', err)
        return { summary: { past_due: 0, due_soon: 0, upcoming: 0 }, orders: [] }
      }),
      getFollowupROs().catch(err => {
        console.error('Followup ROs fetch error:', err)
        return { statuses: { Approved: 0, Delivered: 0 }, orders: [] }
      }),
      getOpenPurchaseOrders().catch(err => {
        console.error('PO fetch error:', err)
        return []
      }),
      getActiveRepairOrders(50).catch(err => {
        console.error('RO fetch error:', err)
        return []
      }),
    ])

    return NextResponse.json({ net30, followups, purchaseOrders, repairOrders })
  } catch (error) {
    console.error('Automation API error:', error)
    return NextResponse.json({ error: 'Failed to load automation data' }, { status: 500 })
  }
}
