/**
 * TDD RED phase — tests for document routes
 *
 * Route files do NOT exist yet:
 *   app/api/portal/documents/route.ts              (GET list)
 *   app/api/portal/documents/[id]/download/route.ts (GET file download)
 *
 * All tests should FAIL (import error) until production files are created.
 *
 * GET  /api/portal/documents              → { documents: Document[] }
 * GET  /api/portal/documents/[id]/download → File stream (NextResponse with blob/stream)
 *
 * Auth: getPortalContext() — role must be 'client'.
 * Isolation: documents are scoped to the authenticated company_id.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @/auth and @/lib/db
// ---------------------------------------------------------------------------

const mockAuth = vi.fn()
vi.mock('@/auth', () => ({
  auth: mockAuth,
}))

const mockQuery = vi.fn()
vi.mock('@/lib/db', () => ({
  query: mockQuery,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClientSession(companyId: number) {
  return {
    user: {
      id: 'user-1',
      email: 'client@example.com',
      role: 'client',
      companyId,
    },
  }
}

function makeListRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/portal/documents')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new Request(url.toString())
}

function makeDownloadRequest(id: string) {
  return {
    params: Promise.resolve({ id }),
  } as any
}

// ---------------------------------------------------------------------------
// GET /api/portal/documents — list
// ---------------------------------------------------------------------------

describe('GET /api/portal/documents', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/portal/documents/route')
    const res = await GET(makeListRequest())
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns documents for the authenticated company', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    const docs = [
      { id: 1, company_id: 1, name: 'Invoice INV-001.pdf', type: 'invoice', created_at: '2026-03-01' },
      { id: 2, company_id: 1, name: 'SO-005 Packing List.pdf', type: 'packing_list', created_at: '2026-03-10' },
    ]
    mockQuery.mockResolvedValueOnce(docs)

    const { GET } = await import('@/app/api/portal/documents/route')
    const res = await GET(makeListRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.documents).toHaveLength(2)
    expect(body.documents[0]).toHaveProperty('name')
    expect(body.documents[0]).toHaveProperty('type')
  })

  it('returns empty documents array for a company with no documents', async () => {
    mockAuth.mockResolvedValue(makeClientSession(3))
    mockQuery.mockResolvedValueOnce([{ company_name: 'No Docs Co' }])
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/documents/route')
    const res = await GET(makeListRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.documents).toEqual([])
  })

  it('filters by type query param (?type=invoice)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([
      { id: 1, company_id: 1, name: 'Invoice INV-001.pdf', type: 'invoice', created_at: '2026-03-01' },
    ])

    const { GET } = await import('@/app/api/portal/documents/route')
    const res = await GET(makeListRequest({ type: 'invoice' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    // SQL must include the type filter
    const dataSql = mockQuery.mock.calls[1][0] as string
    const dataParams = mockQuery.mock.calls[1][1] as any[]
    expect(dataSql.toLowerCase()).toContain('type')
    expect(dataParams).toContain('invoice')
    for (const doc of body.documents) {
      expect(doc.type).toBe('invoice')
    }
  })
})

// ---------------------------------------------------------------------------
// GET /api/portal/documents/[id]/download
// ---------------------------------------------------------------------------

describe('GET /api/portal/documents/[id]/download', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/portal/documents/[id]/download/route')
    const res = await GET({} as any, makeDownloadRequest('1'))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns the file for an authorized document (200 with content)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    // Document lookup returns a row with file data
    const doc = { id: 1, company_id: 1, name: 'Invoice.pdf', type: 'invoice', file_path: '/files/invoice-001.pdf', mime_type: 'application/pdf' }
    mockQuery.mockResolvedValueOnce([doc])

    const { GET } = await import('@/app/api/portal/documents/[id]/download/route')
    const res = await GET({} as any, makeDownloadRequest('1'))

    // Should be a successful file response (200 or a redirect/stream)
    expect(res.status).toBe(200)
  })

  it('returns 404 for a non-existent document', async () => {
    mockAuth.mockResolvedValue(makeClientSession(1))
    mockQuery.mockResolvedValueOnce([{ company_name: 'ACME Corp' }])
    mockQuery.mockResolvedValueOnce([]) // no rows

    const { GET } = await import('@/app/api/portal/documents/[id]/download/route')
    const res = await GET({} as any, makeDownloadRequest('9999'))
    expect(res.status).toBe(404)
  })

  it('returns 404 for a document belonging to a different company (cross-company block)', async () => {
    mockAuth.mockResolvedValue(makeClientSession(2)) // company 2
    mockQuery.mockResolvedValueOnce([{ company_name: 'Other Corp' }])
    // Document query scoped by company; returns empty because doc belongs to company 1
    mockQuery.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/portal/documents/[id]/download/route')
    const res = await GET({} as any, makeDownloadRequest('1'))
    expect(res.status).toBe(404)
  })
})
