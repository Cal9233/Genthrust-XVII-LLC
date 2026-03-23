/**
 * TDD Test: PDF parse — verify import and API are correct.
 *
 * Run: node __tests__/pdf-parse.test.cjs
 *
 * Tests:
 * A) PDFParse is a named export from pdf-parse
 * B) PDFParse has getText() and destroy() methods
 * C) @types/pdf-parse (v1) should NOT be installed (conflicts with v2 own types)
 * D) parse-pdf route uses correct import
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

console.log('\n=== PDF Parse Tests ===\n')

// Test A: PDFParse is a named export
test('PDFParse is a valid named export from pdf-parse', () => {
  const { PDFParse } = require('pdf-parse')
  assert.ok(PDFParse, 'PDFParse should be a named export')
  assert.strictEqual(typeof PDFParse, 'function', 'PDFParse should be a class/function')
})

// Test B: PDFParse has getText() and destroy() methods
test('PDFParse prototype has getText and destroy methods', () => {
  const { PDFParse } = require('pdf-parse')
  assert.strictEqual(typeof PDFParse.prototype.getText, 'function', 'getText must exist')
  assert.strictEqual(typeof PDFParse.prototype.destroy, 'function', 'destroy must exist')
})

// Test C: @types/pdf-parse should NOT be installed (conflicts with v2)
test('@types/pdf-parse is NOT installed (v1 types conflict with v2)', () => {
  const typesPath = path.join(__dirname, '..', 'node_modules', '@types', 'pdf-parse')
  const exists = fs.existsSync(typesPath)
  assert.ok(
    !exists,
    '@types/pdf-parse (v1) is installed but conflicts with pdf-parse v2 own types — remove it'
  )
})

// Test D: Route import is correct
test('parse-pdf route uses named import { PDFParse }', () => {
  const routeSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'api', 'internal', 'inventory-intelligence', 'parse-pdf', 'route.ts'),
    'utf-8'
  )
  assert.ok(
    routeSrc.includes("import { PDFParse } from 'pdf-parse'") ||
    routeSrc.includes('import { PDFParse } from "pdf-parse"'),
    'Route should use named import { PDFParse }'
  )
})

// Test E: PDFParse can be instantiated with { data: Uint8Array }
test('PDFParse can be instantiated with Uint8Array data', () => {
  const { PDFParse } = require('pdf-parse')
  // Minimal PDF header
  const data = new Uint8Array([37, 80, 68, 70]) // %PDF
  const pdf = new PDFParse({ data })
  assert.ok(pdf, 'PDFParse instance should be created')
  assert.strictEqual(typeof pdf.getText, 'function', 'Instance should have getText')
  if (pdf.destroy) pdf.destroy()
})

// Test F: package.json should NOT have @types/pdf-parse
test('package.json devDependencies does not include @types/pdf-parse', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'))
  const hasBadTypes = pkg.devDependencies && '@types/pdf-parse' in pkg.devDependencies
  assert.ok(
    !hasBadTypes,
    '@types/pdf-parse in devDependencies conflicts with pdf-parse v2 own type declarations — remove it'
  )
})

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
