/**
 * Shared proxy helper — forwards XVII-LLC portal requests to genthrust-ai.
 *
 * All portal API routes call proxyToGenthrust() instead of querying MySQL
 * directly. The caller's NextAuth session token is forwarded via Authorization
 * header so genthrust-ai can re-verify identity on its end.
 *
 * Environment variables:
 *   GENTHRUST_AI_URL  — base URL of the genthrust-ai app (no trailing slash)
 *                       e.g. "https://app.genthrust.org" or "http://localhost:3001"
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const GENTHRUST_AI_URL =
  process.env.GENTHRUST_AI_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

export interface ProxyOptions {
  /** Target path on genthrust-ai, including leading slash. e.g. "/api/portal/quotes" */
  path: string;
  /** Incoming request — used to forward method, body, and query params. */
  request: NextRequest | Request;
  /**
   * When true, the proxy forwards the raw request body without modification.
   * Required for POST/PUT routes. Defaults to false.
   */
  forwardBody?: boolean;
}

/**
 * Forward a portal API request to genthrust-ai and return its response verbatim.
 *
 * Auth flow:
 *   1. XVII-LLC validates the existing NextAuth session.
 *   2. The JWT token is forwarded to genthrust-ai via Authorization header.
 *   3. genthrust-ai re-validates the token using the shared AUTH_SECRET.
 *
 * Returns 401 if XVII-LLC's own session is absent (unauthenticated request).
 * All other error responses from genthrust-ai are passed through unchanged.
 */
export async function proxyToGenthrust({
  path,
  request,
  forwardBody = false,
}: ProxyOptions): Promise<NextResponse> {
  // 1. Validate session on XVII-LLC side before proxying.
  // Only 'client' role may access portal resources — internal/admin users
  // access genthrust-ai directly via FlightDeck SSO, not through this proxy.
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Build target URL, forwarding any query params from the original request
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(path, GENTHRUST_AI_URL);
  // Copy query params from the original request
  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  // 3. Build forwarded headers
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    // Forward the raw cookie so genthrust-ai's NextAuth can verify the session
    Cookie: (request.headers as Headers).get("cookie") ?? "",
  };

  // 4. Build fetch options
  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
    // Prevents Node from following redirects so we return them to the client
    redirect: "manual",
  };

  if (forwardBody && request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.text();
    if (body) {
      fetchOptions.body = body;
    }
  }

  // 5. Proxy the request
  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), fetchOptions);
  } catch (err) {
    console.error(
      "[api-proxy] fetch failed:",
      path,
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json({ error: "Upstream service unavailable" }, { status: 502 });
  }

  // 6. Stream upstream response back to the client verbatim
  const responseHeaders = new Headers();
  // Forward content-type so clients get the right MIME type
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

/**
 * Build the upstream path for a dynamic route segment.
 * Usage: buildPath('/api/portal/quotes', id) → '/api/portal/quotes/abc123'
 */
export function buildPath(base: string, ...segments: string[]): string {
  const cleaned = segments.map((s) => encodeURIComponent(s)).join("/");
  return `${base}/${cleaned}`;
}
