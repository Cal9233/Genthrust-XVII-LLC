# Genthrust XVII LLC

Aviation parts brokerage — **marketing frontend** with a Login button that SSO-redirects staff to genthrust-ai (FlightDeck). Backend logic lives in genthrust-ai (`~/Projects/genthrust/genthrust-ai`). This project retains bot management API routes (genthrust-ai proxies to these) and Excel sync tasks (no Temporal equivalent yet).

## Tech Stack

Next.js 14, React 18, TypeScript, Tailwind CSS, MySQL (mysql2 + Drizzle ORM), NextAuth 5 (Entra ID only), Trigger.dev, Three.js, Framer Motion, Vitest, Upstash Redis, Microsoft Graph, Resend, npm

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm test` | Vitest (watch) |
| `npm run test:run` | Vitest (single run) |
| `npm run format` | Prettier |

## Conventions

- Auth is Entra ID only — only `@genthrust.net` staff can authenticate
- Role determined by email: `cmalagon@genthrust.net` → `admin`, all others → `internal`
- Login button → `/api/auth/signin/microsoft-entra-id?callbackUrl=/api/internal/sso/flightdeck` → signed JWT → genthrust-ai
- Bot routes at `/api/internal/bots/**` are called by genthrust-ai via Cloudflare Tunnel (bearer token auth)
- Two MySQL connections: main DB (`DB_*` env vars, port 3307) for Excel sync + OAuth accounts; bot inventory (`BOT_DB_*` env vars, port 3306)
- Trigger.dev tasks in `trigger/` — excel-sync, move-ro-sheet (Excel write-back to SharePoint; no Temporal equivalent yet)
- CSP nonces generated per-request in `middleware.ts`
- Tests in `__tests__/` — Vitest + Testing Library + jsdom
- Prefer `npm run test:run -- path/to/test` for targeted runs over the full suite

## Gotchas

- Two separate DB env var sets required: `DB_*` (main) and `BOT_DB_*` (inventory) — mixing them silently corrupts data
- `ENTRA_TENANT_ID` and `AUTH_MICROSOFT_ENTRA_ID_ISSUER` tenant must match — mismatch breaks SSO silently
- Monitor app uses mTLS certificate auth (PEM base64-encoded in `MONITOR_APP_CERT_PEM`)
- Upstash Redis optional — falls back to in-memory rate limiting if unset
- Contact email: Resend key optional, falls back to console.log
- FlightDeck SSO: `lib/sso-redirect.ts` generates the signed token, genthrust-ai verifies it at `/api/auth/sso-redirect`
- `EXCEL_WORKBOOK_ID` must be set for Excel sync tasks to work
- `SSO_REDIRECT_SECRET` must match between XVII-LLC (sender) and genthrust-ai (receiver)

## Git

- Never add "Co-Authored-By" lines to commit messages

## Key Files

- `@auth.ts` — NextAuth config (Entra ID only)
- `@auth.config.ts` — Edge-safe NextAuth config
- `@middleware.ts` — CSP nonces, `/api/internal` route protection
- `@lib/sso-redirect.ts` — SSO token generator (signed JWT for FlightDeck)
- `@lib/bot-helpers.ts` — Bot fleet status via `sc query`
- `@lib/inventory-db.ts` — Bot inventory DB connection
- `@lib/db.ts` — Main MySQL pool
- `@lib/db/schema.ts` — Drizzle schema (active table + OAuth accounts)
- `@lib/graph/index.ts` — Microsoft Graph client (per-user OAuth tokens)
- `@trigger.config.ts` — Trigger.dev project config
- `@components.json` — shadcn/ui component configuration

## Codebase Router

Use this map to locate files by task area.

**Auth & Session:** `auth.ts`, `auth.config.ts` (edge), `middleware.ts`, `lib/sso-redirect.ts`, `types/next-auth.d.ts`

**Database:** `lib/db.ts` (main MySQL pool), `lib/db/index.ts` + `lib/db/schema.ts` (Drizzle — `active` + `accounts` tables), `lib/inventory-db.ts` (bot inventory DB)

**API Routes:**
- Public: `app/api/contact/` (contact form), `app/api/auth/[...nextauth]/` (NextAuth handler)
- Staff-only: `app/api/internal/bots/` (fleet status, inventory, logs, restart), `app/api/internal/sso/flightdeck/` (SSO redirect to genthrust-ai)

**Public Pages:** `app/page.tsx` (home), `app/about/page.tsx`, `app/services/page.tsx`, `app/contact/page.tsx`

**Frontend Components:**
- Layout: `components/layout/Navbar.tsx`, `components/layout/Footer.tsx`
- Sections: `components/sections/` (HeroSection, ContactSection, ServicesBento, StatsBar, CredentialsSection)
- Hero animation: `components/Hero/`
- 3D aircraft: `components/ParticleVertexAircraft/`
- UI primitives: `components/ui/` (Button, Dialog, Modal, GlassCard, Dropdown, SearchInput, etc.)
- Templates: `components/templates/PageTemplate.tsx`

**Microsoft Graph / Excel Sync:** `lib/graph/index.ts`, `lib/graph/excel-mapping.ts`, `lib/graph/excel-search.ts`, `lib/graph/batch.ts`, `lib/types/graph.ts`

**Background Tasks:** `trigger/excel-sync.ts` (sync ROs to SharePoint Excel), `trigger/move-ro-sheet.ts` (move RO between Excel sheets)

**Rate Limiting:** `lib/rate-limit.ts` (Upstash Redis / in-memory fallback)

**Utilities:** `lib/utils.ts`, `lib/constants.ts`, `lib/animations.ts`, `lib/date-utils.ts`, `lib/audit-logger.ts`

**Tests:** `__tests__/` (api/internal/bots-api, api/internal/sso-flightdeck, api/contact, trigger-exports, middleware, components, lib)

**Hooks:** `hooks/useReducedMotion.ts`, `hooks/useWebGLCapabilities.ts`

**Types:** `types/next-auth.d.ts`, `types/three-jsx.d.ts`, `types/inventory.ts`

## Deep Context

- `@docs/INDEX.md` — Intent-based navigation ("I want to work on...")
- `@docs/ARCHITECTURE.md` — System architecture, component patterns, theme
- `@docs/API_REFERENCE.md` — All API routes with auth requirements
- `@docs/DATABASE.md` — Schema reference for both DBs
- `@docs/AUTH.md` — Authentication, SSO flow, middleware
- `@docs/BOTS.md` — Bot fleet operations
- `@docs/QUICK_REF.md` — Common tasks, gotchas, env vars

## Rules

- Do not make changes until 95% confident in what needs to be built. Ask follow-up questions first.
- Run `npm run build` to verify TypeScript compiles after editing `.ts`/`.tsx` files.
- Prefer small, focused diffs — do not refactor surrounding code unless asked.
- Do not modify `auth.config.ts` without verifying edge compatibility (no Node.js-only imports).
