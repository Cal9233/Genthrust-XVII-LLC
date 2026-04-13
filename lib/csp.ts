// Dev mode requires 'unsafe-eval' for Next.js HMR and source maps.
// Production builds do not use dynamic code evaluation, so this is dev-only.
const isDev = process.env.NODE_ENV === "development";

export function generateNonce(): string {
  // Edge Runtime has no Buffer — use Web API btoa with Array.from mapper
  return btoa(
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      String.fromCharCode(b)
    ).join("")
  );
}

export function buildCspHeader(nonce: string): string {
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}'`
    : `script-src 'self' 'unsafe-inline' 'nonce-${nonce}'`;

  return [
    "default-src 'self'",
    // 'unsafe-inline' must coexist with the nonce: Next.js 14 App Router does not
    // stamp nonces on all internal hydration scripts, so removing it breaks hydration.
    // CSP Level 3 browsers ignore 'unsafe-inline' when a nonce is present (full XSS
    // protection); CSP Level 2 legacy browsers fall back to 'unsafe-inline'.
    scriptSrc,
    // Tailwind + Framer Motion inject inline styles — separate directive from script-src.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "frame-src 'self' https://www.google.com",
    "connect-src 'self' https://graph.microsoft.com https://login.microsoftonline.com https://*.upstash.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
