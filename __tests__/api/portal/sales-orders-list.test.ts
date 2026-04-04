/**
 * Tests for portal sales-orders proxy routes.
 *
 * Routes are now thin proxies to genthrust-ai via lib/api-proxy.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: mockAuth }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeSession() {
  return { user: { id: "1", email: "client@test.com", role: "client", companyId: 1 } };
}

function makeRequest(url = "http://localhost/api/portal/sales-orders") {
  return new Request(url, { headers: { cookie: "session=abc" } });
}

function upstream(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/portal/sales-orders (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/sales-orders/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies GET to /api/portal/sales-orders on genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockResolvedValue(upstream(200, { data: [], total: 0, page: 1, limit: 20 }));

    const { GET } = await import("@/app/api/portal/sales-orders/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/portal/sales-orders");
  });

  it("forwards query params to genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockResolvedValue(upstream(200, { data: [], total: 0, page: 2, limit: 10 }));

    const { GET } = await import("@/app/api/portal/sales-orders/route");
    await GET(makeRequest("http://localhost/api/portal/sales-orders?page=2&search=SO-100"));

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("page=2");
    expect(String(url)).toContain("search=SO-100");
  });

  it("returns 502 when genthrust-ai is unreachable", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const { GET } = await import("@/app/api/portal/sales-orders/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(502);
  });
});

describe("GET /api/portal/sales-orders/[id] (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/sales-orders/[id]/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies GET /sales-orders/:id with id in path", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockResolvedValue(upstream(200, { order: { id: 4 }, lines: [] }));

    const { GET } = await import("@/app/api/portal/sales-orders/[id]/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "4" }) });
    expect(res.status).toBe(200);

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/portal/sales-orders/4");
  });

  it("passes through 404 from genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockResolvedValue(upstream(404, { error: "Not found" }));

    const { GET } = await import("@/app/api/portal/sales-orders/[id]/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "9999" }) });
    expect(res.status).toBe(404);
  });
});
