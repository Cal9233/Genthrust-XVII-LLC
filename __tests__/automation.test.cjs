/**
 * TDD Test: Automation route — only allows role: 'internal'.
 *
 * Run: node __tests__/automation.test.cjs
 *
 * The automation endpoint was returning 401 because users logged in via
 * the client flow got role: 'client'. Now that auth is fixed (internal users
 * blocked from credentials), this should resolve. Verify the route logic
 * is correct.
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

console.log('\n=== Automation Route Tests ===\n')

const routeSrc = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'api', 'internal', 'automation', 'route.ts'),
  'utf-8'
)

const authSrc = fs.readFileSync(
  path.join(__dirname, '..', 'auth.ts'),
  'utf-8'
)

// Test 1: Route checks for internal role
test('Automation route requires internal role', () => {
  assert.ok(
    routeSrc.includes("role !== 'internal'") || routeSrc.includes("role === 'internal'"),
    'Route must check for internal role'
  )
})

// Test 2: Auth blocks genthrust.net from credentials (prerequisite for auto-fix)
test('Auth blocks @genthrust.net from credentials flow (prerequisite)', () => {
  const authorizeSection = authSrc.match(/async authorize[\s\S]*?(?=\n    \}\),)/)
  assert.ok(authorizeSection, 'authorize function not found')
  assert.ok(
    authorizeSection[0].includes('genthrust.net'),
    'Credentials authorize must block @genthrust.net to fix the role assignment issue'
  )
})

// Test 3: Route handles ERP errors gracefully with catch blocks
test('Automation route has error handling for ERP calls', () => {
  const hasCatchBlocks = (routeSrc.match(/\.catch/g) || []).length
  assert.ok(
    hasCatchBlocks >= 3,
    `Route should have catch blocks for ERP calls (found ${hasCatchBlocks}, need >= 3)`
  )
})

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
