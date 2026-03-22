// Legacy type for old inventory table (genthrust_inventory DB)
export interface InventoryItem {
  id: number
  part_number: string
  serial_number: string | null
  description: string | null
  quantity: number | null
  location: string | null
  bin: string | null
  condition: string | null
  cost: number | null
  sell_price: number | null
  source_file: string | null
}

// Type matching /api/search response shape (ERP AERO fields)
export interface PartResult {
  id: number
  erp_product_id?: number
  part_number: string
  description: string | null
  mfr_part_no: string | null
  nsn_number: string | null
  cage_code: string | null
  serial_number: string | null
  manufacturer_name: string | null
  location: string | null
  hazmat: boolean | number
  product_category: string | null
  is_portal_item: boolean | number
}

// New types matching ERP AERO cache schema

export interface Part {
  id: number
  erp_product_id: number
  product_name: string
  description: string | null
  full_description: string | null
  nsn_number: string | null
  cage_code: string | null
  mfr_part_no: string | null
  hazmat: boolean
  hazmat_class: string | null
  is_portal_item: boolean
  manufacturer_name: string | null
  warehouse_title: string | null
  product_category: string | null
  condition_code?: string | null
}

export interface CatalogItem {
  id: number
  erp_product_id: number
  part_name: string
  description: string | null
  condition_code: string | null
  quantity: number
  uom: string
  unit_price: number | null
  public_price: number | null
  cage_code: string | null
  certs: string | null
  is_hazmat: boolean
  serial_number: string | null
  main_image_url: string | null
  currency_code: string
}

export interface RepairOrder {
  id: number
  erp_po_id: number
  ro_number: string
  vendor_name: string | null
  contact_name: string | null
  status: string | null
  priority: string | null
  due_date: string | null
  total: number | null
  erp_created_at: string | null
  erp_modified_at: string | null
}

export interface SalesOrder {
  id: number
  erp_so_id: number
  so_number: string
  customer_po: string | null
  customer_name: string | null
  contact_name: string | null
  status: string | null
  priority: string | null
  due_date: string | null
  total: number | null
  track_no: string | null
  erp_created_at: string | null
}

export interface Invoice {
  id: number
  erp_invoice_id: number
  invoice_no: string
  account_name: string | null
  contact_name: string | null
  so_number: string | null
  customer_po: string | null
  status: string | null
  due_date: string | null
  invoice_date: string | null
  total: number | null
  open_balance: number | null
  track_no: string | null
}

export interface Quote {
  id: number
  erp_quote_id: number
  quote_no: string
  account_name: string | null
  contact_name: string | null
  stage: string | null
  priority: string | null
  total: number | null
  valid_until: string | null
}

export interface Company {
  id: number
  erp_company_id: number
  company_name: string
  account_type: string | null
  rating: string | null
  email: string | null
  phone: string | null
  website: string | null
  territory: string | null
  is_account: boolean
  is_vendor: boolean
}

export interface DashboardStats {
  totalParts: number
  totalCompanies: number
  activeRepairOrders: number
  activeSalesOrders: number
  openInvoices: number
  openInvoiceBalance: number
  pendingQuotes: number
  pendingRfqs: number
  totalDocuments: number
  recentRepairOrders: RepairOrder[]
  recentSalesOrders: SalesOrder[]
  recentInvoices: Invoice[]
}
