/**
 * Regression tests for CSP security fix (C-5).
 * Verifies the nonce-based CSP is produced by middleware (not next.config.js).
 */
import { describe, it, expect } from 'vitest'
import path from 'path'
import { buildCspHeader } from '../lib/csp'

const CONFIG_PATH = path.resolve(__dirname, '..', 'next.config.js')

describe('CSP script-src regression (C-5)', () => {
  it('next.config.js exports a headers() function', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextConfig = require(CONFIG_PATH)
    expect(typeof nextConfig.headers).toBe('function')
  })

  it('CSP is no longer in next.config.js (moved to middleware for nonce support)', async () => {
    // CSP was moved from next.config.js to middleware.ts to support per-request
    // nonces. Verify next.config.js no longer sets a CSP header.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextConfig = require(CONFIG_PATH)
    const headerGroups = await nextConfig.headers()
    const allHeaders: { key: string; value: string }[] = headerGroups.flatMap(
      (g: { headers: { key: string; value: string }[] }) => g.headers
    )
    const cspHeader = allHeaders.find((h) => h.key === 'Content-Security-Policy')
    expect(cspHeader).toBeUndefined()
  })

  it('production CSP includes nonce and unsafe-inline (CSP2 progressive enhancement)', () => {
    const csp = buildCspHeader('test-nonce-abc')
    expect(csp).toContain("'nonce-test-nonce-abc'")
    expect(csp).toContain("'unsafe-inline'")
    // Verify nonce is the interpolated value, not a literal placeholder
    expect(csp).not.toContain('${nonce}')
  })

  it('production CSP does not include unsafe-eval', () => {
    // NODE_ENV=test is treated as non-development, same as production
    const csp = buildCspHeader('test-nonce')
    expect(csp).not.toContain("'unsafe-eval'")
  })
})
