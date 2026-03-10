export interface Net30Order {
  ro_number: string
  ro_id: number | string
  vendor: string
  total: number
  payment_terms: string
  received_date: string | null
  payment_due_date: string | null
  status_flag: 'PAST_DUE' | 'DUE_SOON' | 'UPCOMING' | null
  days_overdue?: number
  days_until_due?: number
}

export interface FollowupRO {
  ro_number: string
  ro_id: number | string
  vendor: string
  status: string
  total: number
  payment_terms: string | null
}

export interface PurchaseOrder {
  po_number: string
  vendor: string
  po_date: string | null
  total: number
  status: string
  payment_terms: string | null
  due_date: string | null
  priority: string | null
  ship_via: string | null
}

export interface RepairOrderERP {
  ro_number: string
  ro_id: number | string
  vendor: string
  contact: string | null
  status: string
  due_date: string | null
  total: number
  payment_terms: string | null
  priority: string | null
  date_received: string | null
  last_modified: string | null
}

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
