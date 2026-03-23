/**
 * Tests for /api/internal/inventory-alarms/* routes
 * Covers: GET /alarms, POST /check, GET /alarms/search, POST /acknowledge, GET+POST+DELETE /watchlist
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mock variables (must be hoisted to avoid TDZ errors) ─────────────
const { mockAuth, mockInventoryQuery, mockSearchErpParts, mockGetPartLiveData } =
  vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockInventoryQuery: vi.fn(),
    mockSearchErpParts: vi.fn(),
    mockGetPartLiveData: vi.fn(),
  }))

// ─── Auth mock ───────────────────────────────────────────────────────────────
vi.mock('@/auth', () => ({ auth: mockAuth }))

// ─── inventory-db mock ────────────────────────────────────────────────────────
vi.mock('@/lib/inventory-db', () => ({
  inventoryQuery: mockInventoryQuery,
}))

// ─── erp-client mock ─────────────────────────────────────────────────────────
vi.mock('@/lib/erp-client', () => ({
  searchErpParts: mockSearchErpParts,
  getPartLiveData: mockGetPartLiveData,
}))

import { GET as getAlarmsRoute } from '@/app/api/internal/inventory-alarms/route'
import { POST as postCheckRoute } from '@/app/api/internal/inventory-alarms/check/route'
import { GET as getAlarmsSearchRoute } from '@/app/api/internal/inventory-alarms/search/route'
import { POST as postAcknowledgeRoute } from '@/app/api/internal/inventory-alarms/acknowledge/route'
import {
  GET as getWatchlistRoute,
  POST as postWatchlistRoute,
  DELETE as deleteWatchlistRoute,
} from '@/app/api/internal/inventory-alarms/watchlist/route'
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

// ─── GET /api/internal/inventory-alarms ──────────────────────────────────────
describe('GET /api/internal/inventory-alarms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await getAlarmsRoute()
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client' } })
    const res = await getAlarmsRoute()
    expect(res.status).toBe(401)
  })

  it('returns 200 with alarm summary on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    // 6 parallel queries: watchedRow, alarmRow, ohRow, arRow, recentAlarms, watchlist
    mockInventoryQuery
      .mockResolvedValueOnce([{ cnt: '10' }])
      .mockResolvedValueOnce([{ cnt: '3' }])
      .mockResolvedValueOnce([{ cnt: '6' }])
      .mockResolvedValueOnce([{ cnt: '4' }])
      .mockResolvedValueOnce([{ id: 1, alert_type: 'WATCHLIST_OH_DEPLETED', part_number: 'PN-1' }])
      .mockResolvedValueOnce([{ id: 1, part_number: 'PN-1', condition_code: 'OH', is_active: 1 }])

    const res = await getAlarmsRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('summary')
    expect(body).toHaveProperty('recentAlarms')
    expect(body).toHaveProperty('watchlist')
    expect(body.summary.watchedParts).toBe(10)
    expect(body.summary.activeAlarms).toBe(3)
    expect(body.summary.ohWatched).toBe(6)
    expect(body.summary.arWatched).toBe(4)
  })

  it('returns zeros when DB queries fail', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockRejectedValue(new Error('DB down'))
    const res = await getAlarmsRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.watchedParts).toBe(0)
    expect(body.summary.activeAlarms).toBe(0)
    expect(body.recentAlarms).toEqual([])
    expect(body.watchlist).toEqual([])
  })

  it('returns 200 for admin role', async () => {
    mockAuth.mockResolvedValue(makeAdminSession())
    mockInventoryQuery.mockResolvedValue([])
    const res = await getAlarmsRoute()
    expect(res.status).toBe(200)
  })
})

// ─── POST /api/internal/inventory-alarms/check ───────────────────────────────
describe('POST /api/internal/inventory-alarms/check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await postCheckRoute()
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client' } })
    const res = await postCheckRoute()
    expect(res.status).toBe(401)
  })

  it('returns 200 with zero checks when watchlist is empty', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockResolvedValue([]) // empty watchlist
    const res = await postCheckRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checked).toBe(0)
    expect(body.alarms_triggered).toBe(0)
    expect(body.alarms).toEqual([])
  })

  it('triggers an alarm when watched part drops to 0 from positive qty', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    // Watchlist has one item with last_known_qty=5
    mockInventoryQuery
      .mockResolvedValueOnce([
        { id: 1, part_number: 'PN-WATCH', condition_code: 'OH', last_known_qty: 5, is_active: 1 },
      ])
      // Batch insert for alert
      .mockResolvedValueOnce({ insertId: 99 })
      // Batch update for watchlist
      .mockResolvedValueOnce({ affectedRows: 1 })

    // ERP returns qty=0 (depleted)
    mockGetPartLiveData.mockResolvedValue([])

    const res = await postCheckRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checked).toBe(1)
    expect(body.alarms_triggered).toBe(1)
    expect(body.alarms[0].part_number).toBe('PN-WATCH')
    expect(body.alarms[0].current_qty).toBe(0)
    expect(body.alarms[0].previous_qty).toBe(5)
  })

  it('does NOT trigger alarm when qty stays positive', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery
      .mockResolvedValueOnce([
        { id: 1, part_number: 'PN-OK', condition_code: 'NE', last_known_qty: 3, is_active: 1 },
      ])
      // watchlist update (no alert insert)
      .mockResolvedValueOnce({ affectedRows: 1 })

    mockGetPartLiveData.mockResolvedValue([{ quantity: 3 }])

    const res = await postCheckRoute()
    const body = await res.json()
    expect(body.alarms_triggered).toBe(0)
  })

  it('does NOT trigger alarm when part was already at 0', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery
      .mockResolvedValueOnce([
        { id: 1, part_number: 'PN-ZERO', condition_code: 'OH', last_known_qty: 0, is_active: 1 },
      ])
      .mockResolvedValueOnce({ affectedRows: 1 })

    mockGetPartLiveData.mockResolvedValue([])

    const res = await postCheckRoute()
    const body = await res.json()
    expect(body.alarms_triggered).toBe(0)
  })

  it('continues processing when one ERP call fails', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery
      .mockResolvedValueOnce([
        { id: 1, part_number: 'PN-ERR', condition_code: 'OH', last_known_qty: 2, is_active: 1 },
        { id: 2, part_number: 'PN-OK', condition_code: 'NE', last_known_qty: 1, is_active: 1 },
      ])
      .mockResolvedValueOnce({ affectedRows: 1 })

    mockGetPartLiveData
      .mockRejectedValueOnce(new Error('ERP timeout'))
      .mockResolvedValueOnce([{ quantity: 1 }])

    const res = await postCheckRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    // Only the successful one is counted
    expect(body.checked).toBe(1)
  })

  it('returns 503 for database connection errors', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockRejectedValue(new Error('ECONNREFUSED'))
    const res = await postCheckRoute()
    expect(res.status).toBe(503)
  })
})

// ─── GET /api/internal/inventory-alarms/search ───────────────────────────────
describe('GET /api/internal/inventory-alarms/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-alarms/search?q=PN')
    const res = await getAlarmsSearchRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns empty result when q is blank', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-alarms/search?q=')
    const res = await getAlarmsSearchRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(0)
    expect(body.parts).toEqual([])
  })

  it('calls ERP search with the query and returns results', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockSearchErpParts.mockResolvedValue({
      query: 'PN-500',
      count: 1,
      parts: [{ part_number: 'PN-500', description: 'Valve' }],
    })
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-alarms/search?q=PN-500')
    const res = await getAlarmsSearchRoute(req)
    expect(res.status).toBe(200)
    expect(mockSearchErpParts).toHaveBeenCalledWith('PN-500', 1)
  })

  it('passes page parameter to ERP search', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockSearchErpParts.mockResolvedValue({ query: 'PN', count: 0, parts: [] })
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-alarms/search?q=PN&page=3')
    await getAlarmsSearchRoute(req)
    expect(mockSearchErpParts).toHaveBeenCalledWith('PN', 3)
  })

  it('returns 503 for ERP connection errors', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockSearchErpParts.mockRejectedValue(new Error('ETIMEDOUT'))
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-alarms/search?q=PN-999')
    const res = await getAlarmsSearchRoute(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('ERP service unavailable')
  })

  it('returns 500 for non-connection errors', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockSearchErpParts.mockRejectedValue(new Error('Unexpected error'))
    const req = makeRequest('GET', 'http://localhost/api/internal/inventory-alarms/search?q=PN-999')
    const res = await getAlarmsSearchRoute(req)
    expect(res.status).toBe(500)
  })
})

// ─── POST /api/internal/inventory-alarms/acknowledge ─────────────────────────
describe('POST /api/internal/inventory-alarms/acknowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/acknowledge', {
      alert_id: 1,
    })
    const res = await postAcknowledgeRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when alert_id is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/acknowledge', {})
    const res = await postAcknowledgeRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/alert_id/i)
  })

  it('returns 400 for alert_id = 0 (treated as missing due to falsy check)', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/acknowledge', {
      alert_id: 0,
    })
    const res = await postAcknowledgeRoute(req)
    expect(res.status).toBe(400)
    // 0 is falsy — route hits the !alert_id guard first ("alert_id is required")
    const body = await res.json()
    expect(body.error).toMatch(/alert_id/i)
  })

  it('returns 400 for negative alert_id', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/acknowledge', {
      alert_id: -5,
    })
    const res = await postAcknowledgeRoute(req)
    expect(res.status).toBe(400)
  })

  it('accepts string alert_id that is a valid positive integer', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockResolvedValue({ affectedRows: 1 })
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/acknowledge', {
      alert_id: '42',
    })
    const res = await postAcknowledgeRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alert_id).toBe(42)
  })

  it('returns 400 for non-numeric string alert_id', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/acknowledge', {
      alert_id: 'abc',
    })
    const res = await postAcknowledgeRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 with success and normalized alert_id on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockResolvedValue({ affectedRows: 1 })
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/acknowledge', {
      alert_id: 7,
    })
    const res = await postAcknowledgeRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.alert_id).toBe(7)
  })

  it('returns 503 for database connection errors', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockRejectedValue(new Error('Connection lost'))
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/acknowledge', {
      alert_id: 1,
    })
    const res = await postAcknowledgeRoute(req)
    expect(res.status).toBe(503)
  })
})

// ─── GET /api/internal/inventory-alarms/watchlist ────────────────────────────
describe('GET /api/internal/inventory-alarms/watchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await getWatchlistRoute()
    expect(res.status).toBe(401)
  })

  it('returns 200 with watchlist array on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockResolvedValue([
      { id: 1, part_number: 'PN-1', condition_code: 'OH', is_active: 1 },
    ])
    const res = await getWatchlistRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.watchlist)).toBe(true)
    expect(body.watchlist[0].part_number).toBe('PN-1')
  })

  it('returns 503 for connection errors', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockRejectedValue(new Error('ECONNREFUSED'))
    const res = await getWatchlistRoute()
    expect(res.status).toBe(503)
  })
})

// ─── POST /api/internal/inventory-alarms/watchlist ───────────────────────────
describe('POST /api/internal/inventory-alarms/watchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPartLiveData.mockResolvedValue([])
    mockInventoryQuery.mockResolvedValue({ insertId: 1 })
  })

  const validBody = {
    part_number: 'PN-WATCH',
    condition_code: 'OH',
    description: 'Critical bearing',
  }

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/watchlist', validBody)
    const res = await postWatchlistRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when part_number is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/watchlist', {
      condition_code: 'OH',
    })
    const res = await postWatchlistRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when condition_code is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/watchlist', {
      part_number: 'PN-1',
    })
    const res = await postWatchlistRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid condition_code', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/watchlist', {
      part_number: 'PN-1',
      condition_code: 'XX',
    })
    const res = await postWatchlistRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid condition_code/i)
  })

  it('returns 400 when part_number exceeds 50 characters', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/watchlist', {
      part_number: 'X'.repeat(51),
      condition_code: 'OH',
    })
    const res = await postWatchlistRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/50 characters/i)
  })

  it('returns 400 when description exceeds 500 characters', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/watchlist', {
      part_number: 'PN-1',
      condition_code: 'OH',
      description: 'a'.repeat(501),
    })
    const res = await postWatchlistRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/500 characters/i)
  })

  it('returns 200 with normalized part_number and condition_code on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/watchlist', {
      part_number: 'pn-lower',
      condition_code: 'oh',
    })
    const res = await postWatchlistRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.part_number).toBe('PN-LOWER')
    expect(body.condition_code).toBe('OH')
  })

  it('includes ERP qty in the response when ERP is available', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockGetPartLiveData.mockResolvedValue([{ quantity: 7 }])
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/watchlist', validBody)
    const res = await postWatchlistRoute(req)
    const body = await res.json()
    expect(body.last_known_qty).toBe(7)
  })

  it('proceeds with qty=0 when ERP is unavailable', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockGetPartLiveData.mockRejectedValue(new Error('ERP down'))
    const req = makeRequest('POST', 'http://localhost/api/internal/inventory-alarms/watchlist', validBody)
    const res = await postWatchlistRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.last_known_qty).toBe(0)
  })
})

// ─── DELETE /api/internal/inventory-alarms/watchlist ─────────────────────────
describe('DELETE /api/internal/inventory-alarms/watchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('DELETE', 'http://localhost/api/internal/inventory-alarms/watchlist', {
      id: 1,
    })
    const res = await deleteWatchlistRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when id is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('DELETE', 'http://localhost/api/internal/inventory-alarms/watchlist', {})
    const res = await deleteWatchlistRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('id is required')
  })

  it('soft-deletes the watchlist entry and returns success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockResolvedValue({ affectedRows: 1 })
    const req = makeRequest('DELETE', 'http://localhost/api/internal/inventory-alarms/watchlist', {
      id: 5,
    })
    const res = await deleteWatchlistRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.id).toBe(5)
    // Verify soft-delete (is_active = 0, not hard delete)
    expect(mockInventoryQuery).toHaveBeenCalledWith(
      expect.stringContaining('is_active = 0'),
      expect.any(Array)
    )
  })

  it('returns 503 for database connection errors', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockInventoryQuery.mockRejectedValue(new Error('ECONNREFUSED'))
    const req = makeRequest('DELETE', 'http://localhost/api/internal/inventory-alarms/watchlist', {
      id: 3,
    })
    const res = await deleteWatchlistRoute(req)
    expect(res.status).toBe(503)
  })
})
