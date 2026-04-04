/**
 * Tests for portal quotes proxy routes.
 *
 * Routes are now thin proxies to genthrust-ai via lib/api-proxy.ts.
 * These tests verify:
 *   1. Unauthenticated requests return 401 (XVII-LLC gate, before proxy)
 *   2. Authenticated requests forward to genthrust-ai and return its response
 *   3. Query params and request body are forwarded
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: mockAuth }));

// Mock global fetch used by the proxy helper
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClientSession() {
  return {
    user: { id: "user-1", email: "client@example.com", role: "client", companyId: 1 },
  };
}

function makeRequest(opts: { method?: string; body?: unknown; url?: string } = {}) {
  const url = opts.url ?? "http://localhost/api/portal/quotes";
  if (opts.body !== undefined) {
    return new Request(url, {
      method: opts.method ?? "POST",
      headers: { "Content-Type": "application/json", cookie: "next-auth.session-token=abc" },
      body: JSON.stringify(opts.body),
    });
  }
  return new Request(url, {
    method: opts.method ?? "GET",
    headers: { cookie: "next-auth.session-token=abc" },
  });
}

function upstreamResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// GET /api/portal/quotes
// ---------------------------------------------------------------------------

describe("GET /api/portal/quotes (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated (XVII-LLC gate)", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/quotes/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies GET to genthrust-ai and returns upstream response", async () => {
    mockAuth.mockResolvedValue(makeClientSession());
    const upstream = upstreamResponse(200, { data: [{ id: 1 }], total: 1 });
    mockFetch.mockResolvedValue(upstream);

    const { GET } = await import("@/app/api/portal/quotes/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/portal/quotes");
  });

  it("forwards query params to genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeClientSession());
    mockFetch.mockResolvedValue(upstreamResponse(200, { data: [], total: 0 }));

    const { GET } = await import("@/app/api/portal/quotes/route");
    const req = makeRequest({ url: "http://localhost/api/portal/quotes?page=2&limit=5" });
    await GET(req);

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("page=2");
    expect(String(url)).toContain("limit=5");
  });

  it("returns 502 when genthrust-ai is unreachable", async () => {
    mockAuth.mockResolvedValue(makeClientSession());
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const { GET } = await import("@/app/api/portal/quotes/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(502);
  });
});

// ---------------------------------------------------------------------------
// POST /api/portal/quotes
// ---------------------------------------------------------------------------

describe("POST /api/portal/quotes (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/portal/quotes/route");
    const res = await POST(
      makeRequest({ body: { line_items: [{ part_number: "PN-1", quantity: 1 }] } })
    );
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies POST with body to genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeClientSession());
    mockFetch.mockResolvedValue(upstreamResponse(201, { id: 42, status: "pending" }));

    const { POST } = await import("@/app/api/portal/quotes/route");
    const payload = { line_items: [{ part_number: "PN-001", quantity: 2 }] };
    const res = await POST(makeRequest({ body: payload }));

    expect(res.status).toBe(201);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/portal/quotes");
    expect(options.method).toBe("POST");
  });

  it("passes through 400 from genthrust-ai (validation error)", async () => {
    mockAuth.mockResolvedValue(makeClientSession());
    mockFetch.mockResolvedValue(
      upstreamResponse(400, { error: "line_items must be a non-empty array" })
    );

    const { POST } = await import("@/app/api/portal/quotes/route");
    const res = await POST(makeRequest({ body: {} }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/portal/quotes/[id]
// ---------------------------------------------------------------------------

describe("GET /api/portal/quotes/[id] (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/quotes/[id]/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies GET /quotes/:id to genthrust-ai with id in path", async () => {
    mockAuth.mockResolvedValue(makeClientSession());
    mockFetch.mockResolvedValue(upstreamResponse(200, { quote: { id: 7 }, lineItems: [] }));

    const { GET } = await import("@/app/api/portal/quotes/[id]/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "7" }) });
    expect(res.status).toBe(200);

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/portal/quotes/7");
  });

  it("passes through 404 from genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeClientSession());
    mockFetch.mockResolvedValue(upstreamResponse(404, { error: "Not found" }));

    const { GET } = await import("@/app/api/portal/quotes/[id]/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "9999" }) });
    expect(res.status).toBe(404);
  });
});
