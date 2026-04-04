/**
 * Tests for portal invoices proxy routes.
 *
 * Routes are now thin proxies to genthrust-ai via lib/api-proxy.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: mockAuth }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeClientSession() {
  return { user: { id: "1", email: "client@test.com", role: "client", companyId: 1 } };
}

function makeRequest(url = "http://localhost/api/portal/invoices") {
  return new Request(url, { headers: { cookie: "session=abc" } });
}

function upstream(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// GET /api/portal/invoices
// ---------------------------------------------------------------------------

describe("GET /api/portal/invoices (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/invoices/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies GET to /api/portal/invoices on genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeClientSession());
    mockFetch.mockResolvedValue(upstream(200, { data: [], total: 0, page: 1, limit: 20 }));

    const { GET } = await import("@/app/api/portal/invoices/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/portal/invoices");
  });

  it("forwards query params (page, limit, status, overdue) to genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeClientSession());
    mockFetch.mockResolvedValue(upstream(200, { data: [], total: 0, page: 2, limit: 10 }));

    const { GET } = await import("@/app/api/portal/invoices/route");
    await GET(makeRequest("http://localhost/api/portal/invoices?page=2&limit=10&overdue=true"));

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("page=2");
    expect(String(url)).toContain("limit=10");
    expect(String(url)).toContain("overdue=true");
  });

  it("returns 502 when genthrust-ai is unreachable", async () => {
    mockAuth.mockResolvedValue(makeClientSession());
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const { GET } = await import("@/app/api/portal/invoices/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(502);
  });
});

// ---------------------------------------------------------------------------
// GET /api/portal/invoices/[id]
// ---------------------------------------------------------------------------

describe("GET /api/portal/invoices/[id] (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/invoices/[id]/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies GET /invoices/:id with id in path", async () => {
    mockAuth.mockResolvedValue(makeClientSession());
    mockFetch.mockResolvedValue(upstream(200, { invoice: { id: 3 }, lines: [] }));

    const { GET } = await import("@/app/api/portal/invoices/[id]/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "3" }) });
    expect(res.status).toBe(200);

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/portal/invoices/3");
  });

  it("passes through 404 from genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeClientSession());
    mockFetch.mockResolvedValue(upstream(404, { error: "Not found" }));

    const { GET } = await import("@/app/api/portal/invoices/[id]/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "9999" }) });
    expect(res.status).toBe(404);
  });
});
