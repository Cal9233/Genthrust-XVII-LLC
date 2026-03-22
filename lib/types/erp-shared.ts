export interface ERPAuthResponse {
  data: {
    status: boolean;
    token: string;
    message?: string;
  };
}

export interface ErpPartItem {
  part_number: string;
  description: string;
  condition: string;
  quantity: number;
  unit_price: number;
  warehouse: string;
  serial_number: string | null;
}

export interface ERPRepairOrder {
  ro_number: string;
  ro_id: number | string;
  vendor: string;
  contact: string | null;
  status: string;
  due_date: string | null;
  total: number;
  payment_terms: string | null;
  priority: string | null;
  date_received: string | null;
  last_modified: string | null;
}

export interface ERPPurchaseOrder {
  po_number: string;
  vendor: string;
  po_date: string | null;
  total: number;
  status: string;
  payment_terms: string | null;
  due_date: string | null;
  priority: string | null;
  ship_via: string | null;
}

export interface Net30Order {
  ro_number: string;
  ro_id: number | string;
  vendor: string;
  total: number;
  payment_terms: string;
  received_date: string | null;
  payment_due_date: string | null;
  status_flag: 'PAST_DUE' | 'DUE_SOON' | 'UPCOMING' | null;
  days_overdue?: number;
  days_until_due?: number;
}

export interface FollowupRO {
  ro_number: string;
  ro_id: number | string;
  vendor: string;
  status: string;
  total: number;
  payment_terms: string | null;
}
