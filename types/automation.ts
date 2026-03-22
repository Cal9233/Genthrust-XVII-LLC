import type {
  Net30Order,
  FollowupRO,
  ERPPurchaseOrder,
  ERPRepairOrder,
} from '@/lib/types/erp-shared'

export type { Net30Order, FollowupRO, ERPPurchaseOrder }

/** Dashboard-specific subset of ERPRepairOrder (fewer fields) */
export type RepairOrderERP = Pick<
  ERPRepairOrder,
  'ro_number' | 'vendor' | 'status' | 'due_date' | 'total'
> & { ro_id: number | string }

/** Alias for backward compat — PurchaseOrder = ERPPurchaseOrder */
export type PurchaseOrder = ERPPurchaseOrder

export interface AutomationDashboardData {
  net30: {
    summary: { past_due: number; due_soon: number; upcoming: number }
    orders: Net30Order[]
  }
  followups: {
    statuses: { Approved: number; Delivered: number }
    orders: FollowupRO[]
  }
  purchaseOrders: PurchaseOrder[]
  repairOrders: RepairOrderERP[]
}
