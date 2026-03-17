// Use consolidated token manager from erp-client.ts to prevent dual-token race conditions
import { getConfig, getHeaders, clearErpTokenCache } from './erp-client'

async function erpFetch(path: string, retried = false): Promise<any> {
  const headers = await getHeaders()
  const { baseUrl } = getConfig()

  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  })

  if (res.status === 401 && !retried) {
    clearErpTokenCache()
    return erpFetch(path, true)
  }

  if (!res.ok) {
    throw new Error(`ERP AERO request failed: ${res.status} ${res.statusText} - ${path}`)
  }

  return res.json()
}

export interface ErpPartListResponse {
  res: number
  data: {
    list: ErpPartItem[]
    limit: number
    total: number
  }
}

export interface ErpPartItem {
  body: {
    productid: number
    productname: string
    description: string | null
    full_description: string | null
    nsnnumber: string | null
    cage_code: string | null
    mfr_part_no: string | null
    hazmat: number
    hazmatclass: string | null
    is_portal_item: number
    serial_no: string | null
    productcategory: string | null
    createdtime: string | null
    modified_time: string | null
    warehouse: { title: string | null }
    manufacturer: { vendornameOEM: string | null }
  }
}

export async function getPartsList(page = 1, pageSize = 100): Promise<ErpPartListResponse> {
  const params = new URLSearchParams({
    direction: 'desc',
    order: 'modified_time',
    page: String(page),
    page_size: String(pageSize),
  })
  return erpFetch(`/v1/part/list?${params}`)
}

export async function getPartDetails(productId: number): Promise<any> {
  return erpFetch(`/v1/part/details?product_id=${productId}`)
}

export function clearTokenCache() {
  clearErpTokenCache()
}
