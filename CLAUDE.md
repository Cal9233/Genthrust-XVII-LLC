# Genthrust XVII LLC

Aviation parts brokerage — public website, internal dashboard (Entra ID SSO), client portal (credentials + MFA).

## Tech Stack

Next.js 14, React 18, TypeScript, Tailwind CSS, MySQL (mysql2 + Drizzle ORM), NextAuth 5 (Entra ID + credentials), Trigger.dev, AI SDK (Anthropic), Three.js, Framer Motion, Vitest, Upstash Redis, Microsoft Graph, npm

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
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema directly |
| `npm run db:studio` | Drizzle Studio GUI |

## Conventions

- Two MySQL DBs: `genthrust` (Drizzle-managed, main) and `genthrust_inventory` (bot inventory, separate connection via `lib/inventory-db.ts`)
- Three user roles: `admin` (cmalagon@genthrust.net), `internal` (@genthrust.net Entra), `client` (credentials + mandatory MFA)
- Edge-safe auth split: `auth.config.ts` (middleware, no Node imports) + `auth.ts` (full config with providers)
- Portal API routes are thin proxies to genthrust-ai backend (`GENTHRUST_AI_URL`)
- Trigger.dev tasks in `trigger/` — inbox monitor, RO lifecycle, Excel sync, daily digest
- CSP nonces generated per-request in `middleware.ts`
- `safeCount()`/`safeQuery()` wrappers required for dashboard DB endpoints
- Tests in `__tests__/` — Vitest + Testing Library + jsdom

## Gotchas

- Two separate DB env var sets required: `DB_*` (main) and `BOT_DB_*` (inventory)
- MFA_ENCRYPTION_KEY, SSO_REDIRECT_SECRET: generate with `openssl rand -hex 32`
- Upstash Redis optional — falls back to in-memory rate limiting if unset
- Monitor app uses mTLS certificate auth (PEM base64-encoded in MONITOR_APP_CERT_PEM)
- `ENTRA_TENANT_ID` and `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` must match
- Contact email: Resend key optional, falls back to console.log
- FlightDeck SSO: internal users redirect to genthrust-ai app via signed JWT
- Portal users start inactive — admin must activate via /internal/clients

## Git

- Never add "Co-Authored-By" lines to commit messages

## Key Files

- `@lib/db/schema.ts` — Drizzle schema (main DB tables)
- `@lib/inventory-db.ts` — Bot inventory DB connection
- `@auth.config.ts` — Edge-safe NextAuth config (role routing, MFA gate)
- `@auth.ts` — Full NextAuth config with Entra ID + credentials providers
- `@middleware.ts` — CSP nonces, route auth
- `@drizzle.config.ts` — Drizzle Kit config (MySQL)
- `@trigger.config.ts` — Trigger.dev project config
- `@lib/graph/daemon-client.ts` — MS Graph daemon client (mTLS cert auth)
- `@lib/mfa.ts` — TOTP MFA implementation
- `@lib/erp-client.ts` — ERP AERO API client

## Deep Context

- `@docs/INDEX.md` — Intent-based navigation ("I want to work on...")
- `@docs/ARCHITECTURE.md` — System architecture, component patterns, theme
- `@docs/API_REFERENCE.md` — All API routes with auth requirements
- `@docs/DATABASE.md` — Schema reference for both DBs
- `@docs/AUTH.md` — Authentication, MFA, middleware, audit logging
- `@docs/BOTS.md` — Bot fleet operations + ERP AERO integration
- `@docs/QUICK_REF.md` — Common tasks, gotchas, env vars
- `@docs/EMAIL_INTELLIGENCE_SETUP.md` — Email intelligence pipeline

## Rules

Do not make changes until 95% confident in what needs to be built. Ask follow-up questions first.
