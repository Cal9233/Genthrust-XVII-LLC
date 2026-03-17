/**
 * Tests for lib/services/quote-email-composer.ts
 * Covers HTML escaping (XSS prevention) and email template generation.
 *
 * Phase 1 change: escapeHtml added to prevent XSS in email templates.
 */
import { describe, it, expect } from 'vitest'
import { generateEmailHtml, EMAIL_TEMPLATES } from '@/lib/services/quote-email-composer'

// ---------------------------------------------------------------------------
// HTML escaping — tested via template output (escapeHtml is not exported)
// ---------------------------------------------------------------------------

describe('generateEmailHtml — HTML escaping (XSS prevention)', () => {
  it('escapes < and > in sender name for partFound template', () => {
    const { body } = generateEmailHtml('partFound', {
      parts: [],
      senderName: '<script>alert(1)</script>',
      partNumbers: [],
    })
    expect(body).not.toContain('<script>')
    expect(body).toContain('&lt;script&gt;')
  })

  it('escapes ampersand in sender name', () => {
    const { body } = generateEmailHtml('partFound', {
      parts: [],
      senderName: 'Johnson & Sons',
      partNumbers: [],
    })
    expect(body).toContain('Johnson &amp; Sons')
    expect(body).not.toContain('Johnson & Sons')
  })

  it('escapes double quotes in sender name', () => {
    const { body } = generateEmailHtml('partFound', {
      parts: [],
      senderName: 'Bob "The Builder"',
      partNumbers: [],
    })
    expect(body).toContain('&quot;')
    expect(body).not.toContain('"The Builder"')
  })

  it('escapes single quotes in sender name', () => {
    const { body } = generateEmailHtml('partFound', {
      parts: [],
      senderName: "O'Brien",
      partNumbers: [],
    })
    expect(body).toContain('&#39;')
  })

  it('escapes malicious part_number in partFound rows', () => {
    const { body } = generateEmailHtml('partFound', {
      parts: [{ part_number: '<img onerror=alert(1)>', description: 'test', location: 'BIN-A', quantity: 1 }],
      senderName: 'Customer',
      partNumbers: [],
    })
    expect(body).not.toContain('<img')
    expect(body).toContain('&lt;img')
  })

  it('escapes malicious description in partFound rows', () => {
    const { body } = generateEmailHtml('partFound', {
      parts: [{ part_number: 'P-123', description: '<b>bold</b>', location: 'A', quantity: 1 }],
      senderName: 'Customer',
      partNumbers: [],
    })
    expect(body).not.toContain('<b>')
    expect(body).toContain('&lt;b&gt;')
  })

  it('escapes malicious part number in partNotFound template', () => {
    const { body } = generateEmailHtml('partNotFound', {
      notFoundParts: ['<script>xss()</script>'],
      senderName: 'Customer',
      partNumbers: [],
    })
    expect(body).not.toContain('<script>')
    expect(body).toContain('&lt;script&gt;')
  })

  it('escapes sender name in partNotFound template', () => {
    const { body } = generateEmailHtml('partNotFound', {
      notFoundParts: ['P-100'],
      senderName: '<Customer>',
      partNumbers: [],
    })
    expect(body).toContain('&lt;Customer&gt;')
  })

  it('escapes sender name in mixedResults template', () => {
    const { body } = generateEmailHtml('mixedResults', {
      foundParts: [{ part_number: 'P-1', description: 'Part', location: 'A', quantity: 1 }],
      notFoundParts: ['P-2'],
      senderName: '<evil>',
      partNumbers: [],
    })
    expect(body).not.toContain('<evil>')
    expect(body).toContain('&lt;evil&gt;')
  })

  it('escapes sender name in custom template', () => {
    const { body } = generateEmailHtml('custom', {
      content: '<p>Hello</p>',
      senderName: '<attacker>',
    })
    expect(body).toContain('&lt;attacker&gt;')
  })

  it('does NOT escape content field in custom template (admin-provided HTML)', () => {
    const { body } = generateEmailHtml('custom', {
      content: '<p>Intentional HTML</p>',
      senderName: 'Admin',
    })
    // content is trusted HTML from internal users — should not be escaped
    expect(body).toContain('<p>Intentional HTML</p>')
  })
})

// ---------------------------------------------------------------------------
// Template generation — correct output structure
// ---------------------------------------------------------------------------

describe('generateEmailHtml — template output structure', () => {
  it('partFound returns correct subject with part numbers', () => {
    const { subject } = generateEmailHtml('partFound', {
      parts: [],
      senderName: 'Customer',
      partNumbers: ['P-100', 'P-200'],
    })
    expect(subject).toContain('P-100')
    expect(subject).toContain('P-200')
  })

  it('partFound body contains part table headings', () => {
    const { body } = generateEmailHtml('partFound', {
      parts: [{ part_number: 'ABC-1', description: 'Test', location: 'WH', quantity: 5 }],
      senderName: 'ACME',
      partNumbers: ['ABC-1'],
    })
    expect(body).toContain('Part Number')
    expect(body).toContain('Quantity')
    expect(body).toContain('ABC-1')
    expect(body).toContain('5')
  })

  it('partFound body shows N/A for null quantity', () => {
    const { body } = generateEmailHtml('partFound', {
      parts: [{ part_number: 'X-1', quantity: undefined }],
      senderName: 'Customer',
      partNumbers: [],
    })
    expect(body).toContain('N/A')
  })

  it('partNotFound returns inquiry subject', () => {
    const { subject } = generateEmailHtml('partNotFound', {
      notFoundParts: ['BOLT-99'],
      senderName: 'Customer',
      partNumbers: ['BOLT-99'],
    })
    expect(subject).toContain('Inquiry')
  })

  it('mixedResults returns mixed results subject', () => {
    const { subject } = generateEmailHtml('mixedResults', {
      foundParts: [],
      notFoundParts: [],
      senderName: 'Customer',
    })
    expect(subject).toContain('Mixed Results')
  })

  it('custom returns provided subject', () => {
    const { subject } = generateEmailHtml('custom', {
      content: '',
      senderName: 'Admin',
      subject: 'My Custom Subject',
    })
    expect(subject).toBe('My Custom Subject')
  })

  it('custom falls back to default subject when none provided', () => {
    const { subject } = generateEmailHtml('custom', {
      content: '',
      senderName: 'Admin',
    })
    expect(subject).toBe('Quote Response')
  })
})

// ---------------------------------------------------------------------------
// EMAIL_TEMPLATES constant
// ---------------------------------------------------------------------------

describe('EMAIL_TEMPLATES constant', () => {
  it('has 4 templates', () => {
    expect(EMAIL_TEMPLATES).toHaveLength(4)
  })

  it('includes partFound, partNotFound, mixedResults, custom', () => {
    const ids = EMAIL_TEMPLATES.map(t => t.id)
    expect(ids).toContain('partFound')
    expect(ids).toContain('partNotFound')
    expect(ids).toContain('mixedResults')
    expect(ids).toContain('custom')
  })

  it('each template has name and description', () => {
    for (const template of EMAIL_TEMPLATES) {
      expect(template.name).toBeTruthy()
      expect(template.description).toBeTruthy()
    }
  })
})
