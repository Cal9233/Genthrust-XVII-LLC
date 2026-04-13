# Database Reference — Genthrust XVII LLC

> genthrust-ai owns the canonical database (PostgreSQL). XVII-LLC retains read-write access to two MySQL connections for the bot bridge and Excel sync features.

## Two MySQL Databases

| DB | Port | Connection | File |
|----|------|------------|------|
| `genthrust` | 3307 (Docker) | `query()` / Drizzle | `lib/db.ts`, `lib/db/index.ts` |
| `genthrust_inventory` | 3306 (native) | `inventoryQuery()` | `lib/inventory-db.ts` |

**Note:** `lib/db.ts` accepts either `DB_HOST` or `DATABASE_HOST` as a fallback — use `DB_HOST` as primary.

## genthrust DB (port 3307) — Used Tables

Only two table groups are actively used in this project:

| Table | Used By | Key Columns |
|-------|---------|-------------|
| `active` | Excel sync tasks | ro, status, vendor, part details for SharePoint write-back |
| `accounts` | `lib/graph/index.ts` | access_token, refresh_token, expires_at — Microsoft OAuth tokens per user |

Drizzle ORM wraps the main pool via `lib/db/index.ts` with schema from `lib/db/schema.ts`. The schema contains additional tables (users, sessions, repair_orders, etc.) that are remnants of the full-stack era — they are not actively queried.

## genthrust_inventory DB (port 3306)

Read by `/api/internal/bots/inventory` via `lib/inventory-db.ts`.

| Table | Purpose |
|-------|---------|
| `inventoryindex` | Part inventory snapshot from bot fleet |
| `shops` | Repair shop directory |
| `ils_pending_quotes` | ILS bot pending quotes |
| `sales_velocity` | Sales velocity data |
| `inventory_watchlist` | User watchlists |
| `inventory_alerts` | Stock level alerts |

## Access Pattern

- **Raw SQL:** `query()` from `lib/db.ts` — used by `lib/audit-logger.ts` and direct DB access
- **Drizzle ORM:** `db` from `lib/db/index.ts` — used by Excel sync tasks (`active` table)
- **Graph OAuth tokens:** `lib/graph/index.ts` reads the `accounts` table to get/refresh per-user Microsoft tokens for Excel operations
