import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import { generateNonce, buildCspHeader } from "./lib/csp";

export default NextAuth(authConfig).auth(function middleware(req) {
  const { pathname } = req.nextUrl;
  const isProtectedApi = pathname.startsWith("/api/internal");

  const nonce = generateNonce();
  const csp = buildCspHeader(nonce);

  // For unauthenticated API route requests, return 401 JSON
  if (!req.auth && isProtectedApi) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  // Pass nonce to layout.tsx via x-nonce header so Next.js can stamp it on hydration scripts
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
});

// Run middleware on ALL routes except static assets and Next.js internals.
// This ensures every page gets a CSP nonce, not just protected routes.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|GenLogoTab\\.png|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
  ],
};
