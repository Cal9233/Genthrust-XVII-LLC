function getConfig() {
  return {
    baseUrl: process.env.ERP_AERO_BASE_URL || 'https://wapi.erp.aero',
    cid: process.env.ERP_AERO_CID || '',
    email: process.env.ERP_AERO_EMAIL || '',
    password: process.env.ERP_AERO_PASSWORD || '',
  }
}

let cachedToken: string | null = null

async function authenticate(): Promise<string> {
  const config = getConfig()
  const params = new URLSearchParams({
    cid: config.cid,
    email: config.email,
    password: config.password,
    type: 'user',
    source: 'genthrust-website',
  })

  const res = await fetch(`${config.baseUrl}/v1/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    throw new Error(`ERP AERO auth failed: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()

  if (!json.data?.status || !json.data?.token) {
    throw new Error(`ERP AERO auth failed: ${json.data?.message || 'Unknown error'}`)
  }

  cachedToken = json.data.token as string
  return cachedToken!
}

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken
  return authenticate()
}

async function erpFetch(path: string, retried = false): Promise<any> {
  const token = await getToken()

  const { baseUrl } = getConfig()
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401 && !retried) {
    cachedToken = null
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
  cachedToken = null
}
