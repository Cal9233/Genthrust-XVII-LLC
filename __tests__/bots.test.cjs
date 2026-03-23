/**
 * TDD Test: Bot issues — config and connection fixes.
 *
 * Run: node __tests__/bots.test.cjs
 *
 * Tests:
 * A) OneDrive sync filename should NOT have double .xlsx extension (#11)
 * B) DB connection pool should have pool_recycle for stale connections (#9)
 * C) DB connection pool_size should be >= 10 for production workload (#9)
 * D) mysql-connector-python should be in requirements.txt (#12)
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

console.log('\n=== Bot Tests ===\n')

const botEnv = fs.readFileSync('C:\\GenthrustBot\\.env', 'utf-8')
const dbConnection = fs.readFileSync('C:\\GenthrustBot\\db_connection.py', 'utf-8')
const requirements = fs.readFileSync('C:\\GenthrustBot\\requirements.txt', 'utf-8')

// Test A: OneDrive sync filename should NOT have double extension
test('OneDrive sync filename has correct extension (not double .xlsx)', () => {
  const syncFileMatch = botEnv.match(/SYNC_FILE_PATH=(.+)/)
  assert.ok(syncFileMatch, 'SYNC_FILE_PATH not found in .env')
  const filename = syncFileMatch[1].trim()

  // Count .xlsx occurrences
  const xlsxCount = (filename.match(/\.xlsx/g) || []).length
  assert.ok(
    xlsxCount <= 1,
    `Filename "${filename}" has ${xlsxCount} .xlsx extensions — should have exactly 1. Fix the double extension (.xlsx1.xlsx → .xlsx)`
  )
})

// Test B: Pool should have pool_recycle to handle stale connections
test('DB connection pool has pool_recycle config', () => {
  assert.ok(
    dbConnection.includes('pool_recycle') || dbConnection.includes('connect_timeout'),
    'DB pool should configure pool_recycle or connect_timeout to handle stale/dead connections'
  )
})

// Test C: Pool size should be adequate
test('DB connection pool_size is >= 10', () => {
  const poolSizeMatch = dbConnection.match(/pool_size\s*=\s*(\d+)/)
  assert.ok(poolSizeMatch, 'pool_size not found in db_connection.py')
  const poolSize = parseInt(poolSizeMatch[1])
  assert.ok(
    poolSize >= 10,
    `Pool size is ${poolSize}, should be >= 10 to handle concurrent bot operations`
  )
})

// Test D: mysql-connector-python in requirements
test('mysql-connector-python is in requirements.txt', () => {
  assert.ok(
    requirements.includes('mysql-connector-python'),
    'mysql-connector-python must be in requirements.txt'
  )
})

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
