/**
 * Tests for lib/audit-logger.ts
 * Pure functions and fire-and-forget behavior — no live DB required.
 * The `query` dependency from @/lib/db is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @/lib/db before importing the module under test
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

import { query } from '@/lib/db'
import {
  ACTION_TYPES,
  RESOURCE_TYPES,
  createAuditContext,
  diffObjects,
  logAuditEvent,
} from '@/lib/audit-logger'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(headers: Record<string, string> = {}, url = 'http://localhost/api/test'): NextRequest {
  return new NextRequest(url, { headers })
}

// ---------------------------------------------------------------------------
// ACTION_TYPES
// ---------------------------------------------------------------------------

describe('ACTION_TYPES', () => {
  it('contains LOGIN action', () => {
    expect(ACTION_TYPES.LOGIN).toBe('LOGIN')
  })

  it('contains CRUD actions', () => {
    expect(ACTION_TYPES.CREATE).toBe('CREATE')
    expect(ACTION_TYPES.UPDATE).toBe('UPDATE')
    expect(ACTION_TYPES.DELETE).toBe('DELETE')
    expect(ACTION_TYPES.READ).toBe('READ')
  })

  it('contains AI_CHAT action', () => {
    expect(ACTION_TYPES.AI_CHAT).toBe('AI_CHAT')
  })

  it('contains MFA actions', () => {
    expect(ACTION_TYPES.MFA_VERIFY).toBe('MFA_VERIFY')
    expect(ACTION_TYPES.MFA_DISABLE).toBe('MFA_DISABLE')
    expect(ACTION_TYPES.MFA_ENROLL).toBe('MFA_ENROLL')
  })
})

// ---------------------------------------------------------------------------
// RESOURCE_TYPES
// ---------------------------------------------------------------------------

describe('RESOURCE_TYPES', () => {
  it('contains core resource types', () => {
    expect(RESOURCE_TYPES.REPAIR_ORDER).toBe('repair_order')
    expect(RESOURCE_TYPES.SALES_ORDER).toBe('sales_order')
    expect(RESOURCE_TYPES.INVOICE).toBe('invoice')
    expect(RESOURCE_TYPES.QUOTE).toBe('quote')
    expect(RESOURCE_TYPES.CLIENT).toBe('client')
  })

  it('contains auxiliary resource types', () => {
    expect(RESOURCE_TYPES.EMAIL).toBe('email')
    expect(RESOURCE_TYPES.CHAT).toBe('chat')
    expect(RESOURCE_TYPES.BOT).toBe('bot')
    expect(RESOURCE_TYPES.MFA).toBe('mfa')
  })
})

// ---------------------------------------------------------------------------
// createAuditContext — IP extraction
// ---------------------------------------------------------------------------

describe('createAuditContext — IP extraction', () => {
  it('extracts the first IP from a multi-value x-forwarded-for header', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' })
    const ctx = createAuditContext(req, null)
    expect(ctx.ip_address).toBe('1.2.3.4')
  })

  it('extracts IP from a single-value x-forwarded-for header', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.1' })
    const ctx = createAuditContext(req, null)
    expect(ctx.ip_address).toBe('203.0.113.1')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '10.0.0.5' })
    const ctx = createAuditContext(req, null)
    expect(ctx.ip_address).toBe('10.0.0.5')
  })

  it('returns null for ip_address when neither header is present', () => {
    const req = makeRequest({})
    const ctx = createAuditContext(req, null)
    expect(ctx.ip_address).toBeNull()
  })

  it('trims whitespace from x-forwarded-for IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' })
    const ctx = createAuditContext(req, null)
    expect(ctx.ip_address).toBe('192.168.1.1')
  })
})

// ---------------------------------------------------------------------------
// createAuditContext — session / user info extraction
// ---------------------------------------------------------------------------

describe('createAuditContext — session extraction', () => {
  it('extracts user_id from session.user.id', () => {
    const req = makeRequest({})
    const session = { user: { id: 'user-abc', email: 'a@b.com', role: 'internal' } }
    const ctx = createAuditContext(req, session)
    expect(ctx.user_id).toBe('user-abc')
  })

  it('falls back to email as user_id when id is absent', () => {
    const req = makeRequest({})
    const session = { user: { email: 'fallback@test.com' } }
    const ctx = createAuditContext(req, session)
    expect(ctx.user_id).toBe('fallback@test.com')
  })

  it('extracts user_email from session', () => {
    const req = makeRequest({})
    const session = { user: { id: '42', email: 'test@genthrust.com', role: 'client' } }
    const ctx = createAuditContext(req, session)
    expect(ctx.user_email).toBe('test@genthrust.com')
  })

  it('extracts user_role from session', () => {
    const req = makeRequest({})
    const session = { user: { id: '1', email: 'x@y.com', role: 'client' } }
    const ctx = createAuditContext(req, session)
    expect(ctx.user_role).toBe('client')
  })

  it('returns null user fields when session is null', () => {
    const req = makeRequest({})
    const ctx = createAuditContext(req, null)
    expect(ctx.user_id).toBeNull()
    expect(ctx.user_email).toBeNull()
    expect(ctx.user_role).toBeNull()
  })

  it('captures method and path from request', () => {
    const req = makeRequest({}, 'http://localhost/api/internal/quotes')
    const ctx = createAuditContext(req, null)
    expect(ctx.method).toBe('GET')
    expect(ctx.path).toBe('/api/internal/quotes')
  })

  it('captures user-agent from request headers', () => {
    const req = makeRequest({ 'user-agent': 'TestAgent/1.0' })
    const ctx = createAuditContext(req, null)
    expect(ctx.user_agent).toBe('TestAgent/1.0')
  })
})

// ---------------------------------------------------------------------------
// diffObjects
// ---------------------------------------------------------------------------

describe('diffObjects', () => {
  it('returns empty object when before and after are identical', () => {
    const result = diffObjects({ a: 1, b: 'x' }, { a: 1, b: 'x' })
    expect(result).toEqual({})
  })

  it('detects a changed scalar field', () => {
    const result = diffObjects({ status: 'open' }, { status: 'closed' })
    expect(result).toEqual({ status: { old: 'open', new: 'closed' } })
  })

  it('detects multiple changed fields', () => {
    const result = diffObjects(
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 99, c: 42 }
    )
    expect(result).toEqual({
      b: { old: 2, new: 99 },
      c: { old: 3, new: 42 },
    })
  })

  it('detects a newly added field (undefined → value)', () => {
    const result = diffObjects({ a: 1 }, { a: 1, b: 'new' })
    expect(result).toEqual({ b: { old: null, new: 'new' } })
  })

  it('detects a removed field (value → undefined)', () => {
    const result = diffObjects({ a: 1, b: 'gone' }, { a: 1 })
    expect(result).toEqual({ b: { old: 'gone', new: null } })
  })

  it('performs deep comparison on nested objects', () => {
    const before = { meta: { count: 1 } }
    const after  = { meta: { count: 2 } }
    const result = diffObjects(before, after)
    expect(result.meta.old).toEqual({ count: 1 })
    expect(result.meta.new).toEqual({ count: 2 })
  })

  it('treats arrays with same content in same order as equal', () => {
    const result = diffObjects({ tags: ['a', 'b'] }, { tags: ['a', 'b'] })
    expect(result).toEqual({})
  })

  it('detects changed array content', () => {
    const result = diffObjects({ tags: ['a', 'b'] }, { tags: ['a', 'c'] })
    expect(result).toHaveProperty('tags')
  })

  it('handles empty before and after objects', () => {
    const result = diffObjects({}, {})
    expect(result).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// logAuditEvent — fire-and-forget (never throws)
// ---------------------------------------------------------------------------

describe('logAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves without throwing when query succeeds', async () => {
    vi.mocked(query).mockResolvedValue([])
    await expect(logAuditEvent({ action: 'LOGIN', user_email: 'u@test.com' })).resolves.toBeUndefined()
  })

  it('resolves without throwing when query rejects (fire-and-forget)', async () => {
    vi.mocked(query).mockRejectedValue(new Error('DB connection lost'))
    await expect(logAuditEvent({ action: 'CREATE' })).resolves.toBeUndefined()
  })

  it('resolves without throwing when query throws synchronously', async () => {
    vi.mocked(query).mockImplementation(() => { throw new Error('sync error') })
    await expect(logAuditEvent({ action: 'DELETE' })).resolves.toBeUndefined()
  })

  it('calls query with the correct number of parameters (15)', async () => {
    vi.mocked(query).mockResolvedValue([])
    await logAuditEvent({ action: 'UPDATE', user_id: '1', user_email: 'a@b.com' })
    expect(vi.mocked(query)).toHaveBeenCalledOnce()
    const callArgs = vi.mocked(query).mock.calls[0]
    // Second argument is the values array — should have 15 entries
    expect(callArgs[1]).toHaveLength(15)
  })

  it('uses UNKNOWN as action when action field is omitted', async () => {
    vi.mocked(query).mockResolvedValue([])
    await logAuditEvent({})
    const values = vi.mocked(query).mock.calls[0][1] as any[]
    // action is the 4th positional parameter (index 3)
    expect(values[3]).toBe('UNKNOWN')
  })

  it('JSON-serializes metadata before inserting', async () => {
    vi.mocked(query).mockResolvedValue([])
    await logAuditEvent({ action: 'READ', metadata: { key: 'val', count: 3 } })
    const values = vi.mocked(query).mock.calls[0][1] as any[]
    // metadata is the 14th positional parameter (index 13)
    expect(values[13]).toBe(JSON.stringify({ key: 'val', count: 3 }))
  })

  it('stores null for metadata when not provided', async () => {
    vi.mocked(query).mockResolvedValue([])
    await logAuditEvent({ action: 'READ' })
    const values = vi.mocked(query).mock.calls[0][1] as any[]
    expect(values[13]).toBeNull()
  })
})
