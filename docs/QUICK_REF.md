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
| Add a new page | `app/[route]/page.tsx`, add to `NAV_LINKS` in `lib/constants.ts` |
| Add internal page | `app/internal/[route]/page.tsx`, add nav link in `InternalNav` |
| Add API route | `app/api/internal/[name]/route.ts`, add auth session check |
| Add a new bot | Entry in `BOT_REGISTRY` in `lib/bot-helpers.ts` |
| Modify DB schema | Update table, update queries in `lib/db.ts` callers, update types in `types/` |
| Sync ERP data | POST `/api/internal/sync/parts` or add new sync in `app/api/internal/sync/` |

## Key Patterns & Gotchas

- **Dual DB access** — raw SQL via `query()` from `lib/db.ts` AND Drizzle ORM via `lib/db/index.ts`. Both use same pool.
- **Inventory DB is separate** — `genthrust_inventory` on port 3306 (native), `genthrust` on port 3307 (Docker)
- **ERP AERO token caching** — `lib/erp-aero.ts` caches auth token in module-level variable, auto-refreshes on 401
- **Contact email NOT implemented** — `/api/contact` only logs, has TODO for Resend/SendGrid
- **Portal users start inactive** — `/api/register` creates `is_active=0`, admin must activate via `/internal/clients`
- **Bot status via `sc query`** — `lib/bot-helpers.ts` runs Windows `sc query` to check service state
- **Dashboard safe wrappers** — `safeCount()` / `safeQuery()` return 0/[] on DB errors
- **FeaturedInventory hardcoded** — uses sample data from `lib/constants.ts`, not live DB
- **Rate limiting** on login (5/60s), register (3/hr), inventory search (20/60s) — other endpoints unprotected
- **Edge-compatible auth** — `auth.config.ts` has no Node.js-only imports (runs in middleware edge runtime)

## Environment Variables

```
# Auth
AUTH_SECRET, AUTH_URL
AUTH_MICROSOFT_ENTRA_ID_ID, AUTH_MICROSOFT_ENTRA_ID_SECRET, AUTH_MICROSOFT_ENTRA_ID_ISSUER

# Main DB (genthrust, Docker port 3307)
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

# Inventory DB (genthrust_inventory, native port 3306)
BOT_DB_HOST, BOT_DB_PORT, BOT_DB_NAME, BOT_DB_USER, BOT_DB_PASSWORD

# ERP AERO
ERP_AERO_BASE_URL, ERP_AERO_EMAIL, ERP_AERO_PASSWORD, ERP_AERO_CID

# MFA
MFA_ENCRYPTION_KEY (AES-256-GCM, 32-byte hex)

# MCP
MCP_API_KEY (bearer token for MCP endpoint)
MCP_ALLOW_UNAUTHENTICATED (true to allow unauthenticated MCP access)
```
