/**
 * Tests for /api/internal/bots/* routes
 * Covers: GET /bots, GET /bots/inventory, GET /bots/logs, POST /bots/restart
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks (factories must not reference outer variables — hoisting) ───────────
vi.mock('@/auth', () => ({ auth: vi.fn() }))

vi.mock('@/lib/bot-helpers', () => ({
  getAllBotStatusesAsync: vi.fn(),
  getBotMetrics: vi.fn(),
  getNotificationFeed: vi.fn(),
  getLogTail: vi.fn(),
  BOT_REGISTRY: {
    ils: {
      serviceName: 'GT-ILS-Bot',
      logFile: 'ils_debug.log',
      displayName: 'ILS Sniper',
      description: 'Monitors ILS marketplaces',
    },
    sync: {
      serviceName: 'GT-Sync-Bot',
      logFile: 'sync_bot.log',
      displayName: 'OneDrive Sync',
      description: 'Syncs inventory data',
    },
  },
}))

vi.mock('@/lib/inventory-db', () => ({
  inventoryQuery: vi.fn(),
}))

vi.mock('@/lib/audit-logger', () => ({
  logAuditEvent: vi.fn(),
  ACTION_TYPES: { BOT_RESTART: 'BOT_RESTART' },
  RESOURCE_TYPES: { BOT: 'BOT' },
}))

vi.mock('child_process', () => ({ execFile: vi.fn() }))
vi.mock('util', () => ({ promisify: (fn: unknown) => fn }))

// ─── Imports after mocks ──────────────────────────────────────────────────────
import { auth } from '@/auth'
import {
  getAllBotStatusesAsync,
  getBotMetrics,
  getNotificationFeed,
  getLogTail,
} from '@/lib/bot-helpers'
import { inventoryQuery } from '@/lib/inventory-db'
import { logAuditEvent } from '@/lib/audit-logger'
import { execFile } from 'child_process'

import { GET as getBotsRoute } from '@/app/api/internal/bots/route'
import { GET as getBotsInventoryRoute } from '@/app/api/internal/bots/inventory/route'
import { GET as getBotsLogsRoute } from '@/app/api/internal/bots/logs/route'
import { POST as postBotsRestartRoute } from '@/app/api/internal/bots/restart/route'
import { NextRequest } from 'next/server'

// ─── Typed mocks ──────────────────────────────────────────────────────────────
const mockAuth = vi.mocked(auth)
const mockGetAllBotStatusesAsync = vi.mocked(getAllBotStatusesAsync)
const mockGetBotMetrics = vi.mocked(getBotMetrics)
const mockGetNotificationFeed = vi.mocked(getNotificationFeed)
const mockGetLogTail = vi.mocked(getLogTail)
const mockInventoryQuery = vi.mocked(inventoryQuery)
const mockLogAuditEvent = vi.mocked(logAuditEvent)
// The route does: const execFileAsync = promisify(execFile)
// Our util mock returns the fn unchanged, so execFile IS execFileAsync.
const mockExecFile = vi.mocked(execFile as unknown as (...args: unknown[]) => Promise<unknown>)

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

// ─── GET /api/internal/bots ───────────────────────────────────────────────────
describe('GET /api/internal/bots', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockGetAllBotStatusesAsync.mockReset()
    mockGetBotMetrics.mockReset()
    mockGetNotificationFeed.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await getBotsRoute()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when session has no user', async () => {
    mockAuth.mockResolvedValue({ user: null } as any)
    const res = await getBotsRoute()
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client' } } as any)
    const res = await getBotsRoute()
    expect(res.status).toBe(401)
  })

  it('returns 200 with statuses, metrics, and notifications for internal role', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    const fakeStatuses = [{ key: 'ils', status: 'RUNNING', displayName: 'ILS Sniper' }]
    mockGetAllBotStatusesAsync.mockResolvedValue(fakeStatuses as any)
    mockGetBotMetrics.mockReturnValue({ eventsProcessed: 42 } as any)
    mockGetNotificationFeed.mockReturnValue([{ id: 1, message: 'Bot started' }] as any)

    const res = await getBotsRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('statuses')
    expect(body).toHaveProperty('metrics')
    expect(body).toHaveProperty('notifications')
    expect(body.statuses).toEqual(fakeStatuses)
    expect(body.metrics.ils).toEqual({ eventsProcessed: 42 })
  })

  it('returns 200 for admin role', async () => {
    mockAuth.mockResolvedValue(makeAdminSession() as any)
    mockGetAllBotStatusesAsync.mockResolvedValue([])
    mockGetNotificationFeed.mockReturnValue([])
    const res = await getBotsRoute()
    expect(res.status).toBe(200)
  })

  it('returns empty metrics object when getBotMetrics throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    const fakeStatuses = [{ key: 'ils', status: 'UNKNOWN' }]
    mockGetAllBotStatusesAsync.mockResolvedValue(fakeStatuses as any)
    mockGetBotMetrics.mockImplementation(() => { throw new Error('unavailable') })
    mockGetNotificationFeed.mockReturnValue([])

    const res = await getBotsRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.metrics.ils).toEqual({})
  })

  it('returns 500 when getAllBotStatusesAsync rejects', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    mockGetAllBotStatusesAsync.mockRejectedValue(new Error('Service down'))
    const res = await getBotsRoute()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to load bot data')
  })
})

// ─── GET /api/internal/bots/inventory ────────────────────────────────────────
describe('GET /api/internal/bots/inventory', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockInventoryQuery.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await getBotsInventoryRoute()
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client' } } as any)
    const res = await getBotsInventoryRoute()
    expect(res.status).toBe(401)
  })

  it('returns 200 with inventory summary on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    mockInventoryQuery
      .mockResolvedValueOnce([{ pendingDrafts: 5 }] as any)
      .mockResolvedValueOnce([{ committedStock: '120' }] as any)
      .mockResolvedValueOnce([{ totalSkus: 300 }] as any)
      .mockResolvedValueOnce([
        { condition: 'NE', count: 10, qty: 50 },
        { condition: 'OH', count: 5, qty: 20 },
      ] as any)

    const res = await getBotsInventoryRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pendingDrafts).toBe(5)
    expect(body.committedStock).toBe(120)
    expect(body.totalSkus).toBe(300)
    expect(Array.isArray(body.conditionBreakdown)).toBe(true)
  })

  it('returns zeros when inventory queries fail', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    mockInventoryQuery.mockRejectedValue(new Error('DB down'))

    const res = await getBotsInventoryRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pendingDrafts).toBe(0)
    expect(body.committedStock).toBe(0)
    expect(body.totalSkus).toBe(0)
    expect(body.conditionBreakdown).toEqual([])
  })
})

// ─── GET /api/internal/bots/logs ─────────────────────────────────────────────
describe('GET /api/internal/bots/logs', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockGetLogTail.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('GET', 'http://localhost/api/internal/bots/logs?bot=ils')
    const res = await getBotsLogsRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for unknown bot name', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    const req = makeRequest('GET', 'http://localhost/api/internal/bots/logs?bot=nonexistent')
    const res = await getBotsLogsRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid bot/i)
  })

  it('returns log content for valid bot', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    mockGetLogTail.mockReturnValue({ content: 'log line 1\nlog line 2', sizeBytes: 1024 } as any)
    const req = makeRequest('GET', 'http://localhost/api/internal/bots/logs?bot=ils')
    const res = await getBotsLogsRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.bot).toBe('ils')
    expect(body.displayName).toBe('ILS Sniper')
    expect(body.content).toContain('log line 1')
    expect(body.logSizeBytes).toBe(1024)
  })

  it('defaults to bot=ils when no query param provided', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    mockGetLogTail.mockReturnValue({ content: '', sizeBytes: 0 } as any)
    const req = makeRequest('GET', 'http://localhost/api/internal/bots/logs')
    const res = await getBotsLogsRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.bot).toBe('ils')
  })

  it('caps lines at 500 even when larger value passed', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    mockGetLogTail.mockReturnValue({ content: '', sizeBytes: 0 } as any)
    const req = makeRequest('GET', 'http://localhost/api/internal/bots/logs?bot=ils&lines=9999')
    await getBotsLogsRoute(req)
    expect(mockGetLogTail).toHaveBeenCalledWith('ils', 500)
  })

  it('returns 200 for admin role', async () => {
    mockAuth.mockResolvedValue(makeAdminSession() as any)
    mockGetLogTail.mockReturnValue({ content: '', sizeBytes: 0 } as any)
    const req = makeRequest('GET', 'http://localhost/api/internal/bots/logs?bot=ils')
    const res = await getBotsLogsRoute(req)
    expect(res.status).toBe(200)
  })
})

// ─── POST /api/internal/bots/restart ─────────────────────────────────────────
describe('POST /api/internal/bots/restart', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockExecFile.mockReset()
    // logAuditEvent must return a Promise (route calls .catch() on the result)
    mockLogAuditEvent.mockResolvedValue(undefined as any)
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('POST', 'http://localhost/api/internal/bots/restart', {
      botName: 'ils',
    })
    const res = await postBotsRestartRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { id: '3', role: 'client' } } as any)
    const req = makeRequest('POST', 'http://localhost/api/internal/bots/restart', {
      botName: 'ils',
    })
    const res = await postBotsRestartRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing botName', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    const req = makeRequest('POST', 'http://localhost/api/internal/bots/restart', {})
    const res = await postBotsRestartRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid request body')
  })

  it('returns 400 for botName exceeding 50 characters', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    const req = makeRequest('POST', 'http://localhost/api/internal/bots/restart', {
      botName: 'a'.repeat(51),
    })
    const res = await postBotsRestartRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for unknown bot', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    const req = makeRequest('POST', 'http://localhost/api/internal/bots/restart', {
      botName: 'ghost_bot',
    })
    const res = await postBotsRestartRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid bot/i)
  })

  it('returns preview when confirm is false', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    const req = makeRequest('POST', 'http://localhost/api/internal/bots/restart', {
      botName: 'ils',
      confirm: false,
    })
    const res = await postBotsRestartRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('restart_preview')
    expect(body.bot).toBe('ils')
    expect(body.message).toMatch(/confirm: true/i)
  })

  it('returns preview when confirm is omitted (defaults to false)', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    const req = makeRequest('POST', 'http://localhost/api/internal/bots/restart', {
      botName: 'ils',
    })
    const res = await postBotsRestartRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('restart_preview')
  })

  it('executes restart and returns success when confirm is true', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    mockExecFile.mockResolvedValue({ stdout: '', stderr: '' } as any)
    const req = makeRequest('POST', 'http://localhost/api/internal/bots/restart', {
      botName: 'ils',
      confirm: true,
    })
    const res = await postBotsRestartRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('restart_executed')
    expect(body.success).toBe(true)
  })

  it('returns 403 when execFile fails with Access denied message', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    const accessError = new Error('Access denied: requires Administrator')
    mockExecFile.mockRejectedValue(accessError)
    const req = makeRequest('POST', 'http://localhost/api/internal/bots/restart', {
      botName: 'ils',
      confirm: true,
    })
    const res = await postBotsRestartRoute(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.action).toBe('restart_failed')
  })

  it('returns 500 when execFile fails with generic error', async () => {
    mockAuth.mockResolvedValue(makeInternalSession() as any)
    mockExecFile.mockRejectedValue(new Error('Unexpected failure'))
    const req = makeRequest('POST', 'http://localhost/api/internal/bots/restart', {
      botName: 'ils',
      confirm: true,
    })
    const res = await postBotsRestartRoute(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.action).toBe('restart_failed')
  })
})
