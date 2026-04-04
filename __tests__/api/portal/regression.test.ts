/**
 * Regression suite — portal endpoints must respond correctly after proxy rewire.
 *
 * Most portal routes are now thin proxies to genthrust-ai (lib/api-proxy.ts).
 * These tests guard against regressions:
 *   - Auth gate: unauthenticated → 401, never proxied
 *   - Proxy: authenticated → forwards to genthrust-ai, returns upstream response
 *   - Upstream passthrough: any status from genthrust-ai is forwarded verbatim
 *
 * MFA status is NOT proxied — it still hits XVII-LLC's MySQL directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: mockAuth }));

// Both fetch (proxy) and query (direct MySQL for MFA) need to be mocked
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({ query: mockQuery }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClientSession(companyId = 1) {
  return { user: { id: "1", email: "client@example.com", role: "client", companyId } };
}

function makeRequest(url: string) {
  return new Request(url, { headers: { cookie: "session=abc" } });
}

function upstream(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Dashboard regression
// ---------------------------------------------------------------------------

describe("GET /api/portal/dashboard — regression (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 for an unauthenticated request (never proxied)", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/dashboard/route");
    const res = await GET(makeRequest("http://localhost/api/portal/dashboard"));
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 401 when user has internal role (portal-only)", async () => {
    mockAuth.mockResolvedValue({ user: { role: "internal", companyId: 1 } });
    const { GET } = await import("@/app/api/portal/dashboard/route");
    const res = await GET(makeRequest("http://localhost/api/portal/dashboard"));
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies authenticated request and returns dashboard stats", async () => {
    mockAuth.mockResolvedValue(makeClientSession(1));
    mockFetch.mockResolvedValue(
      upstream(200, {
        companyName: "ACME Corp",
        stats: { activeSOs: 3, openInvoices: 2, openBalance: 1500, activeROs: 1 },
        recentSalesOrders: [],
        recentInvoices: [],
        recentRepairOrders: [],
      })
    );

    const { GET } = await import("@/app/api/portal/dashboard/route");
    const res = await GET(makeRequest("http://localhost/api/portal/dashboard"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("stats");
    expect(body.stats).toHaveProperty("activeSOs");
    expect(body.stats).toHaveProperty("openInvoices");
    expect(body.stats).toHaveProperty("openBalance");
    expect(body.stats).toHaveProperty("activeROs");
    expect(body).toHaveProperty("recentSalesOrders");
    expect(body).toHaveProperty("recentInvoices");
    expect(body).toHaveProperty("recentRepairOrders");
  });
});

// ---------------------------------------------------------------------------
// Invoice detail regression
// ---------------------------------------------------------------------------

describe("GET /api/portal/invoices/[id] — regression (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 for unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/invoices/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/invoices/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies to genthrust-ai and returns invoice detail", async () => {
    mockAuth.mockResolvedValue(makeClientSession(1));
    mockFetch.mockResolvedValue(
      upstream(200, {
        invoice: { id: 1, account_name: "ACME Corp", invoice_no: "INV-001" },
        lines: [],
      })
    );

    const { GET } = await import("@/app/api/portal/invoices/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/invoices/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("invoice");
    expect(body).toHaveProperty("lines");
    expect(body.invoice.account_name).toBe("ACME Corp");
  });

  it("passes through 404 from genthrust-ai (IDOR block)", async () => {
    mockAuth.mockResolvedValue(makeClientSession(2));
    mockFetch.mockResolvedValue(upstream(404, { error: "Not found" }));

    const { GET } = await import("@/app/api/portal/invoices/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/invoices/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Sales order detail regression
// ---------------------------------------------------------------------------

describe("GET /api/portal/sales-orders/[id] — regression (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 for unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/sales-orders/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/sales-orders/3"), {
      params: Promise.resolve({ id: "3" }),
    });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies to genthrust-ai and returns SO detail", async () => {
    mockAuth.mockResolvedValue(makeClientSession(3));
    mockFetch.mockResolvedValue(
      upstream(200, {
        order: { id: 3, customer_name: "Customer Inc", so_number: "SO-001" },
        lines: [],
      })
    );

    const { GET } = await import("@/app/api/portal/sales-orders/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/sales-orders/3"), {
      params: Promise.resolve({ id: "3" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("order");
    expect(body).toHaveProperty("lines");
    expect(body.order.customer_name).toBe("Customer Inc");
  });

  it("passes through 404 from genthrust-ai (cross-company access blocked)", async () => {
    mockAuth.mockResolvedValue(makeClientSession(4));
    mockFetch.mockResolvedValue(upstream(404, { error: "Not found" }));

    const { GET } = await import("@/app/api/portal/sales-orders/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/sales-orders/3"), {
      params: Promise.resolve({ id: "3" }),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Repair order detail regression
// ---------------------------------------------------------------------------

describe("GET /api/portal/repair-orders/[id] — regression (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 for unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/repair-orders/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/repair-orders/2"), {
      params: Promise.resolve({ id: "2" }),
    });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies to genthrust-ai and returns RO detail", async () => {
    mockAuth.mockResolvedValue(makeClientSession(2));
    mockFetch.mockResolvedValue(
      upstream(200, {
        order: { id: 2, vendor_name: "Vendor LLC", ro_number: "RO-001" },
        lines: [],
      })
    );

    const { GET } = await import("@/app/api/portal/repair-orders/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/repair-orders/2"), {
      params: Promise.resolve({ id: "2" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("order");
    expect(body).toHaveProperty("lines");
    expect(body.order.vendor_name).toBe("Vendor LLC");
  });
});

// ---------------------------------------------------------------------------
// MFA status regression — NOT proxied, still direct MySQL
// ---------------------------------------------------------------------------

describe("GET /api/portal/mfa/status — regression (direct MySQL, not proxied)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockQuery.mockReset();
  });

  it("returns MFA status for an authenticated client", async () => {
    mockAuth.mockResolvedValue(makeClientSession(1));
    mockQuery.mockResolvedValueOnce([{ mfa_enabled: 0 }]);

    const { GET } = await import("@/app/api/portal/mfa/status/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("enabled");
    expect(body.enabled).toBe(false);
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/mfa/status/route");
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
