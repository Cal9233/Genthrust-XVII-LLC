/**
 * Tests for /api/internal/email/* routes
 * Covers: POST /email/send, POST /email/draft, GET /email/monitor, GET /email/thread
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mock variables (must be hoisted to avoid TDZ errors) ─────────────
const { mockAuth, mockTaskTrigger, mockCreateDraftEmail, mockGetConversationMessages, mockQuery } =
  vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockTaskTrigger: vi.fn(),
    mockCreateDraftEmail: vi.fn(),
    mockGetConversationMessages: vi.fn(),
    mockQuery: vi.fn(),
  }))

// ─── Auth mock ───────────────────────────────────────────────────────────────
vi.mock('@/auth', () => ({ auth: mockAuth }))

// ─── audit-logger mock ────────────────────────────────────────────────────────
vi.mock('@/lib/audit-logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  ACTION_TYPES: { SEND_EMAIL: 'SEND_EMAIL' },
  RESOURCE_TYPES: { EMAIL: 'EMAIL' },
}))

// ─── trigger.dev mock ─────────────────────────────────────────────────────────
vi.mock('@trigger.dev/sdk/v3', () => ({
  tasks: { trigger: mockTaskTrigger },
}))

// ─── Graph API mocks ─────────────────────────────────────────────────────────
vi.mock('@/lib/graph/productivity', () => ({
  createDraftEmail: mockCreateDraftEmail,
  getConversationMessages: mockGetConversationMessages,
}))

// ─── sanitize-html-body mock ──────────────────────────────────────────────────
vi.mock('@/lib/sanitize-html-body', () => ({
  sanitizeEmailBody: (body: string) => body, // passthrough for tests
}))

// ─── DB mock (monitor uses @/lib/db query) ────────────────────────────────────
vi.mock('@/lib/db', () => ({
  query: mockQuery,
}))

import { POST as postEmailSendRoute } from '@/app/api/internal/email/send/route'
import { POST as postEmailDraftRoute } from '@/app/api/internal/email/draft/route'
import { GET as getEmailMonitorRoute } from '@/app/api/internal/email/monitor/route'
import { GET as getEmailThreadRoute } from '@/app/api/internal/email/thread/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeInternalSession(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: '1', email: 'admin@genthrust.net', role: 'internal', ...overrides },
  }
}

function makeRequest(method: string, url: string, body?: unknown): Request {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new Request(url, init)
}

// ─── POST /api/internal/email/send ───────────────────────────────────────────
describe('POST /api/internal/email/send', () => {
  beforeEach(() => {
    // clearAllMocks preserves mock implementations (unlike resetAllMocks)
    vi.clearAllMocks()
    mockAuth.mockReset()
    mockTaskTrigger.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('POST', 'http://localhost/api/internal/email/send', {
      notificationId: 1,
    })
    const res = await postEmailSendRoute(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when session has no user id', async () => {
    mockAuth.mockResolvedValue({ user: { id: null, role: 'internal' } })
    const req = makeRequest('POST', 'http://localhost/api/internal/email/send', {
      notificationId: 1,
    })
    const res = await postEmailSendRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 for non-internal role', async () => {
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'admin' } })
    const req = makeRequest('POST', 'http://localhost/api/internal/email/send', {
      notificationId: 1,
    })
    const res = await postEmailSendRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when notificationId is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/email/send', {})
    const res = await postEmailSendRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns 400 when notificationId is not a positive integer', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/email/send', {
      notificationId: -5,
    })
    const res = await postEmailSendRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when notificationId is zero', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/email/send', {
      notificationId: 0,
    })
    const res = await postEmailSendRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 and taskId on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockTaskTrigger.mockResolvedValue({ id: 'task-abc-123' })
    const req = makeRequest('POST', 'http://localhost/api/internal/email/send', {
      notificationId: 42,
    })
    const res = await postEmailSendRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.taskId).toBe('task-abc-123')
    expect(body.message).toBe('Email send task queued')
  })

  it('passes batchedNotificationIds to the task trigger', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockTaskTrigger.mockResolvedValue({ id: 'task-batch-1' })
    const req = makeRequest('POST', 'http://localhost/api/internal/email/send', {
      notificationId: 10,
      batchedNotificationIds: [11, 12, 13],
    })
    await postEmailSendRoute(req)
    expect(mockTaskTrigger).toHaveBeenCalledWith(
      'send-approved-email',
      expect.objectContaining({ batchedNotificationIds: [11, 12, 13] })
    )
  })

  it('defaults batchedNotificationIds to empty array when omitted', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockTaskTrigger.mockResolvedValue({ id: 'task-no-batch' })
    const req = makeRequest('POST', 'http://localhost/api/internal/email/send', {
      notificationId: 7,
    })
    await postEmailSendRoute(req)
    expect(mockTaskTrigger).toHaveBeenCalledWith(
      'send-approved-email',
      expect.objectContaining({ batchedNotificationIds: [] })
    )
  })

  it('returns 500 when task trigger throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockTaskTrigger.mockRejectedValue(new Error('Trigger.dev unavailable'))
    const req = makeRequest('POST', 'http://localhost/api/internal/email/send', {
      notificationId: 1,
    })
    const res = await postEmailSendRoute(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to queue email send')
  })
})

// ─── POST /api/internal/email/draft ──────────────────────────────────────────
describe('POST /api/internal/email/draft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockReset()
    mockCreateDraftEmail.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('POST', 'http://localhost/api/internal/email/draft', {
      to: 'test@example.com',
      subject: 'Subject',
      body: 'Body',
    })
    const res = await postEmailDraftRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 for admin role (only internal allowed)', async () => {
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'admin' } })
    const req = makeRequest('POST', 'http://localhost/api/internal/email/draft', {
      to: 'test@example.com',
      subject: 'Subject',
      body: 'Body',
    })
    const res = await postEmailDraftRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when to is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/email/draft', {
      subject: 'Subject',
      body: 'Body',
    })
    const res = await postEmailDraftRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when subject is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/email/draft', {
      to: 'test@example.com',
      body: 'Body',
    })
    const res = await postEmailDraftRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/email/draft', {
      to: 'not-an-email',
      subject: 'Subject',
      body: 'Body',
    })
    const res = await postEmailDraftRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid email/i)
  })

  it('returns 400 when subject exceeds 500 characters', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/email/draft', {
      to: 'test@example.com',
      subject: 'a'.repeat(501),
      body: 'Body',
    })
    const res = await postEmailDraftRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when body exceeds 50000 characters', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/email/draft', {
      to: 'test@example.com',
      subject: 'Subject',
      body: 'a'.repeat(50001),
    })
    const res = await postEmailDraftRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is empty string', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('POST', 'http://localhost/api/internal/email/draft', {
      to: 'test@example.com',
      subject: 'Subject',
      body: '',
    })
    const res = await postEmailDraftRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 with messageId and webLink on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockCreateDraftEmail.mockResolvedValue({
      messageId: 'msg-111',
      webLink: 'https://outlook.com/msg/111',
    })
    const req = makeRequest('POST', 'http://localhost/api/internal/email/draft', {
      to: 'shop@customer.com',
      subject: 'Repair Order Update',
      body: '<p>Your repair is complete.</p>',
    })
    const res = await postEmailDraftRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.messageId).toBe('msg-111')
    expect(body.webLink).toBe('https://outlook.com/msg/111')
  })

  it('returns 500 when createDraftEmail throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockCreateDraftEmail.mockRejectedValue(new Error('Graph API error'))
    const req = makeRequest('POST', 'http://localhost/api/internal/email/draft', {
      to: 'shop@customer.com',
      subject: 'Subject',
      body: 'Body',
    })
    const res = await postEmailDraftRoute(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to create draft')
  })
})

// ─── GET /api/internal/email/monitor ─────────────────────────────────────────
describe('GET /api/internal/email/monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockReset()
    mockQuery.mockReset()
  })

  const makeMailboxRow = (overrides = {}) => ({
    mailbox_id: 'mb1',
    mailbox_address: 'ops@genthrust.net',
    last_poll_at: '2026-03-22T10:00:00Z',
    last_success_at: '2026-03-22T10:00:00Z',
    emails_processed: 100,
    error_count: 0,
    enabled: 1,
    ...overrides,
  })

  const makeTodayStats = (overrides = {}) => ({
    total: 50,
    avg_score: 6.5,
    extreme_count: 2,
    urgent_count: 8,
    important_count: 15,
    low_count: 25,
    ...overrides,
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await getEmailMonitorRoute()
    expect(res.status).toBe(401)
  })

  it('returns 401 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { role: 'client' } })
    const res = await getEmailMonitorRoute()
    expect(res.status).toBe(401)
  })

  it('returns 200 with monitor data on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery
      .mockResolvedValueOnce([makeMailboxRow()])
      .mockResolvedValueOnce([makeTodayStats()])
      .mockResolvedValueOnce([
        { sender_domain: 'urgent-shop.com', score: 9, ro_match: 'RO-101', processed_at: '2026-03-22T09:00:00Z' },
      ])

    const res = await getEmailMonitorRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('monitorHealth')
    expect(body).toHaveProperty('mailboxes')
    expect(body).toHaveProperty('todayStats')
    expect(body).toHaveProperty('recentUrgent')
    expect(body.monitorHealth.totalMailboxes).toBe(1)
    expect(body.monitorHealth.activeMailboxes).toBe(1)
    expect(body.mailboxes[0].address).toBe('ops@genthrust.net')
    expect(body.todayStats.total).toBe(50)
    expect(body.todayStats.avgScore).toBe(6.5)
    expect(body.recentUrgent[0].senderDomain).toBe('urgent-shop.com')
  })

  it('handles null avg_score gracefully', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeTodayStats({ avg_score: null })])
      .mockResolvedValueOnce([])

    const res = await getEmailMonitorRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.todayStats.avgScore).toBeNull()
  })

  it('returns zeros and empty arrays when DB queries fail', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValue(new Error('DB error'))

    const res = await getEmailMonitorRoute()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.monitorHealth.totalMailboxes).toBe(0)
    expect(body.mailboxes).toEqual([])
    expect(body.recentUrgent).toEqual([])
  })

  it('enabled field is coerced to boolean', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery
      .mockResolvedValueOnce([makeMailboxRow({ enabled: 0 })])
      .mockResolvedValueOnce([makeTodayStats()])
      .mockResolvedValueOnce([])

    const res = await getEmailMonitorRoute()
    const body = await res.json()
    expect(body.mailboxes[0].enabled).toBe(false)
  })

  it('lastPollAt is null when no mailboxes have been polled', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery
      .mockResolvedValueOnce([makeMailboxRow({ last_poll_at: null })])
      .mockResolvedValueOnce([makeTodayStats()])
      .mockResolvedValueOnce([])

    const res = await getEmailMonitorRoute()
    const body = await res.json()
    expect(body.monitorHealth.lastPollAt).toBeNull()
  })
})

// ─── GET /api/internal/email/thread ──────────────────────────────────────────
describe('GET /api/internal/email/thread', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockReset()
    mockGetConversationMessages.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest('GET', 'http://localhost/api/internal/email/thread?conversationId=abc')
    const res = await getEmailThreadRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 for admin role (only internal allowed)', async () => {
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'admin' } })
    const req = makeRequest('GET', 'http://localhost/api/internal/email/thread?conversationId=abc')
    const res = await getEmailThreadRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when conversationId is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeRequest('GET', 'http://localhost/api/internal/email/thread')
    const res = await getEmailThreadRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/conversationId is required/i)
  })

  it('returns 200 with messages on success', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const fakeMessages = [
      { id: 'msg-1', subject: 'RO Update', from: 'shop@example.com' },
    ]
    mockGetConversationMessages.mockResolvedValue(fakeMessages)
    const req = makeRequest('GET', 'http://localhost/api/internal/email/thread?conversationId=conv-xyz')
    const res = await getEmailThreadRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.messages).toEqual(fakeMessages)
  })

  it('returns 200 with graphError flag when getConversationMessages throws', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockGetConversationMessages.mockRejectedValue(new Error('Graph API 403'))
    const req = makeRequest('GET', 'http://localhost/api/internal/email/thread?conversationId=conv-xyz')
    const res = await getEmailThreadRoute(req)
    // Route returns 200 with error flag for graceful degradation
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.graphError).toBe(true)
    expect(body.messages).toEqual([])
    expect(body.error).toBe('Graph API 403')
  })
})
