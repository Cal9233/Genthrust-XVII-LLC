/**
 * Tests for GET/POST /api/mcp
 *
 * The MCP route wraps @vercel/mcp-adapter with a custom auth middleware
 * (checkAuth).  We test the auth layer directly without invoking the MCP
 * handler by mocking the adapter.
 *
 * Key behaviours under test:
 *   - No auth header            → 401
 *   - Wrong token               → 401
 *   - MCP_API_KEY unset         → 401 (fail closed — no partial auth)
 *   - Correct Bearer token      → handler called (200 or any non-401)
 *   - Timing-safe comparison    → no short-circuit on length mismatch (early return)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @vercel/mcp-adapter so it doesn't try to spin up an MCP server
// ---------------------------------------------------------------------------

const mockMcpHandler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
vi.mock('@vercel/mcp-adapter/next', () => ({
  default: () => mockMcpHandler,
}))

// Mock DB so no real DB calls are attempted during handler init
vi.mock('@/lib/db', () => ({
  query: vi.fn().mockResolvedValue([]),
  safeQuery: vi.fn().mockResolvedValue([]),
  safeCount: vi.fn().mockResolvedValue({}),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_KEY = 'super-secret-mcp-key-32chars-long!!'

function makeRequest(method: string, authHeader?: string) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (authHeader !== undefined) {
    headers.set('authorization', authHeader)
  }
  return new Request('http://localhost/api/mcp', { method, headers })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/mcp — authentication', () => {
  beforeEach(() => {
    vi.resetModules()
    mockMcpHandler.mockReset()
    mockMcpHandler.mockResolvedValue(new Response('ok', { status: 200 }))
  })

  it('returns 401 when Authorization header is absent', async () => {
    process.env.MCP_API_KEY = TEST_KEY
    const { GET } = await import('@/app/api/mcp/route')
    const res = await GET(makeRequest('GET') as any)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('Unauthorized')
  })

  it('returns 401 when token does not match MCP_API_KEY', async () => {
    process.env.MCP_API_KEY = TEST_KEY
    const { GET } = await import('@/app/api/mcp/route')
    const res = await GET(makeRequest('GET', 'Bearer wrong-token') as any)
    expect(res.status).toBe(401)
  })

  it('returns 401 when MCP_API_KEY env var is not set (fail closed)', async () => {
    delete process.env.MCP_API_KEY
    const { GET } = await import('@/app/api/mcp/route')
    const res = await GET(makeRequest('GET', `Bearer ${TEST_KEY}`) as any)
    expect(res.status).toBe(401)
  })

  it('passes through to MCP handler with correct Bearer token (GET)', async () => {
    process.env.MCP_API_KEY = TEST_KEY
    const { GET } = await import('@/app/api/mcp/route')
    const res = await GET(makeRequest('GET', `Bearer ${TEST_KEY}`) as any)
    expect(res.status).not.toBe(401)
    expect(mockMcpHandler).toHaveBeenCalled()
  })

  it('returns 401 when Authorization is not "Bearer <token>" (wrong scheme)', async () => {
    process.env.MCP_API_KEY = TEST_KEY
    const { GET } = await import('@/app/api/mcp/route')
    const res = await GET(makeRequest('GET', `Basic ${TEST_KEY}`) as any)
    expect(res.status).toBe(401)
  })

  it('returns 401 when Authorization header has no token after "Bearer "', async () => {
    process.env.MCP_API_KEY = TEST_KEY
    const { GET } = await import('@/app/api/mcp/route')
    // "Bearer " with no token part
    const res = await GET(makeRequest('GET', 'Bearer ') as any)
    expect(res.status).toBe(401)
  })
})

describe('POST /api/mcp — authentication', () => {
  beforeEach(() => {
    vi.resetModules()
    mockMcpHandler.mockReset()
    mockMcpHandler.mockResolvedValue(new Response('ok', { status: 200 }))
  })

  it('returns 401 for POST without Authorization header', async () => {
    process.env.MCP_API_KEY = TEST_KEY
    const { POST } = await import('@/app/api/mcp/route')
    const res = await POST(makeRequest('POST') as any)
    expect(res.status).toBe(401)
  })

  it('passes through POST with correct token', async () => {
    process.env.MCP_API_KEY = TEST_KEY
    const { POST } = await import('@/app/api/mcp/route')
    const res = await POST(makeRequest('POST', `Bearer ${TEST_KEY}`) as any)
    expect(res.status).not.toBe(401)
  })
})

describe('DELETE /api/mcp — authentication', () => {
  beforeEach(() => {
    vi.resetModules()
    mockMcpHandler.mockReset()
    mockMcpHandler.mockResolvedValue(new Response('ok', { status: 200 }))
  })

  it('returns 401 for DELETE without Authorization header', async () => {
    process.env.MCP_API_KEY = TEST_KEY
    const { DELETE } = await import('@/app/api/mcp/route')
    const res = await DELETE(makeRequest('DELETE') as any)
    expect(res.status).toBe(401)
  })
})

describe('/api/mcp — timing-safe comparison', () => {
  beforeEach(() => {
    vi.resetModules()
    mockMcpHandler.mockReset()
    mockMcpHandler.mockResolvedValue(new Response('ok', { status: 200 }))
  })

  it('rejects a token that is correct except for one byte', async () => {
    process.env.MCP_API_KEY = TEST_KEY
    const { GET } = await import('@/app/api/mcp/route')

    // Mutate last character
    const almostRight = TEST_KEY.slice(0, -1) + 'X'
    const res = await GET(makeRequest('GET', `Bearer ${almostRight}`) as any)
    expect(res.status).toBe(401)
  })

  it('rejects a token that is a prefix of the real key (shorter length)', async () => {
    process.env.MCP_API_KEY = TEST_KEY
    const { GET } = await import('@/app/api/mcp/route')
    const shorter = TEST_KEY.slice(0, -3)
    const res = await GET(makeRequest('GET', `Bearer ${shorter}`) as any)
    expect(res.status).toBe(401)
  })

  it('rejects a token that is a superset of the real key (longer length)', async () => {
    process.env.MCP_API_KEY = TEST_KEY
    const { GET } = await import('@/app/api/mcp/route')
    const longer = TEST_KEY + 'extra'
    const res = await GET(makeRequest('GET', `Bearer ${longer}`) as any)
    expect(res.status).toBe(401)
  })

  it('does not pass auth when MCP_API_KEY is empty string (fail closed)', async () => {
    process.env.MCP_API_KEY = ''
    const { GET } = await import('@/app/api/mcp/route')
    // An empty key is falsy — checkAuth must reject
    const res = await GET(makeRequest('GET', 'Bearer ') as any)
    expect(res.status).toBe(401)
  })
})
