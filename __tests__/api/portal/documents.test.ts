/**
 * Tests for portal documents proxy routes.
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

function makeRequest(url = "http://localhost/api/portal/documents") {
  return new Request(url, { headers: { cookie: "session=abc" } });
}

function upstream(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/portal/documents (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/documents/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies GET to /api/portal/documents on genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockResolvedValue(upstream(200, { documents: [] }));

    const { GET } = await import("@/app/api/portal/documents/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/portal/documents");
  });

  it("forwards type query param to genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockResolvedValue(upstream(200, { documents: [] }));

    const { GET } = await import("@/app/api/portal/documents/route");
    await GET(makeRequest("http://localhost/api/portal/documents?type=invoice"));

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("type=invoice");
  });

  it("returns 502 when genthrust-ai is unreachable", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const { GET } = await import("@/app/api/portal/documents/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(502);
  });
});

describe("GET /api/portal/documents/[id]/download (proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/portal/documents/[id]/download/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies GET /documents/:id/download with id in path", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ name: "doc.pdf", type: "invoice", file_path: "/files/doc.pdf" }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-disposition": 'attachment; filename="doc.pdf"',
          },
        }
      )
    );

    const { GET } = await import("@/app/api/portal/documents/[id]/download/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "8" }) });
    expect(res.status).toBe(200);

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/portal/documents/8/download");
  });

  it("passes through 404 from genthrust-ai", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFetch.mockResolvedValue(upstream(404, { error: "Not found" }));

    const { GET } = await import("@/app/api/portal/documents/[id]/download/route");
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "9999" }) });
    expect(res.status).toBe(404);
  });
});
