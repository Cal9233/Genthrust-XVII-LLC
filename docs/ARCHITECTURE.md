# Architecture — Genthrust XVII LLC

## Data Flow

| Flow | Entry | Auth | Data Source |
|------|-------|------|-------------|
| **Public site** | `/` → parts search | None | `parts` table via LIKE queries |
| **Internal dashboard** | `/signin` → `/internal/*` | Microsoft Entra ID (`@genthrust.net`) | MySQL + ERP AERO API |
| **Client portal** | `/login` → `/portal/*` | Credentials (bcryptjs) | Company-scoped MySQL queries |
| **ERP sync** | Bot fleet + `/api/internal/sync/parts` | ERP AERO token | ERP AERO REST → MySQL cache |
| **Registration** | `/register` → `/api/register` | None | Creates inactive `portal_user`, admin activates via `/internal/clients` |

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

## Key Directories

| Path | What |
|------|------|
| `~/Projects/genthrust/Genthrust-XVII-LLC` | This project (Next.js app) |
| `~/Projects/genthrust/Genthrust_ILS_RFQ_Bot` | Python bot fleet (5 bots) |
| `~/Projects/genthrust/GENTHRUST_LLM` | Email agent + AI service |
| `~/Projects/genthrust/genthrust-parts-agent` | WhatsApp parts lookup |
