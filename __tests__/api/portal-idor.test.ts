/**
 * Tests for portal auth gate (XVII-LLC proxy layer)
 *
 * After the proxy rewire, XVII-LLC routes no longer run IDOR checks directly.
 * IDOR enforcement (company scoping, parameterized SQL) now lives in genthrust-ai.
 * XVII-LLC's responsibility is:
 *   1. Auth gate: reject unauthenticated requests before proxying
 *   2. Pass-through: forward genthrust-ai 401/403/404 to the client verbatim
 *
 * Note: The IDOR tests that verified direct MySQL isolation have moved to
 * genthrust-ai's test suite. These tests verify the proxy-level security boundary.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: mockAuth }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function upstream(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeRequest(url: string) {
  return new Request(url, { headers: { cookie: "session=abc" } });
}

// ---------------------------------------------------------------------------
// Invoice detail — auth gate
// ---------------------------------------------------------------------------

describe("Portal invoice detail — auth gate (proxy layer)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/invoices/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/invoices/42"), {
      params: Promise.resolve({ id: "42" }),
    });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 401 when role is not client", async () => {
    mockAuth.mockResolvedValue({ user: { role: "internal" } });
    const { GET } = await import("@/app/api/portal/invoices/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/invoices/42"), {
      params: Promise.resolve({ id: "42" }),
    });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("passes through 404 from genthrust-ai (IDOR enforcement is upstream)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "1", role: "client", companyId: 2 } });
    mockFetch.mockResolvedValue(upstream(404, { error: "Not found" }));
    const { GET } = await import("@/app/api/portal/invoices/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/invoices/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(404);
  });

  it("forwards cookie to genthrust-ai so upstream can verify session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "1", role: "client", companyId: 1 } });
    mockFetch.mockResolvedValue(upstream(200, { invoice: { id: 1 }, lines: [] }));
    const req = new Request("http://localhost/api/portal/invoices/1", {
      headers: { cookie: "next-auth.session-token=token123" },
    });
    const { GET } = await import("@/app/api/portal/invoices/[id]/route");
    await GET(req, { params: Promise.resolve({ id: "1" }) });
    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Record<string, string>)["Cookie"]).toContain(
      "next-auth.session-token=token123"
    );
  });
});

// ---------------------------------------------------------------------------
// Repair order detail — auth gate
// ---------------------------------------------------------------------------

describe("Portal repair order detail — auth gate (proxy layer)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/repair-orders/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/repair-orders/42"), {
      params: Promise.resolve({ id: "42" }),
    });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 401 when role is not client", async () => {
    mockAuth.mockResolvedValue({ user: { role: "internal" } });
    const { GET } = await import("@/app/api/portal/repair-orders/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/repair-orders/42"), {
      params: Promise.resolve({ id: "42" }),
    });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("passes through 404 from genthrust-ai (IDOR enforcement is upstream)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "1", role: "client", companyId: 9 } });
    mockFetch.mockResolvedValue(upstream(404, { error: "Not found" }));
    const { GET } = await import("@/app/api/portal/repair-orders/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/repair-orders/2"), {
      params: Promise.resolve({ id: "2" }),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Sales order detail — auth gate
// ---------------------------------------------------------------------------

describe("Portal sales order detail — auth gate (proxy layer)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/sales-orders/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/sales-orders/42"), {
      params: Promise.resolve({ id: "42" }),
    });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 401 when role is not client", async () => {
    mockAuth.mockResolvedValue({ user: { role: "internal" } });
    const { GET } = await import("@/app/api/portal/sales-orders/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/sales-orders/42"), {
      params: Promise.resolve({ id: "42" }),
    });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("passes through 404 from genthrust-ai (IDOR enforcement is upstream)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "1", role: "client", companyId: 4 } });
    mockFetch.mockResolvedValue(upstream(404, { error: "Not found" }));
    const { GET } = await import("@/app/api/portal/sales-orders/[id]/route");
    const res = await GET(makeRequest("http://localhost/api/portal/sales-orders/3"), {
      params: Promise.resolve({ id: "3" }),
    });
    expect(res.status).toBe(404);
  });
});
