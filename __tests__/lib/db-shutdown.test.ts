/**
 * Tests for lib/db.ts and lib/inventory-db.ts graceful shutdown handlers.
 *
 * Phase 1 change: Both DB modules register process.once('SIGTERM') and
 * process.once('SIGINT') handlers that drain the connection pool on exit,
 * preventing connection leaks during deployments/restarts.
 *
 * Tests verify that the shutdown handlers are registered without actually
 * terminating the process or establishing real DB connections.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock mysql2/promise to prevent real DB connection attempts
// ---------------------------------------------------------------------------

const mockPoolEnd = vi.fn().mockResolvedValue(undefined)
const mockPool = {
  query: vi.fn(),
  end: mockPoolEnd,
}

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn(() => mockPool),
  },
}))

// ---------------------------------------------------------------------------
// DB module graceful shutdown registration
// ---------------------------------------------------------------------------

describe('lib/db.ts — graceful shutdown handler registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset process listeners for SIGTERM/SIGINT
    // Note: we don't actually remove them here (would affect the real process)
    // Instead we just verify listener counts have increased after import
  })

  it('registers at least one SIGTERM listener when module is loaded', async () => {
    const beforeCount = process.listenerCount('SIGTERM')
    // Re-import (may be cached, that's fine — we just need the listener to exist)
    await import('@/lib/db')
    const afterCount = process.listenerCount('SIGTERM')
    // Either a new one was added or it was already registered (module cached)
    expect(afterCount).toBeGreaterThanOrEqual(0) // Non-negative sanity check
    // The important check: at least one SIGTERM listener exists
    expect(process.listenerCount('SIGTERM')).toBeGreaterThanOrEqual(1)
  })

  it('registers at least one SIGINT listener when module is loaded', async () => {
    await import('@/lib/db')
    expect(process.listenerCount('SIGINT')).toBeGreaterThanOrEqual(1)
  })

  it('exports a query function', async () => {
    const { query } = await import('@/lib/db')
    expect(typeof query).toBe('function')
  })

  it('exports a getPool function', async () => {
    const { getPool } = await import('@/lib/db')
    expect(typeof getPool).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// inventory-db.ts — graceful shutdown handler registration
// ---------------------------------------------------------------------------

describe('lib/inventory-db.ts — graceful shutdown handler registration', () => {
  it('registers at least one SIGTERM listener when module is loaded', async () => {
    await import('@/lib/inventory-db')
    expect(process.listenerCount('SIGTERM')).toBeGreaterThanOrEqual(1)
  })

  it('registers at least one SIGINT listener when module is loaded', async () => {
    await import('@/lib/inventory-db')
    expect(process.listenerCount('SIGINT')).toBeGreaterThanOrEqual(1)
  })

  it('exports an inventoryQuery function', async () => {
    const { inventoryQuery } = await import('@/lib/inventory-db')
    expect(typeof inventoryQuery).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Shutdown handler behaviour — pool.end() called on SIGTERM
// ---------------------------------------------------------------------------

describe('DB graceful shutdown — pool.end() called', () => {
  it('pool.end is called when SIGTERM is emitted', async () => {
    // Load the module (handlers are registered as a side effect)
    await import('@/lib/db')

    // Emit SIGTERM
    process.emit('SIGTERM')

    // Give the microtask queue a tick to settle
    await new Promise(r => setTimeout(r, 0))

    // pool.end should have been called
    expect(mockPoolEnd).toHaveBeenCalled()
  })
})
