# Architecture — Genthrust XVII LLC

## System Role

This project is the **public marketing website** for Genthrust XVII LLC. Business logic (portal, dashboard, ERP, email intelligence) lives in **genthrust-ai** (`~/Projects/genthrust/genthrust-ai`).

## Data Flow

| Flow | Entry | Auth | Purpose |
|------|-------|------|---------|
| **Public site** | `/` | None | Marketing pages |
| **Staff login** | Login button → Entra ID | `@genthrust.net` | SSO redirect to FlightDeck (genthrust-ai) |
| **Bot bridge** | genthrust-ai → `/api/internal/bots/*` | Bearer token via Cloudflare Tunnel | Bot fleet status and inventory |
| **Excel sync** | Trigger.dev cron | Microsoft Graph per-user OAuth | Sync repair orders to SharePoint Excel |
| **Contact form** | `/contact` → `/api/contact` | None | Resend email to sales@genthrust.net |

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

## Component Patterns

**Layout:** `Navbar` (with Login → SSO link), `Footer`

**UI Primitives:** `Button`, `GlassCard` (glass-morphism with backdrop-blur), `Dialog`, `Modal`, `Dropdown`, `SearchInput`, `ProgressBar`, `Spinner`, `Toggle`, `TypewriterText`, `AnimatedCounter`, `BorderBeam`, `DataPing`, `AnamorphicFlare`, `MagneticButton`, `ParticleBackground`

**Animation:** `AnimatedCounter`, `BorderBeam` (4s linear infinite), `DataPing`, `AnamorphicFlare`, `MagneticButton`, `ParticleBackground`

**3D:** `ParticleVertexAircraft` / `AircraftParticles` (Three.js via @react-three/fiber)

**Page Sections:** `HeroSection`, `CredentialsSection`, `ContactSection`, `ServicesBento`, `StatsBar`

## Theme Reference

From `tailwind.config.js`:

**Colors:** Navy `#1e4a8d` (primary), Burgundy `#9c2a3e` (secondary) — both have full 50-900 scales

**Status:** available `#059669`, limited `#d97706`, aog `#dc2626`

**Accent:** space `#020617`, aviation-red `#EF4444`, horizon-blue `#38B2AC`, silver `#F8FAFC`

**Fonts:** Inter (sans), JetBrains Mono (mono)

**Animations:** fade-in, fade-in-up, pulse-subtle, border-beam, scan-sweep, data-ping, horizon-drift

**Shadows:** card, card-hover, navy-focus

## Key Directories (this project)

| Path | What |
|------|------|
| `app/` | Next.js App Router (4 public pages + API routes) |
| `components/` | React components (ui/, layout/, sections/, Hero/, ParticleVertexAircraft/) |
| `lib/` | Utilities (db, graph, auth, rate-limit, bot-helpers, etc.) |
| `trigger/` | 2 Trigger.dev tasks (excel-sync, move-ro-sheet) |
| `hooks/` | Custom React hooks |
| `types/` | Global TypeScript declarations |
| `__tests__/` | Vitest test suite |

## Related Projects

| Path | Purpose |
|------|---------|
| `~/Projects/genthrust/genthrust-ai` | Full backend — FlightDeck dashboard, client portal, ERP, email intelligence |
| `~/Projects/genthrust/Genthrust_ILS_RFQ_Bot` | Python bot fleet (5 Windows services) |
| `~/Projects/genthrust/GENTHRUST_LLM` | Email agent + AI service |
