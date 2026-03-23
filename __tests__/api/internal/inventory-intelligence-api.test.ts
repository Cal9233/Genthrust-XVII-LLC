/**
 * Tests for /api/internal/inventory-intelligence/* routes
 * Covers: GET /list, GET /search, POST /batch-search, POST /add, POST /parse-pdf
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mock variables (must be hoisted to avoid TDZ errors) ─────────────
const {
  mockAuth,
  mockInventoryQuery,
  mockSearchErpParts,
  mockParseCCheckPdf,
  mockGetText,
  mockDestroy,
  MockPDFParse,
} = vi.hoisted(() => {
  const mockGetText = vi.fn()
  const mockDestroy = vi.fn()
  // Must use a regular function (not arrow) so `new PDFParse()` works as a constructor
  function MockPDFParseImpl(this: any) {
    this.getText = mockGetText
    this.destroy = mockDestroy
  }
  return {
    mockAuth: vi.fn(),
    mockInventoryQuery: vi.fn(),
    mockSearchErpParts: vi.fn(),
    mockParseCCheckPdf: vi.fn(),
    mockGetText,
    mockDestroy,
    MockPDFParse: MockPDFParseImpl,
  }
})

// ─── Auth mock ───────────────────────────────────────────────────────────────
vi.mock('@/auth', () => ({ auth: mockAuth }))

// ─── inventory-db mock ────────────────────────────────────────────────────────
vi.mock('@/lib/inventory-db', () => ({
  inventoryQuery: mockInventoryQuery,
}))

// ─── erp-client mock ─────────────────────────────────────────────────────────
vi.mock('@/lib/erp-client', () => ({
  searchErpParts: mockSearchErpParts,
}))

// ─── pdf-parser mock ──────────────────────────────────────────────────────────
vi.mock('@/lib/pdf-parser', () => ({
  parseCCheckPdf: mockParseCCheckPdf,
}))

// ─── pdf-parse dynamic import mock ───────────────────────────────────────────
vi.mock('pdf-parse', () => ({
  PDFParse: MockPDFParse,
}))

// ─── fs mock (for sync cache check in intelligence route) ────────────────────
vi.mock('fs', () => ({
  default: {
    statSync: vi.fn().mockImplementation(() => {
      throw new Error('File not found')
    }),
  },
}))

import { GET as getIntelligenceRoute } from '@/app/api/internal/inventory-intelligence/route'
import { GET as getSearchRoute } from '@/app/api/internal/inventory-intelligence/search/route'
import { POST as postBatchSearchRoute } from '@/app/api/internal/inventory-intelligence/batch-search/route'
import { POST as postAddRoute } from '@/app/api/internal/inventory-intelligence/add/route'
import { POST as postParsePdfRoute } from '@/app/api/internal/inventory-intelligence/parse-pdf/route'
import { NextRequest } from 'next/server'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeInternalSession(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: '1', email: 'admin@genthrust.net', role: 'internal', ...overrides },
  }
}

function makeAdminSession() {
  return { user: { id: '2', email: 'cal@genthrust.net', role: 'admin' } }
}

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(url, init)
}

// Build a minimal valid PDF buffer (starts with %PDF-)
function makePdfBuffer(size = 100): Buffer {
  const buf = Buffer.alloc(size, 0x00)
  buf[0] = 0x25 // %
  buf[1] = 0x50 // P
  buf[2] = 0x44 // D
  buf[3] = 0x46 // F
  buf[4] = 0x2d // -
  return buf
}

// ─── GET /api/internal/inventory-intelligence ─────────────────────────────────
describe('GET /api/internal/inventory-intelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await getIntelligenceRoute()
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client' } })
    const res = await getIntelligenceRoute()
    expect(res.status).toBe(401)
  })

  it('returns 200 with full intelligence payload on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery
      .mockResolvedValueOnce([{ pendingDrafts: 3 }])
      .mockResolvedValueOnce([{ committedStock: '50' }])
      .mockResolvedValueOnce([{ totalSkus: 200 }])
      .mockResolvedValueOnce([{ todayAlerts: 5 }])
      .mockResolvedValueOnce([{ condition: 'NE', count: 10, qty: 40 }])
      .mockResolvedValueOnce([{ part_number: 'PN-1', sold_last_30d: 5 }])
      .mockResolvedValueOnce([{ id: 1, alert_type: 'LOW_STOCK', part_number: 'PN-1' }])

    const res = await getIntelligenceRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('summary')
    expect(body).toHaveProperty('conditionBreakdown')
    expect(body).toHaveProperty('salesVelocity')
    expect(body).toHaveProperty('alerts')
    expect(body).toHaveProperty('syncStatus')
    expect(body).toHaveProperty('dbConnected')
    expect(body.summary.pendingDrafts).toBe(3)
    expect(body.summary.totalSkus).toBe(200)
    expect(body.summary.todayAlerts).toBe(5)
  })

  it('returns 200 for admin role', async () => {
    mockAuth.mockResolvedValue(makeAdminSession())
    mockInventoryQuery.mockResolvedValue([])
    const res = await getIntelligenceRoute()
    expect(res.status).toBe(200)
  })

  it('marks dbConnected=false when inventory queries fail', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockRejectedValue(new Error('ECONNREFUSED'))
    const res = await getIntelligenceRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dbConnected).toBe(false)
  })

  it('syncStatus shows isStale=true when sync cache not found', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockResolvedValue([])
    const res = await getIntelligenceRoute()
    const body = await res.json()
    expect(body.syncStatus.isStale).toBe(true)
  })
})

// ─── GET /api/internal/inventory-intelligence/search ─────────────────────────
describe('GET /api/internal/inventory-intelligence/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-intelligence/search?q=PN')
    const res = await getSearchRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns empty result when q is blank', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-intelligence/search?q=')
    const res = await getSearchRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(0)
    expect(body.results).toEqual([])
  })

  it('returns empty result when q contains only whitespace', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-intelligence/search?q=   ')
    const res = await getSearchRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(0)
  })

  it('returns matching parts for a valid query', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const mockParts = [
      { part_number: 'PN-777', description: 'Bolt', condition: 'NE', quantity: 10 },
    ]
    mockInventoryQuery.mockResolvedValue(mockParts)
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-intelligence/search?q=PN-777')
    const res = await getSearchRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(1)
    expect(body.results[0].part_number).toBe('PN-777')
  })

  it('applies condition filter when provided', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockResolvedValue([])
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-intelligence/search?q=PN&condition=NE')
    await getSearchRoute(req)
    // Condition should be uppercased and passed as second param
    expect(mockInventoryQuery).toHaveBeenCalledWith(
      expect.stringContaining('condition'),
      expect.arrayContaining(['NE'])
    )
  })

  it('returns 503 for ECONNREFUSED database error', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:3306'))
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-intelligence/search?q=PN-123')
    const res = await getSearchRoute(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('Inventory database unavailable')
  })

  it('returns 500 for non-connection errors', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockRejectedValue(new Error('Syntax error in SQL'))
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-intelligence/search?q=PN-123')
    const res = await getSearchRoute(req)
    expect(res.status).toBe(500)
  })
})

// ─── POST /api/internal/inventory-intelligence/batch-search ──────────────────
describe('POST /api/internal/inventory-intelligence/batch-search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/batch-search', {
      partNumbers: ['PN-1'],
    })
    const res = await postBatchSearchRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when partNumbers is not an array', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/batch-search', {
      partNumbers: 'PN-1',
    })
    const res = await postBatchSearchRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('partNumbers array is required')
  })

  it('returns 400 when partNumbers is an empty array', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/batch-search', {
      partNumbers: [],
    })
    const res = await postBatchSearchRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when partNumbers exceeds 500 items', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/batch-search', {
      partNumbers: Array.from({ length: 501 }, (_, i) => `PN-${i}`),
    })
    const res = await postBatchSearchRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/maximum 500/i)
  })

  it('returns results with found=true for parts in local inventory', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockResolvedValue([
      { part_number: 'PN-100', description: 'Bolt', condition: 'NE', quantity: 5 },
    ])
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/batch-search', {
      partNumbers: ['PN-100'],
    })
    const res = await postBatchSearchRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.searched).toBe(1)
    expect(body.found).toBe(1)
    expect(body.notFound).toBe(0)
    expect(body.results['PN-100'].found).toBe(true)
    expect(body.results['PN-100'].inventoryMatches[0].source).toBe('local')
  })

  it('falls back to ERP for parts not in local inventory', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    // Local query returns nothing
    mockInventoryQuery.mockResolvedValue([])
    // ERP returns a match
    mockSearchErpParts.mockResolvedValue({
      parts: [{ part_number: 'PN-200', description: 'Gasket', condition: 'OH', quantity: 3 }],
    })
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/batch-search', {
      partNumbers: ['PN-200'],
    })
    const res = await postBatchSearchRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results['PN-200'].found).toBe(true)
    expect(body.results['PN-200'].inventoryMatches[0].source).toBe('erp')
  })

  it('part numbers are normalized to uppercase', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockResolvedValue([])
    mockSearchErpParts.mockResolvedValue({ parts: [] })
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/batch-search', {
      partNumbers: ['pn-lower'],
    })
    const res = await postBatchSearchRoute(req)
    const body = await res.json()
    expect(body.results).toHaveProperty('PN-LOWER')
  })

  it('includes alt PN matches under the primary PN result', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    // Local query returns alt PN match
    mockInventoryQuery.mockResolvedValue([
      { part_number: 'ALT-1', description: 'Alt part', condition: 'NE', quantity: 2 },
    ])
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/batch-search', {
      partNumbers: ['PN-PRIMARY'],
      includeAlts: { 'PN-PRIMARY': ['ALT-1'] },
    })
    const res = await postBatchSearchRoute(req)
    const body = await res.json()
    expect(body.results['PN-PRIMARY'].found).toBe(true)
  })

  it('returns 200 with no matches when inventory DB has a connection timeout (inner error is caught)', async () => {
    // The batch-search route catches inventoryQuery errors internally and continues
    // to ERP fallback — it only returns 503 for errors in the outer catch (auth/json parse).
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockRejectedValue(new Error('connect timeout'))
    mockSearchErpParts.mockResolvedValue({ parts: [] })
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/batch-search', {
      partNumbers: ['PN-999'],
    })
    const res = await postBatchSearchRoute(req)
    // Inner DB error is swallowed; route proceeds to ERP and returns 200 with not-found result
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notFound).toBe(1)
    expect(body.found).toBe(0)
  })
})

// ─── POST /api/internal/inventory-intelligence/add ───────────────────────────
describe('POST /api/internal/inventory-intelligence/add', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validBody = {
    part_number: 'pn-abc',
    description: 'Test part',
    condition: 'NE',
    quantity: 5,
  }

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/add', validBody)
    const res = await postAddRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when part_number is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/add', {
      ...validBody,
      part_number: undefined,
    })
    const res = await postAddRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/part number/i)
  })

  it('returns 400 when part_number is empty string', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/add', {
      ...validBody,
      part_number: '   ',
    })
    const res = await postAddRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid condition', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/add', {
      ...validBody,
      condition: 'XX',
    })
    const res = await postAddRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/condition/i)
  })

  it('returns 400 for quantity = 0', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/add', {
      ...validBody,
      quantity: 0,
    })
    const res = await postAddRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/quantity/i)
  })

  it('returns 400 for negative quantity', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/add', {
      ...validBody,
      quantity: -1,
    })
    const res = await postAddRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for fractional quantity', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/add', {
      ...validBody,
      quantity: 1.5,
    })
    const res = await postAddRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative unit_price', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/add', {
      ...validBody,
      unit_price: -10,
    })
    const res = await postAddRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/unit price/i)
  })

  it('returns 201 with inserted item on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockResolvedValue({ insertId: 99 })
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/add', validBody)
    const res = await postAddRoute(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(99)
    expect(body.part_number).toBe('PN-ABC') // normalized to uppercase
    expect(body.condition).toBe('NE')
    expect(body.quantity).toBe(5)
  })

  it('accepts all valid condition codes', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockResolvedValue({ insertId: 1 })
    const validConditions = ['NE', 'OH', 'SV', 'AR', 'FN', 'RP', 'NS']
    for (const condition of validConditions) {
      const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/add', {
        ...validBody,
        condition,
      })
      const res = await postAddRoute(req)
      expect(res.status).toBe(201)
    }
  })

  it('returns 503 for connection errors', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockRejectedValue(new Error('ECONNREFUSED'))
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-intelligence/add', validBody)
    const res = await postAddRoute(req)
    expect(res.status).toBe(503)
  })
})

// ─── POST /api/internal/inventory-intelligence/parse-pdf ─────────────────────
describe('POST /api/internal/inventory-intelligence/parse-pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetText.mockResolvedValue({ text: 'PN-1 NE 5\nPN-2 OH 3', total: 2 })
    mockDestroy.mockResolvedValue(undefined)
    mockParseCCheckPdf.mockReturnValue([
      { part_number: 'PN-1', condition: 'NE', quantity: 5 },
    ])
  })

  function makeFormDataRequest(overrides: {
    fileName?: string
    mimeType?: string
    size?: number
    content?: Buffer
    omitFile?: boolean
  } = {}): NextRequest {
    const {
      fileName = 'test.pdf',
      mimeType = 'application/pdf',
      size,
      content = makePdfBuffer(),
      omitFile = false,
    } = overrides

    const formData = new FormData()
    if (!omitFile) {
      const blob = new Blob([content], { type: mimeType })
      const file = new File([blob], fileName, { type: mimeType })
      // Override size if needed
      if (size !== undefined) {
        Object.defineProperty(file, 'size', { value: size })
      }
      formData.append('file', file)
    }

    return new NextRequest('http://localhost/api/internal/inventory-intelligence/parse-pdf', {
      method: 'POST',
      body: formData,
    })
  }

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeFormDataRequest()
    const res = await postParsePdfRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when no file is provided', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeFormDataRequest({ omitFile: true })
    const res = await postParsePdfRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No file provided')
  })

  it('returns 400 for non-PDF file extension', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeFormDataRequest({ fileName: 'document.txt', mimeType: 'text/plain' })
    const res = await postParsePdfRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Only PDF files are accepted')
  })

  it('returns 400 when file size exceeds 10MB', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    // Build a real buffer larger than 10 MB so file.size reflects the actual size
    const TEN_MB_PLUS_ONE = 10 * 1024 * 1024 + 1
    const largeBuf = Buffer.alloc(TEN_MB_PLUS_ONE, 0x41) // fill with 'A'
    // Prepend valid PDF magic bytes so the extension/type check passes first
    largeBuf[0] = 0x25; largeBuf[1] = 0x50; largeBuf[2] = 0x44
    largeBuf[3] = 0x46; largeBuf[4] = 0x2d
    const req = makeFormDataRequest({ content: largeBuf })
    const res = await postParsePdfRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('File exceeds 10MB limit')
  })

  it('returns 400 when file does not have PDF magic bytes', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    // A buffer that claims to be PDF but is not
    const fakePdf = Buffer.from('This is not a PDF file at all')
    const req = makeFormDataRequest({ content: fakePdf })
    const res = await postParsePdfRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid PDF file')
  })

  it('returns 200 with parsed rows on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeFormDataRequest()
    const res = await postParsePdfRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.fileName).toBe('test.pdf')
    expect(body.totalRows).toBe(1)
    expect(Array.isArray(body.rows)).toBe(true)
  })

  it('returns 200 for admin role', async () => {
    mockAuth.mockResolvedValue(makeAdminSession())
    const req = makeFormDataRequest()
    const res = await postParsePdfRoute(req)
    expect(res.status).toBe(200)
  })
})
