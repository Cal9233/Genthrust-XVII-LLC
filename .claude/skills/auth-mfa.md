---
description: Working with authentication, MFA, sessions, or NextAuth configuration
globs: ["auth.ts", "auth.config.ts", "middleware.ts", "lib/mfa.ts", "app/api/auth/**", "app/api/portal/mfa/**", "types/next-auth.d.ts"]
---

Load @docs/AUTH.md for full auth architecture.

Key files:
- @auth.ts — Full NextAuth config with Entra ID + credentials providers (Node.js runtime only)
- @auth.config.ts — Edge-safe callbacks (NO Node.js imports — runs in middleware edge runtime)
- @middleware.ts — CSP nonces + route protection
- @lib/mfa.ts — TOTP via otpauth, AES-256-GCM secret encryption, recovery codes

Critical: auth.config.ts must never import Node.js-only modules (mysql2, bcrypt, etc).
All DB access for auth happens in auth.ts authorize() callback, never in auth.config.ts.

MFA flow: POST /api/auth/verify-credentials → mfaToken (5-min JWT) → POST NextAuth with totpCode.
Role determination: credentials provider → role from DB; Entra ID → role by email domain.
