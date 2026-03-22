# Genthrust XVII LLC — Next.js Dashboard & Portal

Aviation parts brokerage. Public website, internal dashboard (Entra ID), client portal (credentials + MFA).

## Tech Stack
Next.js 14, React 18, TypeScript, Tailwind CSS, MySQL (mysql2 + Drizzle), NextAuth 5, Three.js, Framer Motion

## Git
- Never add "Co-Authored-By" lines to git commit messages

## Critical Rules
- Two MySQL DBs: `genthrust` (port 3307, Docker) and `genthrust_inventory` (port 3306, native)
- Portal users start inactive — admin must activate via /internal/clients
- Edge-compatible auth: `auth.config.ts` has no Node.js-only imports
- Use `safeCount()`/`safeQuery()` wrappers for dashboard endpoints
- Contact email NOT implemented (TODO: Resend/SendGrid)

## Quick Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm test` — run tests

## Detailed Docs
- `docs/INDEX.md` — intent-based navigation ("I want to work on...")
- `docs/ARCHITECTURE.md` — system architecture, component patterns, theme
- `docs/API_REFERENCE.md` — all API routes with auth requirements
- `docs/DATABASE.md` — schema reference for both DBs
- `docs/AUTH.md` — authentication, MFA, middleware, audit logging
- `docs/BOTS.md` — bot fleet operations + ERP AERO integration
- `docs/QUICK_REF.md` — common tasks, gotchas, environment variables
