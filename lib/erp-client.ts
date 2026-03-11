/**
 * ERP AERO TypeScript HTTP Client
 * ================================
 * Replicates the auth flow and API calls from C:\GenThrust\automation\erp_client.py.
 * Auth: POST /v1/auth/signin with form-urlencoded {cid, email, password} → JWT token.
 * Token cached in module-level variable with 30-min TTL.
 */

const ERP_BASE_URL = process.env.ERP_AERO_BASE_URL || process.env.ERP_BASE_URL || 'https://wapi.erp.aero'
const ERP_CID = process.env.ERP_AERO_CID || process.env.ERP_CID || ''
const ERP_EMAIL = process.env.ERP_AERO_EMAIL || process.env.ERP_EMAIL || ''
const ERP_PASSWORD = process.env.ERP_AERO_PASSWORD || process.env.ERP_PASSWORD || ''

let cachedToken: string | null = null
let tokenExpiresAt: number = 0

const TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Authenticate with ERP AERO and cache JWT token.
 */
async function signin(): Promise<string> {
  const url = `${ERP_BASE_URL.replace(/\/+$/, '')}/v1/auth/signin`

  const body = new URLSearchParams({
    cid: ERP_CID,
    email: ERP_EMAIL,
    password: ERP_PASSWORD,
    type: 'user',
    source: 'automation',
  })

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`ERP signin error ${resp.status}: ${text.substring(0, 500)}`)
  }

  const json = await resp.json()
  const data = json?.data
  if (!data?.status) {
    throw new Error(`ERP signin rejected: ${data?.message || 'Unknown error'}`)
  }

  cachedToken = data.token
  tokenExpiresAt = Date.now() + TOKEN_TTL_MS
  return cachedToken!
}

/**
 * Get auth headers, refreshing token if needed.
 */
async function getHeaders(): Promise<Record<string, string>> {
  if (!cachedToken || Date.now() >= tokenExpiresAt) {
    await signin()
  }
  return {
    Authorization: `Bearer ${cachedToken}`,
    Accept: 'application/json',
  }
}

/**
 * Generic GET against ERP AERO API. Auto-retries signin on 401.
 */
async function erpGet(endpoint: string, params?: Record<string, string>): Promise<any> {
  const base = ERP_BASE_URL.replace(/\/+$/, '')
  const url = new URL(`${base}/${endpoint.replace(/^\/+/, '')}`)
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, val)
    }
  }

  let headers = await getHeaders()
  let resp = await fetch(url.toString(), { headers })

  // If 401, re-signin and retry once
  if (resp.status === 401) {
    cachedToken = null
    headers = await getHeaders()
    resp = await fetch(url.toString(), { headers })
  }

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`ERP API error ${resp.status}: ${text.substring(0, 500)}`)
  }

  return resp.json()
}

/**
 * Extract list items from ERP AERO's standard response envelope.
 * Response shape: { res: 1, data: { list: [...] } }
 */
function unwrapList(raw: any): any[] {
  if (Array.isArray(raw)) return raw
  const data = raw?.data
  if (Array.isArray(data)) return data
  if (data?.list && Array.isArray(data.list)) return data.list
  return []
}

/**
 * Fetch all pages from a paginated ERP AERO list endpoint.
 */
