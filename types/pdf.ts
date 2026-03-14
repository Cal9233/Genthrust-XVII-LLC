export interface ParsedPdfRow {
  id: string
  reference: string
  referenceType: 'work_request' | 'task_card' | 'engine_change'
  description: string
  partNumber: string
  altPartNumbers: string[]
  name: string
  qty: number
  unit: string
  selected: boolean
}

export interface ParsePdfResponse {
  success: boolean
  fileName: string
  pageCount: number
  totalRows: number
  rows: ParsedPdfRow[]
}

export interface InventoryMatch {
  part_number: string
  description: string | null
  condition: string | null
  quantity: number
  warehouse_code: string | null
  unit_price: number | null
  serial_number: string | null
  source: 'local' | 'erp'
}

export interface BatchSearchResult {
  partNumber: string
  found: boolean
  inventoryMatches: InventoryMatch[]
  totalQuantity: number
}

export interface BatchSearchResponse {
  searched: number
  found: number
  notFound: number
  results: Record<string, BatchSearchResult>
}
