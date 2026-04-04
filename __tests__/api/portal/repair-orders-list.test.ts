/**
 * Tests for portal repair-orders proxy routes.
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

function makeRequest(url = "http://localhost/api/portal/repair-orders") {
  return new Request(url, { headers: { cookie: "session=abc" } });
}

function upstream(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/portal/repair-orders (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/repair-orders/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies GET to /api/portal/repair-orders on genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockResolvedValue(upstream(200, { data: [], total: 0, page: 1, limit: 20 }));

    const { GET } = await import("@/app/api/portal/repair-orders/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/portal/repair-orders");
  });

  it("forwards query params to genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockResolvedValue(upstream(200, { data: [], total: 0, page: 1, limit: 10 }));

    const { GET } = await import("@/app/api/portal/repair-orders/route");
    await GET(makeRequest("http://localhost/api/portal/repair-orders?page=1&status=Open"));

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("status=Open");
  });

  it("returns 502 when genthrust-ai is unreachable", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const { GET } = await import("@/app/api/portal/repair-orders/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(502);
  });
});

describe("GET /api/portal/repair-orders/[id] (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/repair-orders/[id]/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies GET /repair-orders/:id with id in path", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockResolvedValue(upstream(200, { order: { id: 5 }, lines: [] }));

    const { GET } = await import("@/app/api/portal/repair-orders/[id]/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "5" }) });
    expect(res.status).toBe(200);

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/portal/repair-orders/5");
  });

  it("passes through 404 from genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockResolvedValue(upstream(404, { error: "Not found" }));

    const { GET } = await import("@/app/api/portal/repair-orders/[id]/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "9999" }) });
    expect(res.status).toBe(404);
  });
});