async function fetchAllPages(endpoint: string, maxPages: number = 20): Promise<any[]> {
  const allItems: any[] = []
  for (let page = 1; page <= maxPages; page++) {
    const raw = await erpGet(endpoint, {
      direction: 'desc',
      order: 'modified_time',
      page_size: '25',
      page: String(page),
    })
    const items = unwrapList(raw)
    if (items.length === 0) break
    allItems.push(...items)
  }
  return allItems
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ERPPurchaseOrder {
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

export async function getOpenPurchaseOrders(): Promise<ERPPurchaseOrder[]> {
  const items = await fetchAllPages('v1/po/list')
  const orders: ERPPurchaseOrder[] = []

  for (const item of items) {
    const b = item.body || item
    const status = b.status || ''
    const terms = b.payment_terms || ''

    // Only open POs with NET terms
    if (['Closed', 'Cancelled', 'Completed'].includes(status)) continue
    if (!terms.toLowerCase().includes('net')) continue

    orders.push({
      po_number: b.po_number || b.pn || '',
      vendor: b.vendor_name || b.vendor || '',
      po_date: b.po_date || b.created_time || null,
      total: parseFloat(b.total || '0') || 0,
      status,
      payment_terms: terms || null,
      due_date: b.due_date || null,
      priority: b.priority || null,
      ship_via: b.ship_via || null,
    })
  }

  return orders
}

export interface ERPRepairOrder {
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

export async function getActiveRepairOrders(limit: number = 50): Promise<ERPRepairOrder[]> {
  const items = await fetchAllPages('v1/ro/list')
  const orders: ERPRepairOrder[] = []

  for (const item of items) {
    const b = item.body || item
    const status = b.status || ''
    if (['Closed', 'Cancelled'].includes(status)) continue

    orders.push({
      ro_number: b.ro_number || '',
      ro_id: b.ro_id || b.id || 0,
      vendor: b.vendor_name || b.vendor || '',
      contact: b.contact_name || null,
      status,
      due_date: b.due_date || null,
      total: parseFloat(b.total || '0') || 0,
      payment_terms: b.payment_terms || null,
      priority: b.priority || null,
      date_received: b.date_received || null,
      last_modified: b.modified_time || null,
    })
  }

  return orders.slice(0, limit)
}

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

export async function getNet30PaymentDates(): Promise<{
  summary: { past_due: number; due_soon: number; upcoming: number }
  orders: Net30Order[]
}> {
  const items = await fetchAllPages('v1/ro/list')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const orders: Net30Order[] = []

  for (const item of items) {
    const b = item.body || item
    const status = b.status || ''
    const terms = b.payment_terms || ''

    // Only Received ROs with NET terms
    if (status !== 'Received') continue
    if (!terms.toLowerCase().includes('net')) continue

    const netDays = parseInt(terms.replace(/\D/g, '')) || 30
    const receivedDate = b.date_received ? new Date(b.date_received) : null
    let dueDate: Date | null = null
    let statusFlag: Net30Order['status_flag'] = null
    let daysOverdue: number | undefined
    let daysUntilDue: number | undefined

    if (receivedDate) {
      dueDate = new Date(receivedDate)
      dueDate.setDate(dueDate.getDate() + netDays)

      const delta = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (delta < 0) {
        statusFlag = 'PAST_DUE'
        daysOverdue = Math.abs(delta)
      } else if (delta <= 7) {
        statusFlag = 'DUE_SOON'
        daysUntilDue = delta
      } else {
        statusFlag = 'UPCOMING'
        daysUntilDue = delta
      }
    }

    orders.push({
      ro_number: b.ro_number || '',
      ro_id: b.ro_id || b.id || 0,
      vendor: b.vendor_name || b.vendor || '',
      total: parseFloat(b.total || '0') || 0,
      payment_terms: terms,
      received_date: receivedDate?.toISOString().split('T')[0] || null,
      payment_due_date: dueDate?.toISOString().split('T')[0] || null,
      status_flag: statusFlag,
      days_overdue: daysOverdue,
      days_until_due: daysUntilDue,
    })
  }

  // Sort: past due first, then by due date ascending
  orders.sort((a, b) => {
    const da = a.payment_due_date || '9999-12-31'
    const db = b.payment_due_date || '9999-12-31'
    return da.localeCompare(db)
  })

  return {
    summary: {
      past_due: orders.filter(o => o.status_flag === 'PAST_DUE').length,
      due_soon: orders.filter(o => o.status_flag === 'DUE_SOON').length,
      upcoming: orders.filter(o => o.status_flag === 'UPCOMING').length,
    },
    orders,
  }
}

export interface FollowupRO {
  ro_number: string
  ro_id: number | string
  vendor: string
  status: string
  total: number
  payment_terms: string | null
}

export async function getFollowupROs(): Promise<{
  statuses: { Approved: number; Delivered: number }
  orders: FollowupRO[]
}> {
  const items = await fetchAllPages('v1/ro/list')
  const orders: FollowupRO[] = []

  for (const item of items) {
    const b = item.body || item
    const status = b.status || ''
    if (!['Approved', 'Delivered'].includes(status)) continue

    orders.push({
      ro_number: b.ro_number || '',
      ro_id: b.ro_id || b.id || 0,
      vendor: b.vendor_name || b.vendor || '',
      status,
      total: parseFloat(b.total || '0') || 0,
      payment_terms: b.payment_terms || null,
    })
  }

  return {
    statuses: {
      Approved: orders.filter(o => o.status === 'Approved').length,
      Delivered: orders.filter(o => o.status === 'Delivered').length,
    },
    orders,
  }
}

export async function searchErpParts(query: string, page: number = 1): Promise<{
  query: string
  count: number
  parts: any[]
}> {
  const raw = await erpGet('v1/part/list', {
    search: query,
    page: String(page),
    page_size: '25',
  })
  const items = unwrapList(raw)

  const parts = items.map((item: any) => {
    const b = item.body || item
    return {
      part_number: b.pn || b.part_number || b.productname || '',
      description: b.description || b.full_description || '',
      condition: b.condition || b.condition_code || '',
      quantity: parseInt(String(b.qty ?? b.quantity ?? 0), 10) || 0,
      unit_price: parseFloat(String(b.unit_price || 0)) || 0,
      warehouse: typeof b.warehouse === 'object' ? (b.warehouse?.title || '') : (b.warehouse || ''),
      serial_number: b.serial_no || b.serial_number || null,
    }
  })

  return { query, count: parts.length, parts }
}

/**
 * Fetch live ERP data for a specific part, optionally filtered by condition.
 * Used by the watchlist alarm system to check current quantity.
 */
export async function getPartLiveData(
  partNumber: string,
  conditionFilter?: string
): Promise<{ part_number: string; condition: string; quantity: number }[]> {
  const raw = await erpGet('v1/part/list', {
    search: partNumber,
    page: '1',
    page_size: '50',
  })
  const items = unwrapList(raw)

  const results: { part_number: string; condition: string; quantity: number }[] = []

  for (const item of items) {
    const b = item.body || item
    const pn = b.pn || b.part_number || b.productname || ''
    const cond = b.condition || b.condition_code || ''
    const qty = parseInt(String(b.qty ?? b.quantity ?? 0), 10) || 0

    // Exact part number match
    if (pn.toUpperCase() !== partNumber.toUpperCase()) continue
    // Condition filter if specified
    if (conditionFilter && cond.toUpperCase() !== conditionFilter.toUpperCase()) continue

    results.push({ part_number: pn, condition: cond, quantity: qty })
  }

  return results
}
