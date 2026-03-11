# Project Instructions for Claude

## Git Commits
- Never add "Co-Authored-By" lines to git commit messages

## Ecosystem Overview

**Genthrust XVII LLC** — aviation parts brokerage. This Next.js app is the public website, internal dashboard, and client portal.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, MySQL (mysql2/promise, no ORM), NextAuth 5 (Entra ID + Credentials), Three.js (@react-three/fiber)

**Project Root:** `C:\Users\calvi\Projects\Genthrust-XVII-LLC`

## Architecture & Data Flow

| Flow | Entry | Auth | Data Source |
|------|-------|------|-------------|
| **Public site** | `/` → parts search | None | `parts` table via LIKE queries |
| **Internal dashboard** | `/signin` → `/internal/*` | Microsoft Entra ID (`@genthrust.net`) | MySQL + ERP AERO API |
| **Client portal** | `/login` → `/portal/*` | Credentials (bcryptjs) | Company-scoped MySQL queries |
| **ERP sync** | Bot fleet + `/api/internal/sync/parts` | ERP AERO token | ERP AERO REST → MySQL cache |
| **Registration** | `/register` → `/api/register` | None | Creates inactive `portal_user`, admin activates via `/internal/clients` |

## Authentication System

**Two providers, one JWT session:**
- **Microsoft Entra ID** — internal staff, domain-checked to `@genthrust.net` in `auth.config.ts` `signIn` callback
- **Credentials** — portal clients, bcryptjs password verification, must have `is_active=1`

**Roles:** `'internal'` (Entra ID) | `'client'` (Credentials) — set in JWT callback based on `account.provider`

**Middleware** (`middleware.ts`) protects: `/internal/:path*`, `/portal/:path*`, `/signin`, `/login`, `/register`
- `/internal/*` → redirects unauthenticated to `/signin`
- `/portal/*` → redirects unauthenticated to `/login`
- `/signin` → redirects authenticated to `/internal`
- `/login` → redirects authenticated to `/portal`
- `/register` → redirects authenticated to role-appropriate dashboard

**Key files:** `auth.ts` (providers + NextAuth export), `auth.config.ts` (edge-safe callbacks), `middleware.ts`, `types/next-auth.d.ts` (Session/JWT type augmentation)

## Database

**Two MySQL databases:**

| DB | Port | Connection | File |
|----|------|------------|------|
| `genthrust` | 3307 (Docker) | `query()` | `lib/db.ts` |
| `genthrust_inventory` | 3306 (native) | `inventoryQuery()` | `lib/inventory-db.ts` |

Both use mysql2/promise pools with `connectionLimit: 10`.

### Schema Reference

| Table | Key Columns |
|-------|-------------|
| `parts` | erp_product_id, product_name, mfr_part_no, nsn_number, cage_code, hazmat, product_category |
| `companies` | company_name, (customer/supplier directory) |
| `portal_users` | email, password_hash, contact_name, company_id, erp_contact_id, is_active |
| `repair_orders` | ro_number, vendor_name, status, priority, due_date, total |
| `sales_orders` | so_number, customer_po, customer_name, status, total |
| `invoices` | invoice_no, account_name, status, due_date, open_balance |
| `quotes` | Quote records |
| `rfqs` | Request for quote records |
| `documents` | Document metadata |
| `catalog_items` | Catalog entries |

## MCP Servers (Project-Scoped via `.mcp.json`)

| Server | Purpose |
|--------|---------|
| `microsoft-365` | Email, calendar, OneDrive, SharePoint via MS Graph API |
| `mysql` | Read-only access to the `genthrust` database (port 3307) |
| `genthrust-bots` | Bot fleet monitoring — statuses, logs, metrics, inventory |
| `genthrust-automation` | ERP AERO API — repair orders, purchase orders, NET30 reminders |
| `sequential-thinking` | Structured multi-step reasoning |
| `filesystem` | File read/write across Genthrust projects |
| `fetch` | HTTP requests to external APIs |

## Bot Fleet

5 Python bots running as Windows services, monitored via `sc query` in `lib/bot-helpers.ts`. Logs at `C:\GenthrustBot\logs\`.

| Bot | Service Name | Function |
|-----|-------------|----------|
| ILS Sniper | GT-ILS-Bot | Monitors ILS marketplaces, auto-generates quote drafts |
| Internal Auditor | GT-Internal-Bot | 8130-3 compliance reports, VIP customer alerts |
| OneDrive Sync | GT-Sync-Bot | Syncs inventory with OneDrive and ERP AERO cache |
| AOG Monitor | GT-AOG-Bot | Monitors AOG requests, sends Teams alerts |
| Inventory Intelligence | GT-Inventory-Bot | Tracks sales velocity, stock alerts, condition monitoring |

Bot metrics extracted via regex from log files (`getBotMetrics()`). Notifications aggregated across all bots (`getNotificationFeed()`).

## ERP AERO Integration

- **Base URL:** `https://wapi.erp.aero`
- **Auth:** POST `/v1/auth/signin` with form-encoded cid/email/password → token cached in memory (`lib/erp-aero.ts`)
- **Token refresh:** On 401, clears cached token and retries once via `erpFetch()`
- **Functions:** `getPartsList(page, pageSize)`, `getPartDetails(productId)`, `clearTokenCache()`
- **Sync endpoint:** `/api/internal/sync/parts` pulls parts into MySQL `parts` table
- **Automation:** NET30 payment reminders, RO digests via `genthrust-automation` MCP server

## API Routes

### Public (no auth)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handler |
| `/api/contact` | POST | Contact form (logs only — email NOT implemented, TODO: Resend/SendGrid) |
| `/api/search` | GET | Parts search (`?q=`) — LIKE queries on parts table |
| `/api/clients` | GET | Public client listing |
| `/api/register` | POST | Create inactive portal user |
| `/api/register/companies` | GET | Company list for registration dropdown |

