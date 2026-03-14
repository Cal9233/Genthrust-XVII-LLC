# GENTHRUST XVII LLC — Platform Documentation

> **Version:** 1.0.0
> **Generated:** 2026-03-11
> **Platform:** Next.js 14 + TypeScript + MySQL
> **Domain:** Aviation Parts Brokerage

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Public Website](#4-public-website)
5. [Internal Dashboard](#5-internal-dashboard)
6. [Client Portal](#6-client-portal)
7. [API Reference](#7-api-reference)
8. [Internal Tools (Deep Dive)](#8-internal-tools-deep-dive)
9. [MCP Servers](#9-mcp-servers)
10. [Component Library](#10-component-library)
11. [Database Schema](#11-database-schema)
12. [Design System](#12-design-system)
13. [Environment Variables](#13-environment-variables)
14. [Key Files Reference](#14-key-files-reference)

---

## 1. Project Overview

### Purpose

GENTHRUST XVII LLC is an aviation parts brokerage platform based in Miami, Florida. The website serves three audiences:

- **Public visitors** — browse inventory, request quotes, learn about services
- **Internal team** (`@genthrust.net`) — manage operations, monitor bots, track orders/invoices, run automation
- **Client companies** — view their sales orders, repair orders, invoices, and manage MFA

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.x |
| Language | TypeScript | 5.9.x |
| React | React + React DOM | 18.3.x |
| Auth | NextAuth.js (Auth.js v5 beta) | 5.0.0-beta.30 |
| Database | MySQL via mysql2/promise | 3.16.x |
| Styling | Tailwind CSS | 3.4.x |
| Animation | Framer Motion | 12.23.x |
| 3D Graphics | Three.js + React Three Fiber + Drei | 0.160 / 8.15 / 9.92 |
| Charts | Recharts | 3.8.x |
| Icons | Lucide React | 0.562.x |
| Validation | Zod | 3.25.x |
| Password Hashing | bcryptjs | 3.0.x |
| OTP/MFA | otpauth + qrcode | 9.5 / 1.5 |
| MCP Servers | Python (stdio transport) | 3.x |
| ERP Integration | ERP AERO REST API | v1 |

### Directory Structure

```
Genthrust-XVII-LLC/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page
│   ├── login/                    # Client portal login
│   ├── register/                 # Client self-registration
│   ├── signin/                   # Internal team (Entra ID) login
│   ├── internal/                 # Internal dashboard pages
│   │   ├── page.tsx              # Dashboard overview
│   │   ├── bots/                 # Bot fleet monitoring
│   │   ├── automation/           # ERP automation
│   │   ├── clients/              # Client management
│   │   ├── inventory-alarms/     # Watchlist & alarms
│   │   ├── inventory-intelligence/ # Inventory analytics
│   │   ├── invoices/             # Invoice management
│   │   ├── repair-orders/        # RO management
│   │   └── sales-orders/         # SO management
│   ├── portal/                   # Client portal pages
│   │   ├── page.tsx              # Portal dashboard
│   │   ├── mfa-setup/            # MFA enrollment
│   │   ├── settings/             # Account settings
│   │   ├── invoices/[id]/        # Invoice detail
│   │   ├── repair-orders/[id]/   # RO detail
│   │   └── sales-orders/[id]/    # SO detail
│   └── api/                      # API routes (44 endpoints)
│       ├── auth/                 # NextAuth + credential verify
│       ├── admin/                # Admin operations
│       ├── contact/              # Contact form
│       ├── search/               # Public parts search
│       ├── register/             # Registration + company lookup
│       ├── clients/              # Client creation
│       ├── mcp/                  # MCP HTTP endpoint
│       ├── internal/             # Internal-only APIs
│       └── portal/               # Portal-scoped APIs
├── components/
│   ├── Hero/                     # Hero intro animation (3 files)
│   ├── ParticleVertexAircraft/   # 3D particle system (4 files)
│   ├── sections/                 # Landing page sections (7 files)
│   ├── layout/                   # Navbar + Footer
│   ├── ui/                       # Reusable UI primitives (15+ files)
│   ├── internal/                 # Internal dashboard components (4 files)
│   └── portal/                   # MFA components (2 files)
├── lib/                          # Shared utilities
│   ├── db.ts                     # Primary DB pool (genthrust)
│   ├── inventory-db.ts           # Bot DB pool (genthrust_inventory)
│   ├── erp-aero.ts               # ERP AERO basic client
│   ├── erp-client.ts             # ERP AERO production client (TTL tokens)
│   ├── bot-helpers.ts            # Bot fleet management
│   ├── mfa.ts                    # TOTP + AES-256-GCM encryption
│   ├── password.ts               # bcrypt hashing
│   ├── animations.ts             # Framer Motion variants
│   ├── constants.ts              # Company info, nav, services, stats
│   └── utils.ts                  # cn() Tailwind class merger
├── types/                        # TypeScript definitions
│   ├── automation.ts             # Net30Order, FollowupRO, etc.
│   ├── inventory.ts              # Part, CatalogItem, DashboardStats
│   ├── next-auth.d.ts            # Session/JWT augmentation
│   └── three-jsx.d.ts            # R3F JSX elements
├── scripts/                      # Migrations & utilities
│   ├── create-clients-table.sql
│   ├── mfa-migration.sql
│   ├── inventory-watchlist-migration.sql
│   └── sync-parts.ts             # ERP → MySQL parts sync
├── mcp-servers/                   # Custom MCP servers (Python)
│   ├── genthrust-bots/server.py  # Bot management (8 tools)
│   └── genthrust-automation/server.py # Automation (8 tools)
├── public/                        # Static assets
│   └── models/                    # 3D models
├── assets/                        # Logo images
├── auth.ts                        # NextAuth configuration
├── auth.config.ts                 # Auth providers + callbacks
├── middleware.ts                  # Route protection
├── tailwind.config.js             # Design system
├── .mcp.json                      # MCP server registry
└── .env.local                     # Environment variables
```

---

## 2. Architecture

### Two-Database Design

```
┌─────────────────────────────┐     ┌────────────────────────────────┐
│    genthrust (Port 3307)    │     │ genthrust_inventory (Port 3306)│
│    Docker MySQL             │     │ Native MySQL                   │
├─────────────────────────────┤     ├────────────────────────────────┤
│ portal_users                │     │ inventory                      │
│ companies                   │     │ inventory_committed            │
│ mfa_factors                 │     │ inventory_watchlist             │
│ mfa_recovery_codes          │     │ inventory_alerts               │
│ parts (ERP cache)           │     │ ils_pending_quotes             │
│ repair_orders               │     │ sales_velocity                 │
│ repair_order_lines          │     └────────────────────────────────┘
│ sales_orders                │
│ sales_order_lines           │
│ invoices                    │
│ invoice_lines               │
│ quotes                      │
│ rfqs                        │
│ documents                   │
│ catalog_items               │
│ clients                     │
└─────────────────────────────┘
```

- **genthrust** — Primary portal database. Holds user accounts, ERP-synced order/invoice caches, parts catalog, companies. Accessed via `lib/db.ts`.
- **genthrust_inventory** — Bot operations database. Holds live inventory snapshots, watchlists, alerts, sales velocity data. Accessed via `lib/inventory-db.ts`.

### ERP AERO Integration

```
Next.js App  ──→  lib/erp-client.ts  ──→  https://wapi.erp.aero/v1/*
                  (30-min token TTL)       (REST API)
                  (401 auto-retry)
```

The app connects to ERP AERO for live data (parts search, repair orders, purchase orders). Cached data is synced into MySQL via `scripts/sync-parts.ts` for fast search.

### Request Flow

```
Browser  ──→  Next.js Middleware (auth check)
              ├── Public routes → Allow
              ├── /internal/* → Require session + role=internal
              ├── /portal/* → Require session + MFA check
              └── /login, /signin, /register → Redirect if logged in

         ──→  API Route Handler
              ├── Session validation (getServerSession)
              ├── Role check (internal vs client)
              ├── Company-scoped filtering (portal)
              └── Database query / ERP API call
```

---

## 3. Authentication & Authorization

### Dual-Provider System

| Provider | Users | Login Path | Role |
|----------|-------|-----------|------|
| Microsoft Entra ID (OAuth) | `@genthrust.net` employees | `/signin` | `internal` |
| Credentials (email + password) | Client companies | `/login` | `client` |

### Internal Auth (Entra ID)

1. User clicks "Sign in with Microsoft" at `/signin`
2. Redirected to Microsoft Entra ID OAuth flow
3. Email domain validated — **only `@genthrust.net` allowed** (enforced in `signIn` callback)
4. JWT issued with `role: 'internal'`
5. Full access to `/internal/*` routes

### Client Auth (Credentials + MFA)

**Step 1 — Credential Verification:**
1. Client submits email + password to `/api/auth/verify-credentials`
2. Server queries `portal_users` where `is_active = 1`
3. Password verified via `bcrypt.compare()` (12 rounds)
4. If `mfa_enabled = 0`: login completes immediately
5. If `mfa_enabled = 1`: returns `mfaToken` (5-minute JWT challenge)

**Step 2 — MFA Challenge (if enabled):**
1. Client enters 6-digit TOTP code from authenticator app
2. Server verifies challenge token signature (HMAC-SHA256) and expiry
3. Decrypts TOTP secret from DB using AES-256-GCM
4. Validates code with ±1 time-step tolerance (60-second window)
5. Falls back to recovery code check (bcrypt-hashed, one-time use)
6. JWT issued with `role: 'client'`, `mfaEnabled: true`

### MFA Implementation Details

| Aspect | Implementation |
|--------|---------------|
| Algorithm | TOTP (RFC 6238) via `otpauth` library |
| Secret Encryption | AES-256-GCM (authenticated encryption) |
| Key Length | 256-bit (32 bytes from `MFA_ENCRYPTION_KEY`) |
| Code Digits | 6 |
| Time Step | 30 seconds |
| Tolerance | ±1 step (accepts codes from -30s to +30s) |
| Recovery Codes | 10 codes, 8 chars each (A-Z minus I/L/O/S, 2-9), bcrypt-hashed |
| Challenge Token | HMAC-SHA256 signed JWT, 5-minute expiry |
| QR Issuer | "GENTHRUST Portal" |

### Session & JWT

```typescript
// JWT token enrichment (auth.config.ts)
token.role = account.provider === 'credentials' ? 'client' : 'internal'
token.companyId = user.companyId
token.companyName = user.companyName
token.erpContactId = user.erpContactId
token.mfaEnabled = user.mfaEnabled

// Session exposure
session.user.id = token.id
session.user.role = token.role          // 'internal' | 'client'
session.user.mfaEnabled = token.mfaEnabled
```

### Middleware Route Protection

| Route | Condition | Action |
|-------|-----------|--------|
| `/internal/*` | Not logged in | Block (return false) |
| `/portal/*` | Not logged in | Redirect to `/login` |
| `/portal/*` | Client without MFA, not on `/portal/mfa-setup` | **Force redirect to `/portal/mfa-setup`** |
| `/signin` | Already logged in | Redirect to `/internal` |
| `/login` | Already logged in | Redirect to `/portal` |
| `/register` | Already logged in | Redirect by role |
| All other routes | — | Allow |

**Key enforcement:** MFA is **mandatory** for all client users. They cannot access any portal page until MFA is configured.

### Password Hashing

- Library: `bcryptjs`
- Rounds: 12
- Functions: `hashPassword(password)` and `verifyPassword(password, hash)` in `lib/password.ts`

---

## 4. Public Website

The landing page (`app/page.tsx`) renders these sections in order:

### 4.1 Navbar
- Fixed header with scroll-aware styling
- Logo + nav links (Inventory, About, Contact)
- "Portal Access" CTA opens modal with Internal Team / Client Portal buttons
- Responsive mobile hamburger menu

### 4.2 Hero Section
Multi-stage intro animation:
1. **Loading** — particle field initializes
2. **Assembling** — 35,000 WebGL particles assemble into Genthrust logo shape via custom vertex shaders
3. **Glowing** — particles emit light, glow modulation
4. **Revealing** — logo card appears with glassmorphism, HUD overlay, 3D mouse-tracked parallax
5. **Complete** — tagline, trust bar (25+ years, 500+ partners, 10K+ parts, 99% on-time), scroll indicator

Falls back to Canvas 2D on devices without WebGL2 support.

### 4.3 Search Section
- Search input with API integration (`GET /api/search?q=...`)
- Condition filter (All, New, Overhauled, Serviceable, As-Removed)
- Aircraft filter (All, A320, A330, B737, B777, B787)
- Popular search terms chips
- Results table (Part #, Description, MFR Part, NSN, Manufacturer, Location)

### 4.4 Stats Bar
4-column animated counters:
- 25+ Years Experience
- 500+ Global Partners
- 10K+ Parts Delivered
- 99% On-Time Delivery

### 4.5 Services Bento Grid
4 service cards with hover animations:
1. **Parts Sourcing** — Global network of certified suppliers
2. **Component Repair** — Professional repair with full traceability
3. **Parts Sales** — Competitive pricing on NE/OH/SV parts
4. **AOG Support** — 24/7 emergency support worldwide

### 4.6 Credentials Section
- Mission / Vision / Values cards (3-column, Vision card featured)
- Certification badges (Global Reach, Verified Quality, Fast Response)

### 4.7 Featured Inventory
- 4 featured parts grid (CFM56-5B Fan Blade, APU Starter Generator, FMC, Landing Gear Actuator)
- Status badges (Available / Limited / AOG)
- AOG hotline banner with +1 (305) 450-0191

### 4.8 Contact Section
- Contact info cards (Phone, Email, Address, Hours)
- Contact form (name, email, phone, company, subject, message)
- Google Maps embed (9565 NW 40 St Road, Doral, FL 33178)

### 4.9 Footer
- Logo, quick links, contact info, team (Jose Malagon, Sandra Gallagher)
- Hours: Monday-Friday 9am-5pm
- Copyright + legal links

---

## 5. Internal Dashboard

Accessible at `/internal/*`. Requires `role: 'internal'` (Entra ID login).

### 5.1 Dashboard Overview (`/internal`)

**Stat Cards (8):**
- Total Parts, Total Companies, Active ROs, Active SOs
- Open Invoices, Open Balance ($), Pending Quotes, Pending RFQs

**Charts:**
- RO Status Breakdown — donut/pie chart with legend
- Invoice Totals — bar chart

**Tables:**
- Recent Repair Orders (sortable)
- Recent Sales Orders (sortable)
- Recent Invoices (sortable, full width)

### 5.2 Bot Operations (`/internal/bots`)

- **Bot Status Cards** — live status for all 5 bots (RUNNING/STOPPED/UNKNOWN)
- **Real-time Metrics** — Quotes Created, 8130 Reports, AOG Leads, Inventory Alerts, Files Synced
- **Inventory Snapshot** — condition breakdown from bot DB
- **Notification Feed** — aggregated activity log from all bot logs
- **Log Viewer** — syntax-highlighted bot logs with timestamp/error coloring
- **Service Controls** — restart buttons with confirmation dialog

### 5.3 Inventory Intelligence (`/internal/inventory-intelligence`)

- **Summary Stats** — Pending Drafts, Committed Stock, Total SKUs, Today's Alerts, Sync Status
- **Condition Breakdown** — color-coded pills + donut chart (NE/OH/SV/AR)
- **Sales Velocity** — bar chart (top 10 movers, 7/30/90-day windows) + sortable table
- **Recent Alerts** — alert type badges with timestamps
- **Inventory Search** — part number search with condition filter

### 5.4 Inventory Alarms (`/internal/inventory-alarms`)

- **Summary** — Watched Parts, Active Alarms, OH Watched, AR Watched
- **Check Now** — triggers watchlist verification against live ERP data
- **Alarm Tables** — Active alarms (with acknowledge action), acknowledged alarms
- **Watchlist Table** — current watched parts with remove action
- **Add to Watchlist** — ERP search, shows current quantity, one-click add

### 5.5 Automation (`/internal/automation`)

- **NET30 Summary** — Past Due, Due Soon (7d), Upcoming, total orders
- **Progress Bar** — segmented visualization of payment status distribution
- **NET30 Payment Table** — payment timeline bars, days overdue/until due
- **Follow-Up ROs** — status stats + table (Approved, Delivered)
- **Purchase Orders** — open PO table
- **Active Repair Orders** — full RO table
- **Automation Preview** — dry-run NET30 Reminders and RO Digest with JSON output

### 5.6 Client Management (`/internal/clients`)

- **Summary** — Total Clients, Active, Pending Approval
- **Filter Tabs** — Pending / Active / All with counts
- **Client Registry Table** — Contact Name, Email, Company, Status, Registered date
- **Actions** — Activate/Deactivate toggle, Reject pending, Reset MFA

### 5.7 Order Detail Pages

- **Invoices** (`/internal/invoices`) — list with search/filter/pagination, detail view with line items
- **Repair Orders** (`/internal/repair-orders`) — list + detail view
- **Sales Orders** (`/internal/sales-orders`) — list + detail view

---

## 6. Client Portal

Accessible at `/portal/*`. Requires `role: 'client'` (credentials login). MFA setup is mandatory.

### 6.1 Login (`/login`)
- Email + password form
- Two-step flow: credentials → MFA code (if enabled)
- Links to registration

### 6.2 Registration (`/register`)
- Self-registration form (name, email, password 8+ chars, company with autocomplete)
- Pending admin approval workflow
- Company search from `/api/register/companies`

### 6.3 MFA Setup (`/portal/mfa-setup`)
- **Required** for all new client users (middleware enforces redirect)
- Step 1: QR code display + manual secret for authenticator app
- Step 2: Verify 6-digit TOTP code
- Step 3: Display 10 recovery codes (must save before proceeding)

### 6.4 Portal Dashboard (`/portal`)
- Company name header with last refresh time
- **Stat Cards:** Active SOs, Open Invoices, Open Balance ($), Active ROs
- **Recent Sales Orders** — clickable rows navigate to detail
- **Recent Repair Orders** — clickable rows
- **Recent Invoices** — full width, clickable rows
- All data company-scoped (filtered by `session.user.companyId`)

### 6.5 Order Detail Pages
- `/portal/invoices/[id]` — invoice detail with line items (company-filtered)
- `/portal/repair-orders/[id]` — RO detail with line items (company-filtered)
- `/portal/sales-orders/[id]` — SO detail with line items (company-filtered)
- **Access control:** 403 if invoice/order belongs to different company

### 6.6 Settings (`/portal/settings`)
- MFA status display with recovery codes remaining
- Warning banner if recovery codes <= 2
- Change/disable authenticator (requires current TOTP code)

---

## 7. API Reference

### 7.1 Public Endpoints (No Auth)

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | GET/POST | `/api/auth/[...nextauth]` | NextAuth handler (login, callback, session) |
| 2 | POST | `/api/auth/verify-credentials` | Portal credential check + MFA token |
| 3 | POST | `/api/contact` | Contact form submission |
| 4 | GET | `/api/search?q=` | Public parts catalog search |
| 5 | POST | `/api/register` | Client self-registration (pending approval) |
| 6 | GET | `/api/register/companies?q=` | Company autocomplete for registration |

### 7.2 Admin / Restricted Endpoints

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 7 | POST | `/api/admin/create-client` | Internal role | Create client account |
| 8 | POST | `/api/clients` | @genthrust.net email | Create portal user |

### 7.3 Internal Endpoints (role: internal)

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 9 | GET | `/api/internal/dashboard` | Dashboard stats (8 metrics + recent orders) |
| 10 | GET | `/api/internal/automation` | NET30, followups, POs, active ROs |
| 11 | GET | `/api/internal/automation/preview?type=` | Dry-run automation (net30 or digest) |
| 12 | GET | `/api/internal/bots` | All bot statuses + metrics + notifications |
| 13 | GET | `/api/internal/bots/inventory` | Bot inventory summary (drafts, stock, SKUs) |
| 14 | GET | `/api/internal/bots/logs?bot=&lines=` | Bot log tail (max 500 lines) |
| 15 | POST | `/api/internal/bots/restart` | Restart bot service (requires confirm) |
| 16 | GET | `/api/internal/clients` | List all portal users |
| 17 | PATCH | `/api/internal/clients` | Toggle client active status |
| 18 | DELETE | `/api/internal/clients` | Delete inactive client |
| 19 | POST | `/api/internal/clients/mfa-reset` | Reset client MFA |
| 20 | GET | `/api/internal/inventory-alarms` | Alarm summary + watchlist |
| 21 | POST | `/api/internal/inventory-alarms/acknowledge` | Acknowledge alarm |
| 22 | POST | `/api/internal/inventory-alarms/check` | Run watchlist check |
| 23 | GET | `/api/internal/inventory-alarms/search?q=` | Search ERP parts for alarms |
| 24 | GET | `/api/internal/inventory-alarms/watchlist` | Get watchlist items |
| 25 | POST | `/api/internal/inventory-alarms/watchlist` | Add part to watchlist |
| 26 | DELETE | `/api/internal/inventory-alarms/watchlist` | Remove from watchlist |
| 27 | GET | `/api/internal/inventory-intelligence` | Full inventory analytics |
| 28 | GET | `/api/internal/inventory-intelligence/search?q=&condition=` | Search bot inventory DB |
| 29 | GET | `/api/internal/invoices?search=&status=&page=&limit=` | List invoices (paginated) |
| 30 | GET | `/api/internal/invoices/[id]` | Invoice detail + line items |
| 31 | GET | `/api/internal/repair-orders?search=&status=&page=&limit=` | List ROs (paginated) |
| 32 | GET | `/api/internal/repair-orders/[id]` | RO detail + line items |
| 33 | GET | `/api/internal/sales-orders?search=&status=&page=&limit=` | List SOs (paginated) |
| 34 | GET | `/api/internal/sales-orders/[id]` | SO detail + line items |
| 35 | POST | `/api/internal/sync/parts?full=` | Sync parts from ERP (incremental/full) |

### 7.4 MCP HTTP Endpoint

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 36 | GET/POST/DELETE | `/api/mcp` | Bearer token (`MCP_API_KEY`) | MCP protocol endpoint |

**MCP Tools exposed via HTTP:**

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `get_dashboard_stats` | — | Dashboard statistics |
| `search_parts` | `query` | Search parts catalog |
| `search_repair_orders` | `query`, `status?` | Search ROs |
| `search_sales_orders` | `query`, `status?` | Search SOs |
| `search_invoices` | `query` | Search invoices |
| `get_repair_order` | `id` | RO detail + lines |
| `get_sales_order` | `id` | SO detail + lines |
| `get_invoice` | `id` | Invoice detail + lines |
| `list_companies` | `query` | Search companies |
| `get_client_orders` | `company_id` | All orders for a company |

### 7.5 Portal Endpoints (Authenticated Client)

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 37 | GET | `/api/portal/dashboard` | Company-scoped dashboard |
| 38 | GET | `/api/portal/invoices/[id]` | Invoice detail (company-filtered) |
| 39 | GET | `/api/portal/repair-orders/[id]` | RO detail (company-filtered) |
| 40 | GET | `/api/portal/sales-orders/[id]` | SO detail (company-filtered) |
| 41 | GET | `/api/portal/mfa/status` | MFA status + recovery codes count |
| 42 | POST | `/api/portal/mfa/enroll` | Generate TOTP secret + QR code |
| 43 | POST | `/api/portal/mfa/verify` | Verify TOTP code, complete enrollment |
| 44 | POST | `/api/portal/mfa/disable` | Disable MFA (requires current code) |

---

## 8. Internal Tools (Deep Dive)

### 8.1 Bot Fleet System

Five Windows services managed as the Genthrust bot fleet. All run from `C:\GenthrustBot\` with logs at `C:\GenthrustBot\logs\`.

#### BOT_REGISTRY

| Key | Service Name | Log File | Display Name | Purpose |
|-----|--------------|----------|--------------|---------|
| `ils` | `GT-ILS-Bot` | `ils_debug.log` | **ILS Sniper** | Monitors ILS marketplaces, auto-generates quotes for matching RFQs |
| `internal` | `GT-Internal-Bot` | `internal_bot.log` | **Internal Auditor** | Generates 8130-3 compliance reports, VIP customer alerts |
| `sync` | `GT-Sync-Bot` | `sync_bot.log` | **OneDrive Sync** | Syncs inventory data with OneDrive and ERP AERO cache |
| `aog` | `GT-AOG-Bot` | `aog_bot.log` | **AOG Monitor** | Monitors AOG (Aircraft on Ground) requests, sends Teams alerts |
| `inventory` | `GT-Inventory-Bot` | `inventory_bot.log` | **Inventory Intelligence** | Tracks sales velocity, stock alerts, condition monitoring |

#### Bot Status Monitoring

Uses `sc query "GT-*-Bot"` Windows command (5s timeout) to check service state. Returns `RUNNING`, `STOPPED`, or `UNKNOWN`.

#### Metrics Extraction (Today Only)

Each bot has regex patterns applied to today's log lines:

**ILS Sniper:**
- Quotes Created: `/quote.*(?:created|drafted|generated)/gi`
- RFQs Matched: `/rfq.*match|match.*rfq/gi`
- Auto-Sent: `/auto.?sent|sent.*automatically/gi`

**Internal Auditor:**
- 8130 Reports: `/8130.*(?:generated|created|attached)/gi`
- VIP Alerts: `/vip.*alert|alert.*vip/gi`

**OneDrive Sync:**
- Files Synced: `/sync.*(?:complete|success|uploaded)/gi`
- Cache Updates: `/cache.*(?:updated|refreshed)/gi`

**AOG Monitor:**
- AOG Leads: `/aog.*(?:lead|found|detected)/gi`
- Teams Notifs: `/teams.*(?:sent|notif|posted)/gi`

**Inventory Intelligence:**
- Alerts Sent: `/alert.*(?:sent|created|triggered)/gi`
- Stock Checks: `/stock.*(?:check|scan|audit)/gi`

#### Notification Feed

Aggregates all bot logs, matches against severity patterns, and returns a sorted feed:

| Pattern | Severity |
|---------|----------|
| `quote.*created` | success |
| `auto.?sent` | success |
| `8130.*generated` | success |
| `vip.*alert` | warning |
| `aog.*lead` | warning |
| `teams.*sent` | info |
| `alert.*sent` | warning |
| `sync.*complete` | info |
| `error\|failed\|exception` | error |
| `stock.*low\|depleted` | warning |

### 8.2 ERP AERO Integration

#### Authentication Flow

```
lib/erp-client.ts
  └── signin()
       ├── POST https://wapi.erp.aero/v1/auth/signin
       │     Body: { cid, email, password, type: 'user', source: 'automation' }
       │     Returns: { data: { status: 1, token: "jwt-..." } }
       ├── Cache token with 30-minute TTL
       └── On 401 response: clear cache → re-authenticate → retry once
```

**Config from environment:**
- `ERP_AERO_BASE_URL` (default: `https://wapi.erp.aero`)
- `ERP_AERO_CID` (company ID: `GENTHRUST`)
- `ERP_AERO_EMAIL`, `ERP_AERO_PASSWORD`

#### ERP Client Operations

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `getOpenPurchaseOrders()` | `GET /v1/po/list` | Open POs with NET terms (excludes Closed/Cancelled/Completed) |
| `getActiveRepairOrders(limit)` | `GET /v1/ro/list` | Active ROs (excludes Closed/Cancelled) |
| `getNet30PaymentDates()` | `GET /v1/ro/list` | Received ROs with NET terms → calculates due dates |
| `getFollowupROs()` | `GET /v1/ro/list` | ROs with status Approved or Delivered |
| `searchErpParts(query, page)` | `GET /v1/part/list` | Part search (25 per page) |
| `getPartLiveData(partNumber)` | `GET /v1/part/list` | Live quantity for watchlist alarms |

#### Pagination Helper

`fetchAllPages(endpoint, maxPages=20)` fetches pages sequentially (25 items/page, descending by modified_time).

#### Response Envelope Unwrapper

Handles three ERP response shapes: direct array `[...]`, nested `{ data: [...] }`, or standard `{ data: { list: [...] } }`.

### 8.3 Automation Engine

#### NET30 Payment Tracking

1. Fetches ROs with `status = "Received"` AND `payment_terms LIKE "%NET%"`
2. Extracts NET days: `parseInt(terms.replace(/\D/g, '')) || 30`
3. Calculates: `payment_due_date = date_received + net_days`
4. Assigns status flags:
   - **PAST_DUE** — `delta < 0` (includes `days_overdue`)
   - **DUE_SOON** — `0 ≤ delta ≤ 7` (includes `days_until_due`)
   - **UPCOMING** — `delta > 7` (includes `days_until_due`)
5. Sorts by due date ascending

#### RO Follow-ups

Identifies ROs with status `Approved` or `Delivered` — waiting on vendor action, needing follow-up.

#### Purchase Order Monitoring

Tracks open spending commitments: status NOT IN (Closed, Cancelled, Completed) AND payment_terms contain "NET".

#### Calendar Reminder Automation

When `run_net30_reminders(dry_run=False)`:
- Creates calendar events for PAST_DUE orders (red flag)
- Creates calendar events for DUE_SOON orders (yellow flag)
- Creates follow-up reminder events for Approved/Delivered ROs
- Writes to accounting mailbox calendar

#### Weekly RO Digest

When `run_ro_digest(dry_run=False)`:
- Fetches all active ROs
- Diffs against last week's snapshot
- Sends digest email to accounting team
- Creates summary calendar event

### 8.4 Inventory Intelligence

**Data Sources:** `genthrust_inventory` database

| Metric | Source |
|--------|--------|
| Pending Drafts | `ils_pending_quotes` table |
| Committed Stock | `inventory_committed` table |
| Total SKUs | `inventory` table (distinct part_number) |
| Condition Breakdown | `inventory` grouped by condition (NE/OH/SV/AR) |
| Sales Velocity | `sales_velocity` table (7/30/90-day sold counts + revenue) |
| Recent Alerts | `inventory_alerts` table (today's entries) |
| Sync Status | Last sync timestamp + staleness flag |

### 8.5 Inventory Alarm & Watchlist System

**Workflow:**
1. Internal user searches ERP parts and adds to watchlist (specifying part_number + condition_code)
2. System records `last_known_qty` at add time
3. "Check Now" or scheduled check queries ERP live data via `getPartLiveData()`
4. If quantity decreased → creates alert in `inventory_alerts`
5. Alert types: `WATCHLIST_OH_DEPLETED`, `WATCHLIST_AR_DEPLETED`, etc.
6. Internal user acknowledges alarms via UI

**Watchlist table:** `inventory_watchlist` with unique constraint on `(part_number, condition_code)`, soft delete via `is_active` flag.

### 8.6 MFA System

See [Section 3: Authentication & Authorization](#3-authentication--authorization) for full details. Key components:

- **`lib/mfa.ts`** — TOTP generation, AES-256-GCM encrypt/decrypt, recovery code generation, challenge token create/verify
- **`components/portal/MfaEnrollment.tsx`** — QR code display, verification, recovery code presentation
- **`components/portal/MfaChallenge.tsx`** — 6-digit code entry, recovery code mode toggle
- **Database:** `mfa_factors` (encrypted secrets), `mfa_recovery_codes` (bcrypt-hashed)

### 8.7 Parts Sync Pipeline

**Script:** `scripts/sync-parts.ts`

```
ERP AERO API ──→ fetchAllPages('/v1/part/list') ──→ UPSERT into parts table
                 (25 per page, up to 20 pages)       (ON DUPLICATE KEY UPDATE)
                                                      (batch size: 100)
```

Tracks sync state via `erp_modified_at` timestamp. Supports full sync (`?full=true`) and incremental sync.

Triggered via `POST /api/internal/sync/parts`.

---

## 9. MCP Servers

Four MCP servers are registered in `.mcp.json`:

### 9.1 genthrust-bots (Python, stdio)

**Path:** `mcp-servers/genthrust-bots/server.py`
**Root:** `C:\GenthrustBot`
**Dependency:** `BotDataManager` from `C:\GenthrustBot\dashboard\data_manager.py`

| Tool | Parameters | Returns |
|------|-----------|---------|
| `get_bot_statuses` | — | Status of all 5 bots (RUNNING/STOPPED/UNKNOWN) with detection method |
| `get_bot_logs` | `bot_name`, `lines` (max 500) | Log file content + size |
| `get_bot_metrics` | `bot_name?` (optional, empty = all) | Metrics dict per bot |
| `get_inventory_summary` | — | DB metrics, inventory by condition, sync status, AOG API usage, recent alerts |
| `get_sales_velocity` | `limit` (max 100) | Top-moving parts ranked by 30-day sales |
| `search_bot_inventory` | `query`, `condition?`, `limit` (max 100) | Part search in bot DB (MySQL LIKE) |
| `restart_bot` | `bot_name`, `confirm` (bool) | Preview or execute service restart |
| `get_notification_feed` | `limit` (max 50) | Aggregated event feed from all bots |

### 9.2 genthrust-automation (Python, stdio)

**Path:** `mcp-servers/genthrust-automation/server.py`
**Root:** `C:\GenThrust\automation`
**Dependencies:** `erp_client`, `net30_reminders`, `ro_status_digest`

| Tool | Parameters | Returns |
|------|-----------|---------|
| `get_open_purchase_orders` | — | Open POs with NET terms |
| `get_active_repair_orders` | — | Non-closed ROs |
| `get_net30_payment_dates` | — | Received ROs with payment due dates + status flags |
| `get_followup_ros` | — | Approved/Delivered ROs needing follow-up |
| `run_net30_reminders` | `dry_run` (default true) | Create payment + follow-up calendar reminders |
| `run_ro_digest` | `dry_run` (default true) | Generate weekly RO status digest email |
| `search_erp_parts` | `query`, `page` | Search parts in ERP AERO API |
| `get_erp_company` | `company_name` | Company lookup (partial match) |

### 9.3 mysql (npm, @benborla29/mcp-server-mysql)

**Access:** Read-only (INSERT/UPDATE/DELETE disabled)
**Database:** `genthrust` on `127.0.0.1:3307`
**Purpose:** Direct SQL queries against the primary portal database for ad-hoc investigation.

### 9.4 microsoft-365 (Python)

**Path:** `C:\Users\GEN_AI\mcp-servers\ms365\server.py`
**Auth:** Device code flow with Microsoft Graph API
**Purpose:** Email, calendar, SharePoint, OneDrive operations for the `@genthrust.net` tenant.

---

## 10. Component Library

### 10.1 Hero / Intro (3 components)

| Component | File | Purpose |
|-----------|------|---------|
| `HeroIntro` | `components/Hero/HeroIntro.tsx` | Multi-stage intro animation orchestrator (loading → assembling → glowing → revealing → complete) |
| `HUDOverlay` | `components/Hero/HUDOverlay.tsx` | Futuristic heads-up display overlay (corner brackets, scan lines, status indicators) |
| `LogoReveal` | `components/Hero/LogoReveal.tsx` | Glassmorphism logo card with 3D mouse-tracked parallax, trust bar, CTAs |

### 10.2 3D / Three.js (4 components)

| Component | File | Purpose |
|-----------|------|---------|
| `ParticleVertexAircraft` | `components/ParticleVertexAircraft/index.tsx` | R3F Canvas wrapper with adaptive performance monitoring |
| `AircraftParticles` | `components/ParticleVertexAircraft/AircraftParticles.tsx` | 35,000-particle vertex shader system (custom GLSL, additive blending) |
| `Canvas2DFallback` | `components/ParticleVertexAircraft/Canvas2DFallback.tsx` | 2D canvas fallback for non-WebGL2 browsers |
| `DataGrid` | `components/ParticleVertexAircraft/DataGrid.tsx` | Subtle floor grid for 3D scene |

### 10.3 Layout (2 components)

| Component | File | Purpose |
|-----------|------|---------|
| `Navbar` | `components/layout/Navbar.tsx` | Fixed nav header, portal access modal, mobile menu, scroll-aware styling |
| `Footer` | `components/layout/Footer.tsx` | Site footer with logo, links, contact info, hours, copyright |

### 10.4 Sections (7 components)

| Component | File | Purpose |
|-----------|------|---------|
| `HeroSection` | `components/sections/HeroSection.tsx` | Wrapper for HeroIntro with gradient fade |
| `SearchSection` | `components/sections/SearchSection.tsx` | Inventory search with filters + results table |
| `StatsBar` | `components/sections/StatsBar.tsx` | 4-column animated counter stats |
| `ServicesBento` | `components/sections/ServicesBento.tsx` | Service offerings bento grid |
| `CredentialsSection` | `components/sections/CredentialsSection.tsx` | Mission/Vision/Values + certification badges |
| `FeaturedInventory` | `components/sections/FeaturedInventory.tsx` | Featured parts grid + AOG hotline banner |
| `ContactSection` | `components/sections/ContactSection.tsx` | Contact form + info cards + Google Maps |
| `BentoInventoryGrid` | `components/sections/BentoInventoryGrid.tsx` | Inventory category showcase (Engine, Avionics, Airframe) |

### 10.5 UI Primitives (15+ components)

| Component | File | Key Props | Purpose |
|-----------|------|-----------|---------|
| `Button` | `ui/Button.tsx` | `variant` (primary/outline/outline-red), `size`, `icon` | Primary CTA button with ripple effect |
| `MagneticButton` | `ui/MagneticButton.tsx` | `magneticStrength`, `maxDisplacement` | Cursor-following magnetic button |
| `GlassCard` | `ui/GlassCard.tsx` | `featured`, `href`, `className` | Glassmorphic card with backdrop blur |
| `BorderBeam` | `ui/BorderBeam.tsx` | `beamColor`, `duration` | Animated rotating border conic gradient |
| `DataPing` | `ui/DataPing.tsx` | `interval`, `prefix` | Simulated data activity display |
| `AnimatedCounter` | `ui/AnimatedCounter.tsx` | `value`, `suffix`, `duration` | Scroll-triggered number counter |
| `AnamorphicFlare` | `ui/AnamorphicFlare.tsx` | `opacity`, `disabled` | Mouse-tracked lens flare effect |
| `SearchInput` | `ui/SearchInput.tsx` | `dark` | Enhanced search input with glow focus |
| `Spinner` | `ui/Spinner.tsx` | `size`, `variant` (default/dots/pulse) | Loading indicator |
| `TypewriterText` | `ui/TypewriterText.tsx` | `text`, `speed`, `loop` | Character-by-character typing effect |
| `InventoryTable` | `ui/InventoryTable.tsx` | `items: PartResult[]`, `isLoading` | Parts table with hazmat badges |
| `Dialog` | `ui/Dialog.tsx` | — | Modal dialog |
| `Modal` | `ui/Modal.tsx` | — | Modal overlay |
| `Dropdown` | `ui/Dropdown.tsx` | — | Dropdown selector |
| `ProgressBar` | `ui/ProgressBar.tsx` | — | Linear progress indicator |
| `ProgressRing` | `ui/ProgressRing.tsx` | — | Circular progress indicator |
| `SkeletonLoader` | `ui/SkeletonLoader.tsx` | — | Loading skeleton placeholder |
| `Toggle` | `ui/Toggle.tsx` | — | Toggle switch |
| `ParticleBackground` | `ui/ParticleBackground.tsx` | — | Particle effect background |
| `Shimmer` | `ui/Shimmer.tsx` | — | Shimmer loading effect |

### 10.6 Internal Dashboard (4 components)

| Component | File | Key Props | Purpose |
|-----------|------|-----------|---------|
| `InternalNav` | `internal/InternalNav.tsx` | — | Tab-style nav (Dashboard, Bots, Inventory Intel, Alarms, Automation, Clients) |
| `StatCard` | `internal/StatCard.tsx` | `icon`, `label`, `value`, `color`, `trend` | Metric card with icon + trend indicator |
| `DataTable` | `internal/DataTable.tsx` | `columns`, `data`, `onRowClick`, `compact` | Generic sortable table with custom renderers |
| `ChartCard` | `internal/ChartCard.tsx` | `title`, `icon`, `subtitle`, `action` | Chart wrapper card |

### 10.7 Portal / Auth (2 components)

| Component | File | Key Props | Purpose |
|-----------|------|-----------|---------|
| `MfaChallenge` | `portal/MfaChallenge.tsx` | `onSubmit`, `error` | 6-digit TOTP code entry + recovery code mode |
| `MfaEnrollment` | `portal/MfaEnrollment.tsx` | `onComplete` | Multi-step MFA setup (QR → verify → recovery codes) |

---

## 11. Database Schema

### 11.1 Database: `genthrust` (Primary)

#### `portal_users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT PK | |
| `email` | VARCHAR(255) UNIQUE NOT NULL | |
| `password_hash` | VARCHAR(255) NOT NULL | bcrypt (12 rounds) |
| `contact_name` | VARCHAR(255) | |
| `company_id` | INT FK → companies.id | Nullable |
| `mfa_enabled` | TINYINT DEFAULT 0 | |
| `is_active` | TINYINT | 0 = pending/deactivated |
| `created_at` | TIMESTAMP | |
| `last_login` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

#### `companies`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `company_name` | VARCHAR(255) | |
| `city` | VARCHAR(255) | |
| `state` | VARCHAR(255) | |
| `country` | VARCHAR(255) | |
| `phone` | VARCHAR(20) | |
| `email` | VARCHAR(255) | |

#### `mfa_factors`
```sql
CREATE TABLE mfa_factors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  factor_type ENUM('totp') NOT NULL DEFAULT 'totp',
  secret_encrypted VARCHAR(512) NOT NULL,
  secret_iv VARCHAR(64) NOT NULL,
  secret_auth_tag VARCHAR(64) NOT NULL,
  status ENUM('pending', 'verified') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP NULL,
  UNIQUE KEY uq_user_factor (user_id, factor_type),
  FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE
);
```

#### `mfa_recovery_codes`
```sql
CREATE TABLE mfa_recovery_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE,
  INDEX idx_user_unused (user_id, used_at)
);
```

#### `clients`
```sql
CREATE TABLE clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### `parts` (ERP Cache)
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `erp_product_id` | VARCHAR UNIQUE | Upsert key |
| `product_name` | VARCHAR(255) | |
| `description` | VARCHAR(500) | |
| `full_description` | TEXT | |
| `nsn_number` | VARCHAR(100) | National Stock Number |
| `cage_code` | VARCHAR(50) | |
| `mfr_part_no` | VARCHAR(255) | Manufacturer part number |
| `serial_no` | VARCHAR(255) | |
| `hazmat` | TINYINT | 0 or 1 |
| `hazmat_class` | VARCHAR(50) | |
| `is_portal_item` | TINYINT | Portal visibility flag |
| `manufacturer_name` | VARCHAR(255) | |
| `warehouse_title` | VARCHAR(255) | |
| `product_category` | VARCHAR(255) | |
| `erp_created_at` | DATETIME | |
| `erp_modified_at` | DATETIME | Sync watermark |

#### `repair_orders`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `erp_po_id` | VARCHAR | ERP reference |
| `ro_number` | VARCHAR | |
| `vendor_name` | VARCHAR(255) | |
| `status` | VARCHAR(50) | Open, In Progress, Closed, Cancelled, Completed, Received |
| `priority` | VARCHAR(50) | |
| `due_date` | DATETIME | |
| `total` | DECIMAL | |
| `erp_created_at` | DATETIME | |
| `erp_modified_at` | DATETIME | |

#### `repair_order_lines`
Line items for repair orders (FK to `repair_orders.id`).

#### `sales_orders`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `erp_so_id` | VARCHAR | ERP reference |
| `so_number` | VARCHAR | |
| `customer_po` | VARCHAR | Customer PO reference |
| `customer_name` | VARCHAR(255) | |
| `status` | VARCHAR(50) | Open, In Progress, Closed, Cancelled, Completed |
| `priority` | VARCHAR(50) | |
| `due_date` | DATETIME | |
| `total` | DECIMAL | |
| `erp_created_at` | DATETIME | |
| `erp_modified_at` | DATETIME | |

#### `sales_order_lines`
Line items for sales orders (FK to `sales_orders.id`).

#### `invoices`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `erp_invoice_id` | VARCHAR | ERP reference |
| `invoice_no` | VARCHAR | |
| `account_name` | VARCHAR(255) | |
| `status` | VARCHAR(50) | Paid, Closed, Cancelled |
| `due_date` | DATETIME | |
| `invoice_date` | DATETIME | |
| `total` | DECIMAL | |
| `open_balance` | DECIMAL | |
| `erp_modified_at` | DATETIME | |

#### `invoice_lines`
Line items for invoices (FK to `invoices.id`).

#### `quotes`
Quotes with `stage` field (Closed, Won, Lost). Used for dashboard Pending Quotes count.

#### `rfqs`
RFQs with `status` field (Closed, Completed). Used for dashboard Pending RFQs count.

#### `documents`
Document records. Used for dashboard Total Documents count.

#### `catalog_items`
Catalog item records. Used for dashboard Catalog Items count.

### 11.2 Database: `genthrust_inventory` (Bot Operations)

#### `inventory_watchlist`
```sql
CREATE TABLE inventory_watchlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  part_number VARCHAR(100) NOT NULL,
  condition_code ENUM('OH','AR','NE','SV') NOT NULL,
  description VARCHAR(500) NULL,
  added_by VARCHAR(255) NOT NULL,
  last_known_qty INT NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMP NULL,
  is_active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_part_condition (part_number, condition_code),
  INDEX idx_active (is_active)
);
```

#### `inventory_alerts`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `alert_type` | VARCHAR | e.g., WATCHLIST_OH_DEPLETED |
| `part_number` | VARCHAR(100) | |
| `details` | TEXT | |
| `acknowledged_at` | TIMESTAMP NULL | |
| `acknowledged_by` | VARCHAR(255) NULL | |
| `created_at` | TIMESTAMP | |

#### `inventory`
Bot-managed inventory snapshot. Columns: `part_number`, `condition`, `quantity`, etc.

#### `inventory_committed`
Committed stock quantities (allocated to orders).

#### `ils_pending_quotes`
ILS Sniper bot's pending quote drafts.

#### `sales_velocity`
Sales velocity tracking: `part_number`, `sold_last_30d`, and other period-based metrics.

### 11.3 Relationships

```
portal_users.company_id ──→ companies.id
mfa_factors.user_id ──→ portal_users.id (CASCADE DELETE)
mfa_recovery_codes.user_id ──→ portal_users.id (CASCADE DELETE)
repair_order_lines.repair_order_id ──→ repair_orders.id
sales_order_lines.sales_order_id ──→ sales_orders.id
invoice_lines.invoice_id ──→ invoices.id
```

---

## 12. Design System

### 12.1 Color Palette

**Brand Primary — Navy:**
| Token | Hex | Usage |
|-------|-----|-------|
| `navy-50` | #f0f4f9 | Light backgrounds |
| `navy-100` | #dae3f0 | Borders |
| `navy-200` | #b8cae3 | |
| `navy-300` | #8aa8d1 | |
| `navy-400` | #5a82ba | |
| `navy-500` | #3d67a3 | |
| `navy-600` | #1e4a8d | **Primary brand** |
| `navy-700` | #1a3f78 | |
| `navy-800` | #163462 | |
| `navy-900` | #132b51 | |

**Brand Secondary — Burgundy:**
| Token | Hex | Usage |
|-------|-----|-------|
| `burgundy-600` | #9c2a3e | **Secondary brand** |
| `burgundy-50` | #fdf2f4 | Light backgrounds |

**Accent Colors:**
| Token | Hex | Usage |
|-------|-----|-------|
| `electric-blue` | #2563EB | Interactive elements |
| `crimson` | #DC2626 | Danger/error |
| `aviation-red` | #EF4444 | Aviation alerts |
| `horizon-blue` | #38B2AC | Teal accent |
| `silver` | #F8FAFC | Background |

**Status Colors:**
| Token | Hex | Usage |
|-------|-----|-------|
| `available` | #059669 | In-stock parts |
| `limited` | #d97706 | Low-stock parts |
| `aog` | #dc2626 | AOG critical |

**Space Colors (Dark UI):**
| Token | Hex |
|-------|-----|
| `space-default` | #020617 |
| `space-50` | #0f172a |
| `space-100` | #1e293b |

### 12.2 Typography

| Family | CSS | Usage |
|--------|-----|-------|
| Sans | `var(--font-inter), Inter, system-ui, sans-serif` | Body text, headings |
| Mono | `var(--font-jetbrains-mono), JetBrains Mono, IBM Plex Mono, monospace` | Code, data, logs |

### 12.3 Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `card` | `0 1px 3px rgba(0,0,0,0.1)` | Default card |
| `card-hover` | `0 4px 12px rgba(0,0,0,0.15)` | Card hover state |
| `navy-focus` | `0 0 0 3px rgba(30,74,141,0.2)` | Input focus ring |
| `glow-blue` | `0 0 15px rgba(37,99,235,0.3)` | Electric blue glow |
| `glow-crimson` | `0 0 15px rgba(220,38,38,0.3)` | Red glow |

### 12.4 Animations

**Keyframe Animations (Tailwind):**
| Name | Duration | Effect |
|------|----------|--------|
| `fade-in` | 0.6s ease-out | Opacity 0→1 |
| `fade-in-up` | 0.6s ease-out | Opacity + translateY(-10px) |
| `pulse-subtle` | 3s infinite | Opacity 0.4→1→0.4 |
| `border-beam` | 4s linear infinite | 360° conic gradient rotation |
| `scan-sweep` | 0.6s ease-out | Top sweep reveal |
| `data-ping` | 0.3s ease-in-out | Opacity flicker |
| `horizon-drift` | 20s linear infinite | Slow horizontal drift |

**Framer Motion Variants (`lib/animations.ts`):**

| Category | Variants |
|----------|----------|
| Scroll-triggered | `fadeInUp`, `fadeIn`, `slideInLeft`, `slideInRight`, `slideInUp`, `slideInDown` |
| Stagger containers | `staggerContainer` (0.1s), `staggerGrid` (0.08s), `timelineAnimation` (0.15s) |
| Hover effects | `cardHover` (scale 1.02, Y -8px), `liftEffect` (Y -4px + shadow), `imageZoom` (scale 1.1) |
| Special effects | `glowPulse`, `shimmer`, `rippleEffect`, `scaleIn` |
| Modal | `modalBackdrop`, `modalContent`, `modalSlideIn` |
| Loading | `spinnerRotate`, `progressBarFill` |
| Icons | `iconRotate`, `iconFlip`, `iconBounce` |
| HUD/Tech | `hudFadeIn`, `glassReveal`, `scanPulse`, `borderBeamRotate`, `dataPingFlicker` |

### 12.5 Background Patterns

| Token | Effect |
|-------|--------|
| `gradient-radial` | Radial gradient |
| `hero-gradient` | Linear navy → white → silver |
| `chrome-gradient` | Metallic gradient |
| `horizon-lines` | Repeating diagonal lines |

---

## 13. Environment Variables

### Authentication

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | NextAuth session encryption + MFA challenge signing |
| `AUTH_URL` | Yes | Application URL (e.g., `http://localhost:3000`) |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Yes | Entra ID OAuth client ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Yes | Entra ID OAuth client secret |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | Yes | Entra ID issuer URL |

### MFA

| Variable | Required | Description |
|----------|----------|-------------|
| `MFA_ENCRYPTION_KEY` | Yes | 64-char hex string (32 bytes) for AES-256-GCM |

### Primary Database (genthrust)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `genthrust` | Database name |
| `DB_USER` | `genthrust` | Database user |
| `DB_PASSWORD` | — | Database password |

### Bot Inventory Database (genthrust_inventory)

| Variable | Default | Description |
|----------|---------|-------------|
| `BOT_DB_HOST` | `localhost` | MySQL host |
| `BOT_DB_PORT` | `3306` | MySQL port |
| `BOT_DB_NAME` | `genthrust_inventory` | Database name |
| `BOT_DB_USER` | `root` | Database user |
| `BOT_DB_PASSWORD` | — | Database password |

### ERP AERO

| Variable | Default | Description |
|----------|---------|-------------|
| `ERP_AERO_BASE_URL` | `https://wapi.erp.aero` | ERP API base URL |
| `ERP_AERO_CID` | — | Company ID (`GENTHRUST`) |
| `ERP_AERO_EMAIL` | — | ERP login email |
| `ERP_AERO_PASSWORD` | — | ERP login password |

### MCP

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_API_KEY` | For MCP HTTP | Bearer token for `/api/mcp` endpoint |
| `MS365_CLIENT_ID` | For MS365 MCP | Microsoft 365 app client ID |
| `MS365_TENANT_ID` | For MS365 MCP | Microsoft 365 tenant ID |

---

## 14. Key Files Reference

| File | Purpose |
|------|---------|
| `auth.ts` | NextAuth configuration — providers (Entra ID + Credentials), MFA challenge flow |
| `auth.config.ts` | Auth callbacks — JWT enrichment, session exposure, route authorization |
| `middleware.ts` | Route protection — matcher patterns, MFA enforcement, role redirects |
| `lib/db.ts` | Primary MySQL pool (`genthrust` database, 10 connections) |
| `lib/inventory-db.ts` | Bot inventory MySQL pool (`genthrust_inventory` database) |
| `lib/erp-aero.ts` | ERP AERO basic API client (simple token cache) |
| `lib/erp-client.ts` | ERP AERO production client (30-min TTL, 401 retry, paginated fetch) |
| `lib/bot-helpers.ts` | Bot fleet — BOT_REGISTRY, `sc query` status, log parsing, metrics, notification feed |
| `lib/mfa.ts` | MFA — TOTP generation, AES-256-GCM encrypt/decrypt, recovery codes, challenge tokens |
| `lib/password.ts` | bcrypt hash/verify (12 rounds) |
| `lib/animations.ts` | Framer Motion variants (30+ animation presets) |
| `lib/constants.ts` | Company info, nav links, services, stats, featured parts, contact info |
| `lib/utils.ts` | `cn()` Tailwind class merger utility |
| `mcp-servers/genthrust-bots/server.py` | Bot MCP server (8 tools, Python stdio) |
| `mcp-servers/genthrust-automation/server.py` | Automation MCP server (8 tools, Python stdio) |
| `.mcp.json` | MCP server registry (4 servers) |
| `tailwind.config.js` | Design system — colors, fonts, shadows, animations |
| `scripts/sync-parts.ts` | ERP → MySQL parts sync pipeline |
| `scripts/mfa-migration.sql` | MFA tables DDL (mfa_factors + mfa_recovery_codes) |
| `scripts/inventory-watchlist-migration.sql` | Watchlist table DDL |
| `scripts/create-clients-table.sql` | Clients table DDL |
| `types/automation.ts` | TypeScript types for Net30Order, FollowupRO, PurchaseOrder |
| `types/inventory.ts` | TypeScript types for Part, CatalogItem, DashboardStats |
| `types/next-auth.d.ts` | NextAuth session/JWT augmentation (role, mfaEnabled) |

---

*Generated from codebase analysis. Last updated: 2026-03-11.*
