# Authentication — Genthrust XVII LLC

## Two Providers, One JWT Session

- **Microsoft Entra ID** — internal staff, domain-checked to `@genthrust.net` in `auth.config.ts` `signIn` callback
- **Credentials** — portal clients, bcryptjs password verification, must have `is_active=1`

**Roles:** `'internal'` (Entra ID) | `'client'` (Credentials) — set in JWT callback based on `account.provider`

## Middleware (`middleware.ts`)

Protects: `/internal/:path*`, `/portal/:path*`, `/signin`, `/login`, `/register`
- `/internal/*` → redirects unauthenticated to `/signin`
- `/portal/*` → redirects unauthenticated to `/login`
- `/signin` → redirects authenticated to `/internal`
- `/login` → redirects authenticated to `/portal`
- `/register` → redirects authenticated to role-appropriate dashboard

## MFA (Client Portal)

- **Implementation:** `lib/mfa.ts` — TOTP via `otpauth`, secrets encrypted with AES-256-GCM (`MFA_ENCRYPTION_KEY` env var)
- **Recovery codes:** 10 codes, bcrypt hashed, marked used on redemption
- **Mandatory** for all client users — enforced in `auth.config.ts` callback, redirects to `/portal/mfa-setup`
- **Two-step login:** POST `/api/auth/verify-credentials` → `mfaToken` (10-min JWT) → POST to NextAuth with TOTP code
- **Rate limited:** 5 attempts per 60 seconds per IP on verify-credentials

## Audit Logging

`lib/audit-logger.ts` — logs access events to DB, viewable at `/api/internal/audit-log`

## Key Files

- `auth.ts` (providers + NextAuth export)
- `auth.config.ts` (edge-safe callbacks — no Node.js-only imports)
- `middleware.ts`
- `types/next-auth.d.ts` (Session/JWT type augmentation)
- `lib/mfa.ts` (TOTP + encryption)
