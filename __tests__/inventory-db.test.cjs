/**
 * TDD Test: Inventory DB — safeQuery/safeCount must log errors, not swallow silently.
 *
 * Run: node __tests__/inventory-db.test.cjs
 *
 * Expected BEFORE fix: safeQuery/safeCount catch-blocks have no console.error → test fails
 * Expected AFTER fix: catch-blocks log errors → test passes
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

console.log('\n=== Inventory DB Tests ===\n')

// Read the inventory-intelligence route source
const intelligenceRoute = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'api', 'internal', 'inventory-intelligence', 'route.ts'),
  'utf-8'
)

// Read the inventory-alarms route source
const alarmsRoute = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'api', 'internal', 'inventory-alarms', 'route.ts'),
  'utf-8'
)

// Test 1: safeCount in intelligence route must log errors
test('inventory-intelligence safeCount logs errors on catch', () => {
  // Find safeCount function and check its catch block has console.error/console.warn
  const safeCountMatch = intelligenceRoute.match(/async function safeCount[\s\S]*?^}/m)
  assert.ok(safeCountMatch, 'safeCount function not found')
  const safeCountBody = safeCountMatch[0]
  const hasCatchLogging = safeCountBody.includes('console.error') || safeCountBody.includes('console.warn')
  assert.ok(hasCatchLogging, 'safeCount catch block silently swallows errors — must log with console.error or console.warn')
})

// Test 2: safeQuery in intelligence route must log errors
test('inventory-intelligence safeQuery logs errors on catch', () => {
  const safeQueryMatch = intelligenceRoute.match(/async function safeQuery[\s\S]*?^}/m)
  assert.ok(safeQueryMatch, 'safeQuery function not found')
  const safeQueryBody = safeQueryMatch[0]
  const hasCatchLogging = safeQueryBody.includes('console.error') || safeQueryBody.includes('console.warn')
  assert.ok(hasCatchLogging, 'safeQuery catch block silently swallows errors — must log with console.error or console.warn')
})

// Test 3: safeCount in alarms route must log errors
test('inventory-alarms safeCount logs errors on catch', () => {
  const safeCountMatch = alarmsRoute.match(/async function safeCount[\s\S]*?^}/m)
  assert.ok(safeCountMatch, 'safeCount function not found')
  const safeCountBody = safeCountMatch[0]
  const hasCatchLogging = safeCountBody.includes('console.error') || safeCountBody.includes('console.warn')
  assert.ok(hasCatchLogging, 'safeCount catch block silently swallows errors — must log with console.error or console.warn')
})

// Test 4: safeQuery in alarms route must log errors
test('inventory-alarms safeQuery logs errors on catch', () => {
  const safeQueryMatch = alarmsRoute.match(/async function safeQuery[\s\S]*?^}/m)
  assert.ok(safeQueryMatch, 'safeQuery function not found')
  const safeQueryBody = safeQueryMatch[0]
  const hasCatchLogging = safeQueryBody.includes('console.error') || safeQueryBody.includes('console.warn')
  assert.ok(hasCatchLogging, 'safeQuery catch block silently swallows errors — must log with console.error or console.warn')
})

// Test 5: API response should include dbConnected status for debugging
test('inventory-intelligence response includes dbConnected status', () => {
  assert.ok(
    intelligenceRoute.includes('dbConnected') || intelligenceRoute.includes('db_connected'),
    'Response should include a dbConnected flag so frontend can distinguish "no data" from "DB down"'
  )
})

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
