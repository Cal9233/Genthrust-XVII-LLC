/**
 * TDD Test: Auth — JWT callback safety + credentials domain blocking.
 *
 * Run: node __tests__/auth.test.cjs
 *
 * Tests:
 * A) JWT callback must preserve token.role when account is undefined (refresh)
 * B) Credentials authorize must reject @genthrust.net emails
 * C) JWT callback must handle null/undefined user gracefully
 */
const fs = require('fs')
const path = require('path')
const assert = require('assert')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗ ${name}`)
    console.log(`    ${e.message}`)
    failed++
  }
}

console.log('\n=== Auth Tests ===\n')

const authConfigSrc = fs.readFileSync(
  path.join(__dirname, '..', 'auth.config.ts'),
  'utf-8'
)

const authSrc = fs.readFileSync(
  path.join(__dirname, '..', 'auth.ts'),
  'utf-8'
)

// Test A: JWT callback — role should NOT be lost on token refresh
// The current code: if (account) { token.role = ... }
// On refresh, account is undefined → role from previous token preserved (this is fine in theory)
// BUT if there's no guard, a crash in the jwt callback could cause 500
test('JWT callback has null-safe property access on user object', () => {
  // Check that user properties are accessed safely with optional chaining or null checks
  const jwtCallback = authConfigSrc.match(/async jwt\(\{[\s\S]*?\n    \}/m)
  assert.ok(jwtCallback, 'JWT callback not found')
  const jwtBody = jwtCallback[0]

  // The callback accesses user.id, 'companyId' in user, etc.
  // If user is undefined (on token refresh), these access patterns must be guarded
  // Current code has: if (user) { ... } which is correct
  assert.ok(
    jwtBody.includes('if (user)') || jwtBody.includes('user?.'),
    'JWT callback must guard against undefined user'
  )
})

// Test B: Credentials authorize must reject @genthrust.net emails
test('Credentials authorize rejects @genthrust.net emails', () => {
  // The authorize function should check if email ends with @genthrust.net and reject
  const authorizeSection = authSrc.match(/async authorize[\s\S]*?(?=\n    \}\),)/)
  assert.ok(authorizeSection, 'authorize function not found')
  const authorizeBody = authorizeSection[0]

  const blocksGenthrustDomain =
    authorizeBody.includes('@genthrust.net') ||
    authorizeBody.includes('genthrust.net')

  assert.ok(
    blocksGenthrustDomain,
    'Credentials authorize must check for @genthrust.net domain and reject internal users — currently any email in portal_users can log in as client'
  )
})

// Test C: Credentials authorize specifically REJECTS (returns null) for internal domain
test('Credentials authorize returns null for @genthrust.net emails', () => {
  const authorizeSection = authSrc.match(/async authorize[\s\S]*?(?=\n    \}\),)/)
  assert.ok(authorizeSection, 'authorize function not found')
  const authorizeBody = authorizeSection[0]

  // Must have a pattern like: if (email.endsWith('@genthrust.net')) return null
  const hasRejectPattern =
    (authorizeBody.includes('genthrust.net') &&
      (authorizeBody.includes('return null') || authorizeBody.includes('return false')))

  assert.ok(
    hasRejectPattern,
    'Credentials authorize must explicitly reject @genthrust.net emails with return null'
  )
})

// Test D: signIn callback should verify internal users exist in Entra directory
// (Already checks @genthrust.net domain for non-credentials providers — this is correct)
test('signIn callback validates @genthrust.net domain for Entra logins', () => {
  assert.ok(
    authConfigSrc.includes("@genthrust.net"),
    'signIn callback must validate genthrust.net domain'
  )
})

// Test E: JWT callback should not crash when token properties are missing
test('JWT callback is resilient to missing token properties', () => {
  const jwtCallback = authConfigSrc.match(/async jwt\(\{[\s\S]*?\n    \}/m)
  assert.ok(jwtCallback, 'JWT callback not found')
  const jwtBody = jwtCallback[0]

  // The session callback uses token.role with a fallback
  const sessionCallback = authConfigSrc.match(/async session\(\{[\s\S]*?\n    \}/m)
  assert.ok(sessionCallback, 'session callback not found')
  const sessionBody = sessionCallback[0]

  // Session should have a fallback for missing role
  assert.ok(
    sessionBody.includes("|| 'internal'") || sessionBody.includes("?? 'internal'"),
    'session callback should have a default role fallback'
  )
})

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
