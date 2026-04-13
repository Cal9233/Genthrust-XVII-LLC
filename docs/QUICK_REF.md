# Quick Reference — Genthrust XVII LLC

## Essential Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (localhost:3000) |
| `npm run build` | Production build |
| `npm test` | Run test suite |
| `docker compose up -d` | Start MySQL (port 3307) |

## Common Tasks

| Task | How |
|------|-----|
| Add a marketing page | `app/[route]/page.tsx`, add to `NAV_LINKS` in `lib/constants.ts` |
| Add API route | `app/api/internal/[name]/route.ts`, add auth session check |
| Update nav links | `lib/constants.ts` → `NAV_LINKS` array |
| Update contact info | `lib/constants.ts` → `CONTACT_INFO` |
| Modify Excel sync | `trigger/excel-sync.ts`, `lib/graph/excel-mapping.ts` |

## Key Patterns & Gotchas

- **Two MySQL connections** — `genthrust` on port 3307 (Docker), `genthrust_inventory` on 3306 (native)
- **DB_HOST vs DATABASE_HOST** — `lib/db.ts` accepts both; use `DB_HOST` as primary
- **Excel sync uses per-user OAuth** — `lib/graph/index.ts` reads the `accounts` table for the user's Microsoft token
- **Bot routes called by genthrust-ai** — they're server-to-server via Cloudflare Tunnel, not browser sessions
- **SSO redirect secret** — `SSO_REDIRECT_SECRET` must match between this app and genthrust-ai exactly
- **Rate limiting** on contact form — other endpoints unprotected
- **Edge-compatible auth** — `auth.config.ts` has no Node.js-only imports (runs in middleware edge runtime)

## Environment Variables

```
# Auth
AUTH_SECRET, AUTH_URL
AUTH_MICROSOFT_ENTRA_ID_ID, AUTH_MICROSOFT_ENTRA_ID_SECRET, AUTH_MICROSOFT_ENTRA_ID_ISSUER
ENTRA_TENANT_ID (must match tenant in AUTH_MICROSOFT_ENTRA_ID_ISSUER)

# Main DB (genthrust, Docker port 3307)
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

# Inventory DB (genthrust_inventory, native port 3306)
BOT_DB_HOST, BOT_DB_PORT, BOT_DB_NAME, BOT_DB_USER, BOT_DB_PASSWORD

# SSO redirect to FlightDeck (genthrust-ai)
SSO_REDIRECT_SECRET (32-byte hex — must match genthrust-ai)
NEXT_PUBLIC_FLIGHTDECK_URL (base URL of genthrust-ai app)

# Excel sync (Trigger.dev tasks)
EXCEL_WORKBOOK_ID (SharePoint Excel workbook ID)
TRIGGER_SECRET_KEY

# Microsoft Graph / Monitor App (mTLS cert auth)
MONITOR_APP_CLIENT_ID, MONITOR_APP_TENANT_ID
MONITOR_APP_CERT_THUMBPRINT, MONITOR_APP_CERT_PEM (base64-encoded PEM private key)

# Bot bridge (Cloudflare Tunnel from genthrust-ai)
BOT_BRIDGE_SECRET

# Rate limiting (optional — falls back to in-memory)
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

# Email (optional — falls back to console.log)
RESEND_API_KEY

# MCP
MCP_API_KEY (bearer token for MCP endpoint — required)
```
