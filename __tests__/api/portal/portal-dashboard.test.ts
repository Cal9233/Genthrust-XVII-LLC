/**
 * Tests for GET /api/portal/dashboard (proxy)
 *
 * Route is now a thin proxy to genthrust-ai via lib/api-proxy.ts.
 * Tests verify: auth gate, proxy forwarding, upstream response passthrough.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: mockAuth }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClientSession(companyId = 1) {
  return {
    user: { id: "42", email: "client@test.com", role: "client", companyId },
  };
}

function makeRequest() {
  return new Request("http://localhost/api/portal/dashboard", {
    headers: { cookie: "next-auth.session-token=abc" },
  });
}

function upstreamResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const dashboardPayload = {
  companyName: "ACME Corp",
  stats: { activeSOs: 3, openInvoices: 2, openBalance: 5000, activeROs: 1 },
  recentSalesOrders: [{ id: 1, so_number: "SO-001", status: "Open" }],
  recentInvoices: [{ id: 1, invoice_no: "INV-001", status: "Open" }],
  recentRepairOrders: [{ id: 1, ro_number: "RO-001", status: "Open" }],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/portal/dashboard (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated (no session)", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/dashboard/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("proxies GET to genthrust-ai and returns dashboard payload", async () => {
    mockAuth.mockResolvedValue(makeClientSession(1));
    mockFetch.mockResolvedValue(upstreamResponse(200, dashboardPayload));

    const { GET } = await import("@/app/api/portal/dashboard/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();

    const body = await res.json();
    expect(body.companyName).toBe("ACME Corp");
    expect(body.stats).toMatchObject({ activeSOs: 3, openBalance: 5000 });
  });

  it("proxy call includes /api/portal/dashboard path", async () => {
    mockAuth.mockResolvedValue(makeClientSession(1));
    mockFetch.mockResolvedValue(upstreamResponse(200, dashboardPayload));

    const { GET } = await import("@/app/api/portal/dashboard/route");
    await GET(makeRequest());

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/portal/dashboard");
  });

  it("response includes recentSalesOrders, recentInvoices, recentRepairOrders arrays", async () => {
    mockAuth.mockResolvedValue(makeClientSession(1));
    mockFetch.mockResolvedValue(upstreamResponse(200, dashboardPayload));

    const { GET } = await import("@/app/api/portal/dashboard/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(Array.isArray(body.recentSalesOrders)).toBe(true);
    expect(Array.isArray(body.recentInvoices)).toBe(true);
    expect(Array.isArray(body.recentRepairOrders)).toBe(true);
  });

  it("returns 502 when genthrust-ai is unreachable", async () => {
    mockAuth.mockResolvedValue(makeClientSession(1));
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const { GET } = await import("@/app/api/portal/dashboard/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(502);
  });

  it("passes through 401 from genthrust-ai (session invalid there)", async () => {
    mockAuth.mockResolvedValue(makeClientSession(1));
    mockFetch.mockResolvedValue(upstreamResponse(401, { error: "Unauthorized" }));

    const { GET } = await import("@/app/api/portal/dashboard/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });
});
