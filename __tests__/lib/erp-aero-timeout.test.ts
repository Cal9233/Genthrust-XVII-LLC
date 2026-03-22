/**
 * Tests for lib/erp-aero.ts — Phase 1 change: AbortSignal.timeout(15000)
 * added to every fetch call to prevent indefinite hangs on ERP AERO calls.
 *
 * Tests verify:
 * 1. The abort signal is actually passed to fetch
 * 2. A timed-out request throws (AbortError)
 * 3. Normal requests still work through the signal
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock erp-client dependencies so we can call erp-aero functions in isolation
// ---------------------------------------------------------------------------

vi.mock('@/lib/erp-client', () => ({
  getConfig: () => ({ baseUrl: 'https://wapi.erp.aero' }),
  getHeaders: async () => ({ Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }),
  clearErpTokenCache: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helper to build a fetch mock that captures the signal
// ---------------------------------------------------------------------------

function makeFetchMock(responseBody: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => responseBody,
    text: async () => JSON.stringify(responseBody),
  })
}

describe('erp-aero erpFetch — AbortSignal.timeout', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock({ res: 1, data: { list: [], limit: 100, total: 0 } }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  it('passes an AbortSignal to every fetch call', async () => {
    const { getPartsList } = await import('@/lib/erp-aero')
    await getPartsList()

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalled()

    const [_url, init] = fetchMock.mock.calls[0]
    expect(init).toBeDefined()
    expect(init.signal).toBeDefined()
    // AbortSignal.timeout creates an AbortSignal instance
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('signal is not already aborted at call time', async () => {
    const { getPartsList } = await import('@/lib/erp-aero')
    await getPartsList()

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    const [_url, init] = fetchMock.mock.calls[0]
    // A fresh timeout signal should not be aborted immediately
    expect(init.signal.aborted).toBe(false)
  })

  it('throws when fetch rejects (simulates timeout/network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    ))

    const { getPartsList } = await import('@/lib/erp-aero')
    await expect(getPartsList()).rejects.toThrow()
  })

  it('getPartsList returns response data on success', async () => {
    const mockData = {
      res: 1,
      data: { list: [{ body: { productid: 1, productname: 'BOLT', description: null, full_description: null, nsnnumber: null, cage_code: null, mfr_part_no: 'B-100', hazmat: 0, hazmatclass: null, is_portal_item: 0, serial_no: null, productcategory: null, createdtime: null, modified_time: null, warehouse: { title: null }, manufacturer: { vendornameOEM: null } } }], limit: 100, total: 1 },
    }
    vi.stubGlobal('fetch', makeFetchMock(mockData))

    const { getPartsList } = await import('@/lib/erp-aero')
    const result = await getPartsList()
    expect(result.data.list).toHaveLength(1)
    expect(result.data.total).toBe(1)
  })

  it('throws on non-ok response after retry', async () => {
    // First call: 401, second: still 500
    let callCount = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: false, status: 401, statusText: 'Unauthorized',
          json: async () => ({}), text: async () => '',
        })
      }
      return Promise.resolve({
        ok: false, status: 500, statusText: 'Server Error',
        json: async () => ({}), text: async () => '',
      })
    }))

    const { getPartsList } = await import('@/lib/erp-aero')
    await expect(getPartsList()).rejects.toThrow('ERP AERO request failed')
  })
})