### Internal (requires `role: 'internal'`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/internal/dashboard` | GET | Dashboard stats (uses `safeCount()`/`safeQuery()` wrappers) |
| `/api/internal/clients` | GET/POST/PUT/DELETE | Client CRUD + portal user activation |
| `/api/internal/invoices` | GET | Invoice list |
| `/api/internal/invoices/[id]` | GET | Invoice detail |
| `/api/internal/repair-orders` | GET | Repair order list |
| `/api/internal/repair-orders/[id]` | GET | Repair order detail |
| `/api/internal/sales-orders` | GET | Sales order list |
| `/api/internal/sales-orders/[id]` | GET | Sales order detail |
| `/api/internal/bots` | GET | Bot fleet statuses |
| `/api/internal/bots/logs` | GET | Bot log tails |
| `/api/internal/bots/restart` | POST | Restart a bot service |
| `/api/internal/bots/inventory` | GET | Bot inventory data (uses `safeQuery()`) |
| `/api/internal/automation` | GET | Automation data |
| `/api/internal/automation/preview` | GET | Automation preview |
| `/api/internal/inventory-intelligence` | GET | Inventory analytics (uses `safeQuery()`) |
| `/api/internal/inventory-intelligence/search` | GET | Inventory search |
| `/api/internal/sync/parts` | POST | Pull parts from ERP AERO into MySQL |

### Portal (requires `role: 'client'`, company-scoped)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/portal/dashboard` | GET | Client dashboard |
| `/api/portal/invoices/[id]` | GET | Client's invoice |
| `/api/portal/repair-orders/[id]` | GET | Client's repair order |
| `/api/portal/sales-orders/[id]` | GET | Client's sales order |

### Other
| Route | Purpose |
|-------|---------|
| `/api/admin/create-client` | Admin client creation |

## Component Patterns

**Layout:** `Navbar`, `Footer`, `InternalNav` (sidebar for `/internal/*`)

**UI Primitives:** `Button`, `GlassCard` (glass-morphism with backdrop-blur), `Dialog`, `Modal`, `Dropdown`, `SearchInput`, `ProgressBar`

**Animation:** `AnimatedCounter`, `BorderBeam` (4s linear infinite), `DataPing`, `AnamorphicFlare`, `MagneticButton`, `ParticleBackground`

**3D:** `ParticleVertexAircraft` / `AircraftParticles` (Three.js via @react-three/fiber)

**Page Sections:** `HeroSection`, `SearchSection`, `CredentialsSection`, `FeaturedInventory`, `ContactSection`, `ServicesBento`, `BentoInventoryGrid`, `StatsBar`

## Theme Reference

From `tailwind.config.js`:

**Colors:** Navy `#1e4a8d` (primary), Burgundy `#9c2a3e` (secondary) — both have full 50-900 scales

**Status:** available `#059669`, limited `#d97706`, aog `#dc2626`

**Accent:** space `#020617`, aviation-red `#EF4444`, horizon-blue `#38B2AC`, silver `#F8FAFC`

**Fonts:** Inter (sans), JetBrains Mono (mono)

**Animations:** fade-in, fade-in-up, pulse-subtle, border-beam, scan-sweep, data-ping, horizon-drift

**Shadows:** card, card-hover, navy-focus

## Key Patterns & Gotchas

- **No ORM** — all database access is raw SQL via `query()` from `lib/db.ts` and `inventoryQuery()` from `lib/inventory-db.ts`
- **Inventory DB is separate** — `genthrust_inventory` on port 3306 (native MySQL), `genthrust` on port 3307 (Docker)
- **ERP AERO token caching** — `lib/erp-aero.ts` caches auth token in module-level variable, auto-refreshes on 401
- **Contact email NOT implemented** — `/api/contact` only logs, has TODO for Resend/SendGrid
- **Portal users start inactive** — `/api/register` creates `is_active=0`, admin must activate via `/internal/clients`
- **Bot status via `sc query`** — `lib/bot-helpers.ts` runs Windows `sc query` to check service state
- **Dashboard safe wrappers** — `safeCount()` / `safeQuery()` return 0/[] on DB errors (used in dashboard, bots/inventory, inventory-intelligence)
- **FeaturedInventory hardcoded** — uses sample data from `lib/constants.ts`, not live DB
- **No rate limiting** on API endpoints
- **Edge-compatible auth** — `auth.config.ts` has no Node.js-only imports (runs in middleware edge runtime)

## Key Directories

| Path | What |
|------|------|
| `C:\Users\calvi\Projects\Genthrust-XVII-LLC` | This project (Next.js app) |
| `C:\GenthrustBot` | Python bot fleet (5 bots as Windows services) |
| `C:\GenThrust\automation` | Python NET30 reminders, RO digest, ERP client |
| `C:\Users\GEN_AI\mcp-servers\ms365` | Microsoft 365 MCP server |

## Common Tasks

- **Add a new page** → `app/[route]/page.tsx`, add to `NAV_LINKS` in `lib/constants.ts`
- **Add an internal page** → `app/internal/[route]/page.tsx`, add nav link in `InternalNav`
- **Add a new API route** → `app/api/internal/[name]/route.ts`, add auth session check
- **Add a new bot** → add entry to `BOT_REGISTRY` in `lib/bot-helpers.ts`
- **Modify DB schema** → update table, update queries in `lib/db.ts` callers, update types in `types/`
- **Sync ERP data** → use `/api/internal/sync/parts` or add new sync endpoint in `app/api/internal/sync/`

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
```
