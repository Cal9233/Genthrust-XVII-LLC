/**
 * Tests for:
 *   POST /api/internal/sync/parts
 *   GET  /api/internal/audit-log
 *   GET  /api/internal/diagnostics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mock variables (must be hoisted to avoid TDZ errors) ─────────────
const { mockAuth, mockSyncParts, mockQuery, mockInventoryQuery } =
  vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockSyncParts: vi.fn(),
    mockQuery: vi.fn(),
    mockInventoryQuery: vi.fn(),
  }))

// ─── Auth mock ───────────────────────────────────────────────────────────────
vi.mock('@/auth', () => ({ auth: mockAuth }))

// ─── sync-parts script mock ───────────────────────────────────────────────────
vi.mock('@/scripts/sync-parts', () => ({
  syncParts: mockSyncParts,
}))

// ─── Main DB mock (@/lib/db query) ────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  query: mockQuery,
}))

// ─── Inventory DB mock ────────────────────────────────────────────────────────
vi.mock('@/lib/inventory-db', () => ({
  inventoryQuery: mockInventoryQuery,
}))

import { POST as postSyncPartsRoute } from '@/app/api/internal/sync/parts/route'
import { GET as getAuditLogRoute } from '@/app/api/internal/audit-log/route'
import { GET as getDiagnosticsRoute } from '@/app/api/internal/diagnostics/route'
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

function makeRequest(method: string, url: string): NextRequest {
  return new NextRequest(url, { method })
}

// ─── POST /api/internal/sync/parts ───────────────────────────────────────────
describe('POST /api/internal/sync/parts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('POST', 'http://localhost/api/internal/sync/parts')
    const res = await postSyncPartsRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client' } })
    const req = makeRequest('POST', 'http://localhost/api/internal/sync/parts')
    const res = await postSyncPartsRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with success and count on incremental sync', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockSyncParts.mockResolvedValue(150)
    const req = makeRequest('POST', 'http://localhost/api/internal/sync/parts')
    const res = await postSyncPartsRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.count).toBe(150)
    expect(body.mode).toBe('incremental')
    expect(mockSyncParts).toHaveBeenCalledWith(false)
  })

  it('runs full sync when ?full=true is passed', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockSyncParts.mockResolvedValue(500)
    const req = makeRequest('POST', 'http://localhost/api/internal/sync/parts?full=true')
    const res = await postSyncPartsRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mode).toBe('full')
    expect(mockSyncParts).toHaveBeenCalledWith(true)
  })

  it('returns 200 for admin role', async () => {
    mockAuth.mockResolvedValue(makeAdminSession())
    mockSyncParts.mockResolvedValue(0)
    const req = makeRequest('POST', 'http://localhost/api/internal/sync/parts')
    const res = await postSyncPartsRoute(req)
    expect(res.status).toBe(200)
  })

  it('returns 409 when advisory lock is already held', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockSyncParts.mockRejectedValue(
      new Error('Another parts sync is already in progress')
    )
    const req = makeRequest('POST', 'http://localhost/api/internal/sync/parts')
    const res = await postSyncPartsRoute(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Conflict')
    expect(body.details).toMatch(/already in progress/i)
  })

  it('returns 500 for generic sync errors', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockSyncParts.mockRejectedValue(new Error('Database connection lost'))
    const req = makeRequest('POST', 'http://localhost/api/internal/sync/parts')
    const res = await postSyncPartsRoute(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Parts sync failed')
  })
})

// ─── GET /api/internal/audit-log ─────────────────────────────────────────────
describe('GET /api/internal/audit-log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const makeAuditLogRequest = (params = '') =>
    makeRequest('GET', `http://localhost/api/internal/audit-log${params ? '?' + params : ''}`)

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await getAuditLogRoute(makeAuditLogRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client' } })
    const res = await getAuditLogRoute(makeAuditLogRequest())
    expect(res.status).toBe(401)
  })

  it('returns 200 with logs, total, page, limit on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const fakeLogs = [
      { id: 1, action: 'BOT_RESTART', user_id: '1', timestamp: '2026-03-22T10:00:00Z' },
    ]
    mockQuery
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce(fakeLogs)

    const res = await getAuditLogRoute(makeAuditLogRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('logs')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('page')
    expect(body).toHaveProperty('limit')
    expect(body.logs).toEqual(fakeLogs)
    expect(body.total).toBe(1)
  })

  it('defaults page=1 and limit=50 when not specified', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValue([])
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([])

    const res = await getAuditLogRoute(makeAuditLogRequest())
    const body = await res.json()
    expect(body.page).toBe(1)
    expect(body.limit).toBe(50)
  })

  it('caps limit at 200', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([])

    const res = await getAuditLogRoute(makeAuditLogRequest('limit=9999'))
    const body = await res.json()
    expect(body.limit).toBe(200)
  })

  it('applies user_id filter when provided', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([])

    await getAuditLogRoute(makeAuditLogRequest('user_id=42'))
    // Both queries (count + data) should include user_id = ? in WHERE clause
    const [[countSql, countParams]] = mockQuery.mock.calls
    expect(countSql).toContain('user_id = ?')
    expect(countParams).toContain('42')
  })

  it('applies user_email LIKE filter when provided', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([])

    await getAuditLogRoute(makeAuditLogRequest('user_email=genthrust'))
    const [[countSql, countParams]] = mockQuery.mock.calls
    expect(countSql).toContain('user_email LIKE ?')
    expect(countParams).toContain('%genthrust%')
  })

  it('filters by success=true', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([])

    await getAuditLogRoute(makeAuditLogRequest('success=true'))
    const [[countSql, countParams]] = mockQuery.mock.calls
    expect(countSql).toContain('success = ?')
    expect(countParams).toContain(1)
  })

  it('filters by success=false', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([])

    await getAuditLogRoute(makeAuditLogRequest('success=false'))
    const [[countSql, countParams]] = mockQuery.mock.calls
    expect(countParams).toContain(0)
  })

  it('applies start_date and end_date filters', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([])

    await getAuditLogRoute(makeAuditLogRequest('start_date=2026-03-01&end_date=2026-03-31'))
    const [[countSql, countParams]] = mockQuery.mock.calls
    expect(countSql).toContain('timestamp >=')
    expect(countSql).toContain('timestamp <=')
    expect(countParams).toContain('2026-03-01')
    expect(countParams).toContain('2026-03-31')
  })

  it('returns 200 for admin role', async () => {
    mockAuth.mockResolvedValue(makeAdminSession())
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([])

    const res = await getAuditLogRoute(makeAuditLogRequest())
    expect(res.status).toBe(200)
  })

  it('returns 500 when database query throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValue(new Error('DB error'))
    const res = await getAuditLogRoute(makeAuditLogRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to load audit logs')
  })
})

// ─── GET /api/internal/diagnostics ───────────────────────────────────────────
describe('GET /api/internal/diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await getDiagnosticsRoute()
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client' } })
    const res = await getDiagnosticsRoute()
    expect(res.status).toBe(401)
  })

  it('returns 200 with both DBs connected', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    // main DB SELECT 1, inventory DB SELECT 1 x2
    mockQuery.mockResolvedValue([{ '1': 1 }])
    mockInventoryQuery.mockResolvedValue([{ '1': 1 }])

    const res = await getDiagnosticsRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mainDb.connected).toBe(true)
    expect(body.inventoryDb.connected).toBe(true)
    expect(body.inventoryConnected).toBe(true)
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('role')
  })

  it('reports mainDb.connected=false when main DB is down', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValue(new Error('ECONNREFUSED'))
    mockInventoryQuery.mockResolvedValue([{ '1': 1 }])

    const res = await getDiagnosticsRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mainDb.connected).toBe(false)
    expect(body.inventoryDb.connected).toBe(true)
  })

  it('reports inventoryDb.connected=false when inventory DB is down', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValue([{ '1': 1 }])
    mockInventoryQuery.mockRejectedValue(new Error('ETIMEDOUT'))

    const res = await getDiagnosticsRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mainDb.connected).toBe(true)
    expect(body.inventoryDb.connected).toBe(false)
    expect(body.inventoryConnected).toBe(false)
  })

  it('returns 200 for admin role', async () => {
    mockAuth.mockResolvedValue(makeAdminSession())
    mockQuery.mockResolvedValue([])
    mockInventoryQuery.mockResolvedValue([])

    const res = await getDiagnosticsRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.role).toBe('admin')
  })

  it('exposes role from session in response', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockResolvedValue([])
    mockInventoryQuery.mockResolvedValue([])

    const res = await getDiagnosticsRoute()
    const body = await res.json()
    expect(body.role).toBe('internal')
  })
})
