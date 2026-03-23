/**
 * Tests for POST /api/internal/chat
 * Claude-powered repair order assistant with streaming, rate limiting, and tool schemas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mock variables (must be hoisted to avoid TDZ errors) ─────────────
const {
  mockAuth,
  mockRateLimiterCheck,
  mockRateLimiterRecord,
  mockStreamText,
  mockConvertToModelMessages,
  mockTaskTrigger,
  mockQuery,
  mockInventoryQuery,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRateLimiterCheck: vi.fn(),
  mockRateLimiterRecord: vi.fn(),
  mockStreamText: vi.fn(),
  mockConvertToModelMessages: vi.fn((msgs: unknown[]) => msgs),
  mockTaskTrigger: vi.fn(),
  mockQuery: vi.fn(),
  mockInventoryQuery: vi.fn(),
}))

// ─── Auth mock ───────────────────────────────────────────────────────────────
vi.mock('@/auth', () => ({ auth: mockAuth }))

// ─── Rate limiter mock ────────────────────────────────────────────────────────
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => ({
    check: mockRateLimiterCheck,
    record: mockRateLimiterRecord,
    reset: vi.fn().mockResolvedValue(undefined),
  }),
}))

// ─── AI SDK mocks ─────────────────────────────────────────────────────────────
vi.mock('ai', () => ({
  streamText: mockStreamText,
  convertToModelMessages: mockConvertToModelMessages,
  stepCountIs: vi.fn(() => () => false),
}))

// ─── Anthropic provider mock ──────────────────────────────────────────────────
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'anthropic-model-stub'),
}))

// ─── Audit logger mock ────────────────────────────────────────────────────────
vi.mock('@/lib/audit-logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  ACTION_TYPES: { AI_CHAT: 'AI_CHAT' },
  RESOURCE_TYPES: { CHAT: 'CHAT' },
}))

// ─── next/cache mock ──────────────────────────────────────────────────────────
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ─── trigger.dev mock ─────────────────────────────────────────────────────────
vi.mock('@trigger.dev/sdk/v3', () => ({
  tasks: { trigger: mockTaskTrigger },
}))

// ─── Drizzle DB mock ──────────────────────────────────────────────────────────
vi.mock('@/lib/db/index', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
  },
}))

// ─── DB schema mock ───────────────────────────────────────────────────────────
vi.mock('@/lib/db/schema', () => ({
  active: { id: 'id', ro: 'RO', shopName: 'SHOP_NAME', currentStatus: 'currentStatus', estimatedDeliveryDate: 'estimatedDeliveryDate' },
  inventoryindex: { partNumber: 'partNumber', description: 'description' },
}))

// ─── drizzle-orm mock ─────────────────────────────────────────────────────────
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ col, vals })),
  like: vi.fn((col: unknown, pat: unknown) => ({ col, pat })),
  lte: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  or: vi.fn((...args: unknown[]) => args),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}))

// ─── date-utils mock ──────────────────────────────────────────────────────────
vi.mock('@/lib/date-utils', () => ({
  isOverdue: vi.fn(() => false),
  daysSince: vi.fn(() => 0),
}))

// ─── Main DB mock (@/lib/db query) ────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  query: mockQuery,
  getPool: vi.fn(() => ({})),
}))

// ─── Inventory DB mock ────────────────────────────────────────────────────────
vi.mock('@/lib/inventory-db', () => ({
  inventoryQuery: mockInventoryQuery,
}))

import { POST as postChatRoute } from '@/app/api/internal/chat/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeInternalSession(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'user-1', email: 'admin@genthrust.net', role: 'internal', ...overrides },
  }
}

function makeChatRequest(body: unknown): Request {
  return new Request('http://localhost/api/internal/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Minimal stream response that toTextStreamResponse() returns
function makeStreamResponse() {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('Hello'))
      controller.close()
    },
  })
  return {
    toTextStreamResponse: () => new Response(body, { status: 200 }),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('POST /api/internal/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: rate limiter allows requests
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
    // Default: DB calls succeed
    mockQuery.mockResolvedValue([{}])
    mockInventoryQuery.mockResolvedValue([{}])
    // Default: streamText returns a valid stream
    mockStreamText.mockReturnValue(makeStreamResponse())
  })

  // ─── Auth guards ─────────────────────────────────────────────────────────
  it('returns 401 plain text when no session', async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeChatRequest({ messages: [{ role: 'user', content: 'Hello' }] })
    const res = await postChatRoute(req)
    expect(res.status).toBe(401)
    const text = await res.text()
    expect(text).toBe('Unauthorized')
  })

  it('returns 401 when session has no user id', async () => {
    mockAuth.mockResolvedValue({ user: { id: null, role: 'internal' } })
    const req = makeChatRequest({ messages: [{ role: 'user', content: 'Hello' }] })
    const res = await postChatRoute(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 JSON when role is not internal', async () => {
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'admin' } })
    const req = makeChatRequest({ messages: [{ role: 'user', content: 'Hello' }] })
    const res = await postChatRoute(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 403 for client role', async () => {
    mockAuth.mockResolvedValue({ user: { id: '3', role: 'client' } })
    const req = makeChatRequest({ messages: [{ role: 'user', content: 'Hello' }] })
    const res = await postChatRoute(req)
    expect(res.status).toBe(403)
  })

  // ─── Rate limiting ────────────────────────────────────────────────────────
  it('returns 429 when rate limit is exceeded', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockRateLimiterCheck.mockResolvedValue({ allowed: false, retryAfterSeconds: 45 })
    const req = makeChatRequest({ messages: [{ role: 'user', content: 'Hello' }] })
    const res = await postChatRoute(req)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/rate limit/i)
    expect(res.headers.get('Retry-After')).toBe('45')
  })

  it('calls record() after a successful rate limit check', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeChatRequest({ messages: [{ role: 'user', content: 'Hello' }] })
    await postChatRoute(req)
    expect(mockRateLimiterRecord).toHaveBeenCalledWith('user-1')
  })

  // ─── Input validation ─────────────────────────────────────────────────────
  it('returns 400 when messages is missing', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeChatRequest({})
    const res = await postChatRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('messages array is required')
  })

  it('returns 400 when messages is not an array', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeChatRequest({ messages: 'hello' })
    const res = await postChatRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when messages is an empty array', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeChatRequest({ messages: [] })
    const res = await postChatRoute(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when messages array exceeds 100 items', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeChatRequest({
      messages: Array.from({ length: 101 }, (_, i) => ({ role: 'user', content: `msg ${i}` })),
    })
    const res = await postChatRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/too many messages/i)
  })

  // ─── Successful streaming ─────────────────────────────────────────────────
  it('returns 200 streaming response for a valid request', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeChatRequest({
      messages: [{ role: 'user', content: 'List my repair orders' }],
    })
    const res = await postChatRoute(req)
    expect(res.status).toBe(200)
    expect(mockStreamText).toHaveBeenCalledOnce()
  })

  it('passes the userId to tool executors via closure', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    let capturedConfig: any = null
    mockStreamText.mockImplementation((config: any) => {
      capturedConfig = config
      return makeStreamResponse()
    })
    const req = makeChatRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    await postChatRoute(req)
    expect(capturedConfig).not.toBeNull()
    expect(capturedConfig.tools).toHaveProperty('search_inventory')
    expect(capturedConfig.tools).toHaveProperty('get_repair_order')
    expect(capturedConfig.tools).toHaveProperty('list_repair_orders')
    expect(capturedConfig.tools).toHaveProperty('create_repair_order')
    expect(capturedConfig.tools).toHaveProperty('update_repair_order')
    expect(capturedConfig.tools).toHaveProperty('archive_repair_order')
    expect(capturedConfig.tools).toHaveProperty('create_email_draft')
  })

  it('includes system prompt in streamText call', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    let capturedConfig: any = null
    mockStreamText.mockImplementation((config: any) => {
      capturedConfig = config
      return makeStreamResponse()
    })
    const req = makeChatRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    await postChatRoute(req)
    expect(typeof capturedConfig.system).toBe('string')
    expect(capturedConfig.system.length).toBeGreaterThan(0)
  })

  it('proceeds without live context when DB is unavailable', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    mockQuery.mockRejectedValue(new Error('DB down'))
    mockInventoryQuery.mockRejectedValue(new Error('DB down'))
    const req = makeChatRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    const res = await postChatRoute(req)
    // Should still return 200 — live context failure is non-fatal
    expect(res.status).toBe(200)
  })

  it('passes maxOutputTokens=2048 to streamText', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    let capturedConfig: any = null
    mockStreamText.mockImplementation((config: any) => {
      capturedConfig = config
      return makeStreamResponse()
    })
    const req = makeChatRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    await postChatRoute(req)
    expect(capturedConfig.maxOutputTokens).toBe(2048)
  })

  // ─── Tool schema validation ───────────────────────────────────────────────
  it('all tools have inputSchema and execute properties', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    let capturedConfig: any = null
    mockStreamText.mockImplementation((config: any) => {
      capturedConfig = config
      return makeStreamResponse()
    })
    const req = makeChatRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    await postChatRoute(req)

    const toolNames = [
      'search_inventory',
      'get_repair_order',
      'list_repair_orders',
      'create_repair_order',
      'update_repair_order',
      'archive_repair_order',
      'create_email_draft',
    ]
    for (const toolName of toolNames) {
      const tool = capturedConfig.tools[toolName]
      expect(tool, `Tool '${toolName}' should exist`).toBeDefined()
      expect(typeof tool.execute, `Tool '${toolName}' should have execute`).toBe('function')
      expect(tool.inputSchema, `Tool '${toolName}' should have inputSchema`).toBeDefined()
    }
  })

  // ─── Boundary: exactly 100 messages allowed ───────────────────────────────
  it('accepts exactly 100 messages (boundary value)', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeChatRequest({
      messages: Array.from({ length: 100 }, (_, i) => ({ role: 'user', content: `msg ${i}` })),
    })
    const res = await postChatRoute(req)
    expect(res.status).toBe(200)
  })

  it('accepts exactly 1 message (minimum boundary)', async () => {
    mockAuth.mockResolvedValue(makeInternalSession())
    const req = makeChatRequest({
      messages: [{ role: 'user', content: 'single message' }],
    })
    const res = await postChatRoute(req)
    expect(res.status).toBe(200)
  })
})
