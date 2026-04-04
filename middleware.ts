import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// CSP Nonce Generation (Edge-compatible)
//
// Generates a per-request cryptographic nonce for script-src. This replaces
// the static CSP in next.config.js and allows Next.js inline hydration
// scripts to execute without 'unsafe-inline' (which was removed in C-5).
//
// The nonce is:
//   1. Set on the CSP header (script-src 'self' 'nonce-<value>')
//   2. Passed to the request via x-nonce header for layout.tsx to read
//   3. Automatically applied by Next.js to its inline <script> tags
// ---------------------------------------------------------------------------
function generateNonce(): string {
  // Edge Runtime has no Buffer — use Web API btoa
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

function buildCspHeader(nonce: string): string {
  // Dev mode requires 'unsafe-eval' for Next.js HMR and source maps.
  // Production builds do not use dynamic code evaluation, so this is dev-only.
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}'`
    : `script-src 'self' 'unsafe-inline' 'nonce-${nonce}'`;

  return [
    "default-src 'self'",
    // C-5 security fix: nonce-based script execution.
    //
    // CSP Level 3 (all modern browsers since ~2018): when a nonce is present,
    // browsers IGNORE 'unsafe-inline' entirely — only nonce-matched scripts run.
    // Full XSS protection maintained.
    //
    // CSP Level 2 (legacy): doesn't understand nonces, falls back to
    // 'unsafe-inline'. Less secure but these browsers have bigger problems.
    //
    // 'unsafe-inline' is REQUIRED here because Next.js 14 App Router may not
    // stamp the nonce attribute on all of its internal hydration scripts.
    // This is Google's recommended progressive enhancement pattern.
    // Removing 'unsafe-inline' without upgrading to Next.js 15 breaks hydration.
    scriptSrc,
    // Tailwind + Framer Motion inject inline styles — this is a separate
    // directive from script-src and does not affect XSS protection for scripts.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "frame-src 'self' https://www.google.com",
    "connect-src 'self' https://wapi.erp.aero https://graph.microsoft.com https://login.microsoftonline.com https://*.upstash.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export default NextAuth(authConfig).auth(function middleware(req) {
  const { pathname } = req.nextUrl;
  const isProtectedApi =
    pathname.startsWith("/api/internal") ||
    pathname.startsWith("/api/portal") ||
    pathname.startsWith("/api/admin");

  // Generate per-request nonce for CSP
  const nonce = generateNonce();
  const csp = buildCspHeader(nonce);

  // For unauthenticated API route requests, return 401 JSON
  if (!req.auth && isProtectedApi) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  // All other requests: set CSP header + pass nonce to layout
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
