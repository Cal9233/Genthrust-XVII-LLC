/**
 * Tests for lib/bot-helpers.ts — Phase 1 changes:
 * 1. getBotMetrics: reads max 512KB to prevent OOM on large log files
 * 2. getLogTail: pure Node.js tail implementation (no `tail` binary)
 * 3. getAllBotStatusesAsync: parallel checks with 30s cache
 *
 * Uses mocked fs and child_process to avoid Windows-only dependencies.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock fs and child_process before importing bot-helpers
// ---------------------------------------------------------------------------

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    statSync: vi.fn(),
    readFileSync: vi.fn(),
    openSync: vi.fn(),
    readSync: vi.fn(),
    closeSync: vi.fn(),
  }
})

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}))

// Import after mocks
import * as fs from 'fs'
import { execFileSync } from 'child_process'
import { getBotMetrics, getLogTail, BOT_REGISTRY } from '@/lib/bot-helpers'

const mockedStat = vi.mocked(fs.statSync)
const mockedReadFile = vi.mocked(fs.readFileSync)
const mockedOpen = vi.mocked(fs.openSync)
const mockedRead = vi.mocked(fs.readSync)
const mockedClose = vi.mocked(fs.closeSync)
const mockedExecFileSync = vi.mocked(execFileSync)

// ---------------------------------------------------------------------------
// getBotMetrics — 512KB memory cap
// ---------------------------------------------------------------------------

describe('getBotMetrics — memory cap (512KB)', () => {
  const HALF_MB = 512 * 1024

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads full file content when file is <= 512KB', () => {
    mockedStat.mockReturnValue({ size: HALF_MB } as any)
    mockedReadFile.mockReturnValue('') // no content, metrics will all be 0

    getBotMetrics('ils')

    expect(mockedReadFile).toHaveBeenCalledOnce()
    expect(mockedOpen).not.toHaveBeenCalled()
  })

  it('reads only the last 512KB when file exceeds that size', () => {
    const LARGE_FILE = HALF_MB + 1
    mockedStat.mockReturnValue({ size: LARGE_FILE } as any)
    mockedOpen.mockReturnValue(5 as any)
    mockedRead.mockImplementation((_fd, buf) => {
      // Fill buffer with zeros (empty log content)
      ;(buf as Buffer).fill(0)
      return HALF_MB
    })
    mockedClose.mockReturnValue(undefined)

    getBotMetrics('ils')

    expect(mockedReadFile).not.toHaveBeenCalled()
    // Should open, read exactly HALF_MB, then close
    expect(mockedOpen).toHaveBeenCalledOnce()
    expect(mockedRead).toHaveBeenCalledWith(
      5,
      expect.any(Buffer),
      0,
      HALF_MB,
      LARGE_FILE - HALF_MB
    )
    expect(mockedClose).toHaveBeenCalledWith(5)
  })

  it('returns all-zero metrics when log file does not exist', () => {
    mockedStat.mockImplementation(() => { throw new Error('ENOENT') })

    const metrics = getBotMetrics('ils')
    // Should return zeros, not throw
    expect(typeof metrics).toBe('object')
    for (const val of Object.values(metrics)) {
      expect(val).toBe(0)
    }
  })

  it('returns empty object for unknown bot key', () => {
    const metrics = getBotMetrics('unknown_bot')
    expect(metrics).toEqual({})
  })

  it('counts matching log lines for ils bot', () => {
    const today = new Date().toISOString().split('T')[0]
    const logContent = [
      `${today} 10:00:00 - Quote created for RFQ-001`,
      `${today} 10:01:00 - Quote drafted for RFQ-002`,
      `${today} 10:02:00 - RFQ matched with inventory`,
      `2020-01-01 00:00:00 - Old entry (should not count)`,
    ].join('\n')

    mockedStat.mockReturnValue({ size: logContent.length } as any)
    mockedReadFile.mockReturnValue(logContent as any)

    const metrics = getBotMetrics('ils')
    // "Quotes Created" pattern matches "created" and "drafted"
    expect(metrics['Quotes Created']).toBeGreaterThanOrEqual(2)
    // "RFQs Matched" matches "matched"
    expect(metrics['RFQs Matched']).toBeGreaterThanOrEqual(1)
  })

  it('only counts lines from today (not yesterday)', () => {
    const today = new Date().toISOString().split('T')[0]
    const logContent = [
      `2020-01-01 09:00:00 - Quote created`,
      `2019-06-15 09:00:00 - Quote drafted`,
      `${today} 10:00:00 - Some other event`,
    ].join('\n')

    mockedStat.mockReturnValue({ size: logContent.length } as any)
    mockedReadFile.mockReturnValue(logContent as any)

    const metrics = getBotMetrics('ils')
    // Old entries don't match today — Quotes Created should be 0
    expect(metrics['Quotes Created']).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getLogTail — pure Node.js tail implementation
// ---------------------------------------------------------------------------

describe('getLogTail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws for unknown bot key', () => {
    expect(() => getLogTail('nonexistent')).toThrow('Unknown bot')
  })

  it('returns empty content for zero-size file', () => {
    mockedStat.mockReturnValue({ size: 0 } as any)
    const result = getLogTail('ils')
    expect(result.content).toBe('')
    expect(result.sizeBytes).toBe(0)
  })

  it('returns error message when log file not found', () => {
    mockedStat.mockImplementation(() => { throw new Error('ENOENT') })
    const result = getLogTail('ils')
    expect(result.content).toContain('Log file not found')
    expect(result.sizeBytes).toBe(0)
  })

  it('reads file in chunks from the end', () => {
    const content = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`).join('\n')
    mockedStat.mockReturnValue({ size: content.length } as any)
    mockedOpen.mockReturnValue(3 as any)
    mockedRead.mockImplementation((_fd, buf, _offset, length, position) => {
      const chunk = content.slice(position as number, (position as number) + length)
      ;(buf as Buffer).write(chunk, 'utf-8')
      return chunk.length
    })
    mockedClose.mockReturnValue(undefined)

    const result = getLogTail('ils', 10)
    expect(result.sizeBytes).toBe(content.length)
    expect(mockedClose).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// BOT_REGISTRY constant
// ---------------------------------------------------------------------------

describe('BOT_REGISTRY', () => {
  it('contains exactly 5 bots', () => {
    expect(Object.keys(BOT_REGISTRY)).toHaveLength(5)
  })

  it('has ils, internal, sync, aog, inventory keys', () => {
    expect(BOT_REGISTRY).toHaveProperty('ils')
    expect(BOT_REGISTRY).toHaveProperty('internal')
    expect(BOT_REGISTRY).toHaveProperty('sync')
    expect(BOT_REGISTRY).toHaveProperty('aog')
    expect(BOT_REGISTRY).toHaveProperty('inventory')
  })

  it('each bot has required fields', () => {
    for (const [_key, bot] of Object.entries(BOT_REGISTRY)) {
      expect(bot.serviceName).toBeTruthy()
      expect(bot.logFile).toBeTruthy()
      expect(bot.displayName).toBeTruthy()
      expect(bot.description).toBeTruthy()
    }
  })

  it('service names have GT- prefix', () => {
    for (const bot of Object.values(BOT_REGISTRY)) {
      expect(bot.serviceName.startsWith('GT-')).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// getAllBotStatuses — Windows sc query parsing
// ---------------------------------------------------------------------------

describe('getAllBotStatuses — status detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns RUNNING when sc query output contains RUNNING', () => {
    mockedExecFileSync.mockReturnValue('STATE : 4  RUNNING\r\n' as any)
    const { getAllBotStatuses } = require('@/lib/bot-helpers')
    const statuses = getAllBotStatuses()
    expect(statuses.every((s: any) => s.status === 'RUNNING')).toBe(true)
  })

  it('returns STOPPED when sc query output contains STOPPED', () => {
    mockedExecFileSync.mockReturnValue('STATE : 1  STOPPED\r\n' as any)
    const { getAllBotStatuses } = require('@/lib/bot-helpers')
    const statuses = getAllBotStatuses()
    expect(statuses.every((s: any) => s.status === 'STOPPED')).toBe(true)
  })

  it('returns UNKNOWN when sc query throws (service not found)', () => {
    mockedExecFileSync.mockImplementation(() => { throw new Error('service not found') })
    const { getAllBotStatuses } = require('@/lib/bot-helpers')
    const statuses = getAllBotStatuses()
    expect(statuses.every((s: any) => s.status === 'UNKNOWN')).toBe(true)
  })

  it('includes key, displayName, serviceName, and description for each bot', () => {
    mockedExecFileSync.mockReturnValue('STATE : 4  RUNNING\r\n' as any)
    const { getAllBotStatuses } = require('@/lib/bot-helpers')
    const statuses = getAllBotStatuses()
    expect(statuses).toHaveLength(5)
    for (const s of statuses) {
      expect(s.key).toBeTruthy()
      expect(s.displayName).toBeTruthy()
      expect(s.serviceName).toBeTruthy()
      expect(s.description).toBeTruthy()
    }
  })
})
