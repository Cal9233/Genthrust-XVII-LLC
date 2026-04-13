# API Reference — Genthrust XVII LLC

> This project has 6 active API routes. All backend business logic (portal, invoices, repair orders, etc.) is in **genthrust-ai**.

## Public (no auth)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handler (Entra ID provider only) |
| `/api/contact` | POST | Contact form — sends via Resend if `RESEND_API_KEY` set, else logs |

## Internal (requires `role: 'internal'` or `role: 'admin'`)

These routes are called by genthrust-ai via **Cloudflare Tunnel** using a bearer token, not browser sessions.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/internal/bots` | GET | Bot fleet statuses (sc query on all 5 services) |
| `/api/internal/bots/inventory` | GET | Bot inventory data from `genthrust_inventory` DB |
| `/api/internal/bots/logs` | GET | Bot log tails |
| `/api/internal/bots/restart` | POST | Restart a bot Windows service |
| `/api/internal/sso/flightdeck` | GET | SSO redirect — generates signed JWT, redirects to genthrust-ai |

### Bot Route Auth Note

The Cloudflare Tunnel calls these routes from genthrust-ai's server. The tunnel request includes a bearer token checked against `BOT_BRIDGE_SECRET`. The routes also call `auth()` for session-based access by staff.

### SSO Flow

1. Staff clicks Login → `/api/auth/signin/microsoft-entra-id?callbackUrl=/api/internal/sso/flightdeck`
2. Entra ID authenticates the user
3. NextAuth sets JWT with `role: 'internal'` or `role: 'admin'`
4. NextAuth calls the `callbackUrl` → `/api/internal/sso/flightdeck`
5. Route generates HMAC-SHA256 signed token via `lib/sso-redirect.ts`
6. Redirects to genthrust-ai `/api/auth/sso-redirect?token=...`
7. genthrust-ai verifies the token and creates a session
