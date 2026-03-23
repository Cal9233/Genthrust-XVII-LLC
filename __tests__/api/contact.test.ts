/**
 * Tests for POST /api/contact
 *
 * The route:
 *   - Rate-limits by IP (max 3 per 10 min)
 *   - Validates body with Zod (name, email, subject, message required)
 *   - Sends email via Resend if RESEND_API_KEY is set; logs warning if not
 *   - Escapes HTML in all user-supplied fields before emitting HTML email
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRateLimiterCheck = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
const mockRateLimiterRecord = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => ({
    check: mockRateLimiterCheck,
    record: mockRateLimiterRecord,
    reset: vi.fn().mockResolvedValue(undefined),
  }),
}))

const mockResendSend = vi.fn().mockResolvedValue({ error: null })
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: mockResendSend } }
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>, ip = '1.2.3.4') {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

const validBody = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'Parts inquiry',
  message: 'I need 5 units of XB-702.',
}

// ---------------------------------------------------------------------------
// Input validation — 400 cases
// ---------------------------------------------------------------------------

describe('POST /api/contact — input validation', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
    mockResendSend.mockResolvedValue({ error: null })
    delete process.env.RESEND_API_KEY
  })

  it('returns 400 when name is missing', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const { name: _, ...noName } = validBody
    const res = await POST(makeRequest(noName) as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('returns 400 when name is empty string', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const res = await POST(makeRequest({ ...validBody, name: '' }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when email is missing', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const { email: _, ...noEmail } = validBody
    const res = await POST(makeRequest(noEmail) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when email is not a valid address', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const res = await POST(makeRequest({ ...validBody, email: 'not-an-email' }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when subject is missing', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const { subject: _, ...noSubject } = validBody
    const res = await POST(makeRequest(noSubject) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when message is missing', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const { message: _, ...noMsg } = validBody
    const res = await POST(makeRequest(noMsg) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when message is empty string', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const res = await POST(makeRequest({ ...validBody, message: '' }) as any)
    expect(res.status).toBe(400)
  })

  it('returns field-level error details in response', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const res = await POST(makeRequest({ ...validBody, email: 'bad' }) as any)
    const body = await res.json()
    expect(body.details).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Rate limiting — 429 cases
// ---------------------------------------------------------------------------

describe('POST /api/contact — rate limiting', () => {
  beforeEach(() => {
    vi.resetModules()
    mockResendSend.mockResolvedValue({ error: null })
    delete process.env.RESEND_API_KEY
  })

  it('returns 429 when IP is rate-limited', async () => {
    mockRateLimiterCheck.mockResolvedValue({ allowed: false, retryAfterSeconds: 300 })
    const { POST } = await import('@/app/api/contact/route')
    const res = await POST(makeRequest(validBody) as any)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('300')
  })

  it('rate-limits using the first IP in x-forwarded-for', async () => {
    mockRateLimiterCheck.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 })
    const { POST } = await import('@/app/api/contact/route')
    // Multiple IPs in header — only the first should be used as the key
    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '10.0.0.1, 192.168.1.1',
      },
      body: JSON.stringify(validBody),
    })
    await POST(req as any)
    expect(mockRateLimiterCheck).toHaveBeenCalledWith('10.0.0.1')
  })
})

// ---------------------------------------------------------------------------
// Success path — 200 (no RESEND_API_KEY configured)
// ---------------------------------------------------------------------------

describe('POST /api/contact — success without RESEND_API_KEY', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
    delete process.env.RESEND_API_KEY
  })

  it('returns 200 for a valid submission when RESEND_API_KEY is not set', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const res = await POST(makeRequest(validBody) as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toContain('successfully')
  })

  it('does not call Resend.send when RESEND_API_KEY is absent', async () => {
    const { POST } = await import('@/app/api/contact/route')
    await POST(makeRequest(validBody) as any)
    expect(mockResendSend).not.toHaveBeenCalled()
  })

  it('records the rate-limit attempt on every valid request', async () => {
    const { POST } = await import('@/app/api/contact/route')
    await POST(makeRequest(validBody) as any)
    expect(mockRateLimiterRecord).toHaveBeenCalled()
  })

  it('accepts optional phone and company fields', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const res = await POST(makeRequest({
      ...validBody,
      phone: '+1-555-0100',
      company: 'AcmeCorp',
    }) as any)
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Success path — email sent via Resend
// ---------------------------------------------------------------------------

describe('POST /api/contact — Resend email sending', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
    process.env.RESEND_API_KEY = 'test-key-abc'
    mockResendSend.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
  })

  it('returns 200 when Resend sends successfully', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const res = await POST(makeRequest(validBody) as any)
    expect(res.status).toBe(200)
  })

  it('calls Resend.send with the correct to/from addresses', async () => {
    const { POST } = await import('@/app/api/contact/route')
    await POST(makeRequest(validBody) as any)
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'contact@genthrust.net',
        to: 'sales@genthrust.net',
        replyTo: validBody.email,
      })
    )
  })

  it('returns 500 when Resend returns an error object', async () => {
    mockResendSend.mockResolvedValueOnce({ error: { message: 'Delivery failed' } })
    const { POST } = await import('@/app/api/contact/route')
    const res = await POST(makeRequest(validBody) as any)
    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

describe('POST /api/contact — HTML escaping', () => {
  // These tests must NOT call vi.resetModules() — the Resend constructor mock
  // uses a closure reference to mockResendSend. After resetModules the route
  // re-imports Resend and a new constructor is bound; the outer mockResendSend
  // variable would point to the stale instance.  We keep a stable module
  // graph across the whole describe block and only reset call history.
  let POST: (req: any) => Promise<Response>

  beforeAll(async () => {
    vi.resetModules()
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockRateLimiterRecord.mockResolvedValue(undefined)
    process.env.RESEND_API_KEY = 'test-key-abc'
    mockResendSend.mockResolvedValue({ error: null })
    const mod = await import('@/app/api/contact/route')
    POST = mod.POST
  })

  afterAll(() => {
    delete process.env.RESEND_API_KEY
  })

  beforeEach(() => {
    mockResendSend.mockClear()
    mockResendSend.mockResolvedValue({ error: null })
  })

  it('escapes HTML special characters in name and message before sending email', async () => {
    // The HTML email template renders: name, email, phone, company, message.
    // Subject is used only as the email subject line, not rendered in the HTML body.
    const xssBody = {
      name: '<script>alert("xss")</script>',
      email: 'attacker@example.com',
      subject: 'XSS test',
      message: '<img src=x onerror=alert(1)>',
    }

    await POST(makeRequest(xssBody) as any)

    expect(mockResendSend).toHaveBeenCalled()
    const callArgs = mockResendSend.mock.calls[0][0]
    const html: string = callArgs.html

    // Raw script/img tags must not appear in the HTML email body
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    // Escaped entities must appear instead
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img')
  })

  it('escapes ampersands in user input', async () => {
    await POST(makeRequest({ ...validBody, name: 'R&D Department' }) as any)
    const html: string = mockResendSend.mock.calls[0][0].html
    expect(html).toContain('R&amp;D')
    expect(html).not.toMatch(/R&D(?!amp;)/)
  })

  it('escapes double-quotes in user input', async () => {
    await POST(makeRequest({ ...validBody, company: '"ACME"' }) as any)
    const html: string = mockResendSend.mock.calls[0][0].html
    expect(html).toContain('&quot;ACME&quot;')
  })
})
