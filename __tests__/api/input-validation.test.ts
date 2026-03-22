/**
 * Tests for Zod-based input validation patterns used across API routes.
 * Tests common schemas and validation helpers without requiring a running server.
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Common validation schemas extracted from API route patterns
// These mirror the actual validation logic in the API routes
// ---------------------------------------------------------------------------

// Password validation (used in register and change-password routes)
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')

// Email validation
const emailSchema = z.string().email('Invalid email address')

// User registration schema
const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'Name is required').max(100),
  companyName: z.string().optional(),
})

// Repair order update schema
const updateRoSchema = z.object({
  status: z.string().min(1).optional(),
  notes: z.string().max(5000).optional(),
  shopName: z.string().max(200).optional(),
  nextDateToUpdate: z.string().optional(),
})

// Quote status update schema
const quoteStatusSchema = z.object({
  status: z.enum(['pending', 'processed', 'responded']),
})

// Pagination schema
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// ---------------------------------------------------------------------------
// Password validation
// ---------------------------------------------------------------------------

describe('password schema validation', () => {
  it('accepts a valid password', () => {
    expect(passwordSchema.safeParse('securePass123').success).toBe(true)
  })

  it('rejects password shorter than 8 chars', () => {
    const result = passwordSchema.safeParse('short')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 8')
    }
  })

  it('rejects empty string', () => {
    expect(passwordSchema.safeParse('').success).toBe(false)
  })

  it('accepts exactly 8 characters', () => {
    expect(passwordSchema.safeParse('12345678').success).toBe(true)
  })

  it('rejects password longer than 128 chars', () => {
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false)
  })

  it('accepts password of exactly 128 chars', () => {
    expect(passwordSchema.safeParse('a'.repeat(128)).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Email validation
// ---------------------------------------------------------------------------

describe('email schema validation', () => {
  it('accepts a valid email', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true)
  })

  it('accepts email with subdomain', () => {
    expect(emailSchema.safeParse('user@mail.genthrust.net').success).toBe(true)
  })

  it('rejects email without @', () => {
    expect(emailSchema.safeParse('notanemail').success).toBe(false)
  })

  it('rejects email without domain', () => {
    expect(emailSchema.safeParse('user@').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(emailSchema.safeParse('').success).toBe(false)
  })

  it('rejects email with spaces', () => {
    expect(emailSchema.safeParse('user @example.com').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Registration schema
// ---------------------------------------------------------------------------

describe('register schema validation', () => {
  const validInput = {
    email: 'new@example.com',
    password: 'SecurePass1!',
    name: 'John Doe',
  }

  it('accepts valid registration data', () => {
    expect(registerSchema.safeParse(validInput).success).toBe(true)
  })

  it('accepts optional companyName', () => {
    const result = registerSchema.safeParse({ ...validInput, companyName: 'ACME Corp' })
    expect(result.success).toBe(true)
  })

  it('rejects missing email', () => {
    const { email, ...noEmail } = validInput
    expect(registerSchema.safeParse(noEmail).success).toBe(false)
  })

  it('rejects missing password', () => {
    const { password, ...noPass } = validInput
    expect(registerSchema.safeParse(noPass).success).toBe(false)
  })

  it('rejects missing name', () => {
    const { name, ...noName } = validInput
    expect(registerSchema.safeParse(noName).success).toBe(false)
  })

  it('rejects empty name', () => {
    expect(registerSchema.safeParse({ ...validInput, name: '' }).success).toBe(false)
  })

  it('rejects name longer than 100 chars', () => {
    expect(registerSchema.safeParse({ ...validInput, name: 'a'.repeat(101) }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Repair order update schema
// ---------------------------------------------------------------------------

describe('updateRo schema validation', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(updateRoSchema.safeParse({}).success).toBe(true)
  })

  it('accepts partial update with only status', () => {
    expect(updateRoSchema.safeParse({ status: 'APPROVED' }).success).toBe(true)
  })

  it('accepts partial update with notes', () => {
    expect(updateRoSchema.safeParse({ notes: 'Updated by client' }).success).toBe(true)
  })

  it('rejects notes longer than 5000 chars', () => {
    expect(updateRoSchema.safeParse({ notes: 'a'.repeat(5001) }).success).toBe(false)
  })

  it('rejects shopName longer than 200 chars', () => {
    expect(updateRoSchema.safeParse({ shopName: 'a'.repeat(201) }).success).toBe(false)
  })

  it('accepts notes of exactly 5000 chars', () => {
    expect(updateRoSchema.safeParse({ notes: 'a'.repeat(5000) }).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Quote status schema
// ---------------------------------------------------------------------------

describe('quoteStatus schema validation', () => {
  it('accepts "pending"', () => {
    expect(quoteStatusSchema.safeParse({ status: 'pending' }).success).toBe(true)
  })

  it('accepts "processed"', () => {
    expect(quoteStatusSchema.safeParse({ status: 'processed' }).success).toBe(true)
  })

  it('accepts "responded"', () => {
    expect(quoteStatusSchema.safeParse({ status: 'responded' }).success).toBe(true)
  })

  it('rejects invalid status value', () => {
    expect(quoteStatusSchema.safeParse({ status: 'archived' }).success).toBe(false)
  })

  it('rejects missing status', () => {
    expect(quoteStatusSchema.safeParse({}).success).toBe(false)
  })

  it('rejects uppercase status (case-sensitive)', () => {
    expect(quoteStatusSchema.safeParse({ status: 'PENDING' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Pagination schema
// ---------------------------------------------------------------------------

describe('pagination schema validation', () => {
  it('uses defaults when no params provided', () => {
    const result = paginationSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
      expect(result.data.offset).toBe(0)
    }
  })

  it('coerces string numbers to integers', () => {
    const result = paginationSchema.safeParse({ limit: '25', offset: '100' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(25)
      expect(result.data.offset).toBe(100)
    }
  })

  it('rejects limit greater than 200', () => {
    expect(paginationSchema.safeParse({ limit: 201 }).success).toBe(false)
  })

  it('rejects limit of 0', () => {
    expect(paginationSchema.safeParse({ limit: 0 }).success).toBe(false)
  })

  it('rejects negative offset', () => {
    expect(paginationSchema.safeParse({ offset: -1 }).success).toBe(false)
  })

  it('accepts limit of 1', () => {
    expect(paginationSchema.safeParse({ limit: 1 }).success).toBe(true)
  })

  it('accepts limit of 200 (boundary)', () => {
    expect(paginationSchema.safeParse({ limit: 200 }).success).toBe(true)
  })

  it('rejects non-integer limit', () => {
    expect(paginationSchema.safeParse({ limit: 25.5 }).success).toBe(false)
  })
})
