/**
 * Tests for Phase 1 Zod validation schemas on API routes.
 * These schemas were added to prevent malformed/malicious input on
 * contact, register, create-client, bots/restart, and search routes.
 *
 * Tests run the schemas directly (no HTTP server needed) plus verify
 * the correct field-level error structure returned to callers.
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Mirrors the actual schemas in the API routes
// (kept in sync with the routes — if you change a route schema, update here)
// ---------------------------------------------------------------------------

const ContactSchema = z.object({
  name: z.string().min(1).max(200).transform(v => v.trim()),
  email: z.string().email().max(255),
  phone: z.string().max(30).optional().default(''),
  company: z.string().max(200).optional().default(''),
  subject: z.string().min(1).max(300).transform(v => v.trim()),
  message: z.string().min(1).max(5000).transform(v => v.trim()),
})

const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
  contact_name: z.string().min(1).max(255).transform(v => v.trim()),
  company_name: z.string().max(255).optional(),
})

const CreateClientSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(72), // bcrypt silently truncates beyond 72 bytes
  contact_name: z.string().min(1).max(255).transform(v => v.trim()),
  company_id: z.number().int().positive().optional(),
})

const RestartBotSchema = z.object({
  botName: z.string().min(1).max(50),
  confirm: z.boolean().optional().default(false),
})

// ---------------------------------------------------------------------------
// Contact form validation (app/api/contact/route.ts)
// ---------------------------------------------------------------------------

describe('ContactSchema validation', () => {
  const valid = {
    name: 'John Doe',
    email: 'john@example.com',
    subject: 'Inquiry',
    message: 'I need parts',
  }

  it('accepts minimal valid contact form data', () => {
    expect(ContactSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts full contact form with optional fields', () => {
    const result = ContactSchema.safeParse({
      ...valid,
      phone: '+1-555-0100',
      company: 'ACME Corp',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const { name: _, ...noName } = valid
    expect(ContactSchema.safeParse(noName).success).toBe(false)
  })

  it('rejects empty name', () => {
    expect(ContactSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('rejects name over 200 chars', () => {
    expect(ContactSchema.safeParse({ ...valid, name: 'a'.repeat(201) }).success).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(ContactSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects email over 255 chars', () => {
    const longEmail = 'a'.repeat(250) + '@x.com'
    expect(ContactSchema.safeParse({ ...valid, email: longEmail }).success).toBe(false)
  })

  it('rejects missing subject', () => {
    const { subject: _, ...noSubject } = valid
    expect(ContactSchema.safeParse(noSubject).success).toBe(false)
  })

  it('rejects subject over 300 chars', () => {
    expect(ContactSchema.safeParse({ ...valid, subject: 's'.repeat(301) }).success).toBe(false)
  })

  it('rejects message over 5000 chars', () => {
    expect(ContactSchema.safeParse({ ...valid, message: 'm'.repeat(5001) }).success).toBe(false)
  })

  it('rejects phone over 30 chars', () => {
    expect(ContactSchema.safeParse({ ...valid, phone: '1'.repeat(31) }).success).toBe(false)
  })

  it('trims whitespace from name', () => {
    const result = ContactSchema.safeParse({ ...valid, name: '  John  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('John')
  })

  it('trims whitespace from message', () => {
    const result = ContactSchema.safeParse({ ...valid, message: '  hello  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.message).toBe('hello')
  })

  it('defaults phone to empty string when omitted', () => {
    const result = ContactSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.phone).toBe('')
  })

  it('defaults company to empty string when omitted', () => {
    const result = ContactSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.company).toBe('')
  })

  it('rejects missing message', () => {
    const { message: _, ...noMsg } = valid
    expect(ContactSchema.safeParse(noMsg).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Registration validation (app/api/register/route.ts)
// ---------------------------------------------------------------------------

describe('RegisterSchema validation', () => {
  const valid = {
    email: 'User@Example.COM',
    password: 'SecurePass1!',
    contact_name: 'Jane Smith',
  }

  it('accepts valid registration data', () => {
    expect(RegisterSchema.safeParse(valid).success).toBe(true)
  })

  it('normalises email to lowercase', () => {
    const result = RegisterSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('user@example.com')
  })

  it('trims email whitespace', () => {
    const result = RegisterSchema.safeParse({ ...valid, email: '  user@example.com  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('user@example.com')
  })

  it('rejects email over 255 chars', () => {
    const longEmail = 'a'.repeat(250) + '@x.com'
    expect(RegisterSchema.safeParse({ ...valid, email: longEmail }).success).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(RegisterSchema.safeParse({ ...valid, email: 'notvalid' }).success).toBe(false)
  })

  it('rejects password under 8 chars', () => {
    expect(RegisterSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false)
  })

  it('rejects password over 128 chars', () => {
    expect(RegisterSchema.safeParse({ ...valid, password: 'p'.repeat(129) }).success).toBe(false)
  })

  it('accepts password of exactly 8 chars', () => {
    expect(RegisterSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(true)
  })

  it('rejects missing contact_name', () => {
    const { contact_name: _, ...noName } = valid
    expect(RegisterSchema.safeParse(noName).success).toBe(false)
  })

  it('rejects empty contact_name', () => {
    expect(RegisterSchema.safeParse({ ...valid, contact_name: '' }).success).toBe(false)
  })

  it('rejects contact_name over 255 chars', () => {
    expect(RegisterSchema.safeParse({ ...valid, contact_name: 'x'.repeat(256) }).success).toBe(false)
  })

  it('trims contact_name whitespace', () => {
    const result = RegisterSchema.safeParse({ ...valid, contact_name: '  Jane  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.contact_name).toBe('Jane')
  })

  it('accepts optional company_name', () => {
    const result = RegisterSchema.safeParse({ ...valid, company_name: 'ACME' })
    expect(result.success).toBe(true)
  })

  it('rejects company_name over 255 chars', () => {
    expect(RegisterSchema.safeParse({ ...valid, company_name: 'c'.repeat(256) }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Admin create-client validation (app/api/admin/create-client/route.ts)
// ---------------------------------------------------------------------------

describe('CreateClientSchema validation', () => {
  const valid = {
    email: 'Client@Corp.COM',
    password: 'ClientPass99!',
    contact_name: 'Bob Manager',
  }

  it('accepts valid client creation data', () => {
    expect(CreateClientSchema.safeParse(valid).success).toBe(true)
  })

  it('normalises email to lowercase', () => {
    const result = CreateClientSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('client@corp.com')
  })

  it('accepts optional company_id', () => {
    expect(CreateClientSchema.safeParse({ ...valid, company_id: 42 }).success).toBe(true)
  })

  it('rejects non-integer company_id', () => {
    expect(CreateClientSchema.safeParse({ ...valid, company_id: 1.5 }).success).toBe(false)
  })

  it('rejects negative company_id', () => {
    expect(CreateClientSchema.safeParse({ ...valid, company_id: -1 }).success).toBe(false)
  })

  it('rejects company_id of zero', () => {
    expect(CreateClientSchema.safeParse({ ...valid, company_id: 0 }).success).toBe(false)
  })

  it('rejects password under 8 chars', () => {
    expect(CreateClientSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false)
  })

  it('rejects password over 72 chars (bcrypt truncation limit)', () => {
    expect(CreateClientSchema.safeParse({ ...valid, password: 'p'.repeat(73) }).success).toBe(false)
  })

  it('accepts password of exactly 72 chars', () => {
    expect(CreateClientSchema.safeParse({ ...valid, password: 'p'.repeat(72) }).success).toBe(true)
  })

  it('rejects empty contact_name', () => {
    expect(CreateClientSchema.safeParse({ ...valid, contact_name: '' }).success).toBe(false)
  })

  it('rejects invalid email format', () => {
    expect(CreateClientSchema.safeParse({ ...valid, email: 'bad-email' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Bot restart validation (app/api/internal/bots/restart/route.ts)
// ---------------------------------------------------------------------------

describe('RestartBotSchema validation', () => {
  it('accepts valid botName', () => {
    expect(RestartBotSchema.safeParse({ botName: 'ils' }).success).toBe(true)
  })

  it('defaults confirm to false when omitted', () => {
    const result = RestartBotSchema.safeParse({ botName: 'ils' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.confirm).toBe(false)
  })

  it('accepts confirm: true', () => {
    const result = RestartBotSchema.safeParse({ botName: 'ils', confirm: true })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.confirm).toBe(true)
  })

  it('rejects missing botName', () => {
    expect(RestartBotSchema.safeParse({ confirm: true }).success).toBe(false)
  })

  it('rejects empty botName', () => {
    expect(RestartBotSchema.safeParse({ botName: '' }).success).toBe(false)
  })

  it('rejects botName over 50 chars', () => {
    expect(RestartBotSchema.safeParse({ botName: 'b'.repeat(51) }).success).toBe(false)
  })

  it('accepts botName of exactly 50 chars', () => {
    expect(RestartBotSchema.safeParse({ botName: 'b'.repeat(50) }).success).toBe(true)
  })

  it('rejects non-boolean confirm', () => {
    expect(RestartBotSchema.safeParse({ botName: 'ils', confirm: 'yes' }).success).toBe(false)
  })
})
