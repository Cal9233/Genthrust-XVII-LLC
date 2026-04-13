# Authentication — Genthrust XVII LLC

## Entra ID Only

Auth is **Microsoft Entra ID** (Azure AD) only. There is no credentials/password login in this project — the client portal has been migrated to genthrust-ai.

- **Provider:** `MicrosoftEntraID` in `auth.ts`
- **Allowed domain:** `@genthrust.net` — enforced in `signIn` callback in `auth.config.ts`
- **Roles:** `admin` (cmalagon@genthrust.net) | `internal` (all other @genthrust.net) — set in JWT callback by email
- **Session strategy:** JWT

## Middleware (`middleware.ts`)

- Generates a per-request CSP nonce for all routes
- Returns `401 JSON` for unauthenticated requests to `/api/internal/*`
- All marketing pages are public (no auth required)

## Login Flow (SSO to FlightDeck)

```
Staff clicks Login
  → /api/auth/signin/microsoft-entra-id?callbackUrl=/api/internal/sso/flightdeck
  → Microsoft Entra ID authenticates
  → JWT set with role (admin or internal)
  → /api/internal/sso/flightdeck called as callbackUrl
  → lib/sso-redirect.ts generates HMAC-SHA256 signed JWT (SSO_REDIRECT_SECRET)
  → Redirect to genthrust-ai /api/auth/sso-redirect?token=...
  → genthrust-ai verifies token, creates session
```

## Key Files

- `auth.ts` — NextAuth config (Entra ID provider + JWT/session callbacks)
- `auth.config.ts` — Edge-safe config (signIn callback, authorized callback)
- `middleware.ts` — CSP nonces + /api/internal auth guard
- `lib/sso-redirect.ts` — SSO token generator
- `types/next-auth.d.ts` — Session/JWT type augmentation
- `app/api/internal/sso/flightdeck/route.ts` — SSO redirect handler

## Bot Route Auth

`/api/internal/bots/**` routes are protected by `auth()` (session required). genthrust-ai calls them from the server via Cloudflare Tunnel. The tunnel adds a bearer token that these routes verify against `BOT_BRIDGE_SECRET`.
