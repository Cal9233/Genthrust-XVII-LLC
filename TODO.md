# Remaining Tasks & Known Issues

## Uncommitted Work (38 modified + 29 new files)
All changes from today's ecosystem audit are uncommitted. Git identity needs to be configured to commit:
```bash
git config user.name "Cal9233"
git config user.email "Cal9233@users.noreply.github.com"
git add -A && git commit -m "Dashboard restructure, security hardening, and production readiness"
git push -u origin ecosystem-audit-security-hardening
```

## Cleanup Tasks (Quick)

- [ ] **Delete empty directories**: `app/internal/inventory-intelligence/`, `app/internal/inventory-alarms/`, `app/internal/quotes/` — pages moved to Bots tab sub-tabs
- [ ] **Delete legacy detail pages** (replaced by ERP tab modal drawers):
  - `app/internal/invoices/[id]/page.tsx`
  - `app/internal/repair-orders/[id]/page.tsx`
  - `app/internal/sales-orders/[id]/page.tsx`
- [ ] **Pop or drop git stash**: `git stash list` shows old stash from before the pull. Review if needed or drop with `git stash drop`

## Azure AD / Microsoft SSO (Blocking for Internal Login)

- [ ] **Verify Azure App Registration** for "Genthrust Website" (App ID: `REDACTED_ENTRA_APP_ID`):
  - Redirect URI must include: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
  - For production: `https://yourdomain.com/api/auth/callback/microsoft-entra-id`
- [ ] **Verify .env.local** has correct values:
  - `AUTH_MICROSOFT_ENTRA_ID_ID` = App (client) ID
  - `AUTH_MICROSOFT_ENTRA_ID_SECRET` = Valid client secret (check expiry)
  - `AUTH_MICROSOFT_ENTRA_ID_ISSUER` = `https://login.microsoftonline.com/<tenant-id>/v2.0`
- [ ] **Test Internal login flow** after Azure config is verified

## New Environment Variable

- `MCP_ALLOW_UNAUTHENTICATED=true` — Add to .env.local ONLY if you want unauthenticated MCP access (default: deny)

## Features to Test

- [ ] **Dashboard** (`/internal`) — New overview cards showing status of all systems
- [ ] **Bots tab** (`/internal/bots`) — 4 sub-tabs: Fleet, Inventory Intel, Alarms, Quotes
- [ ] **ERP tab** (`/internal/erp`) — RO/SO/Invoice tables with slide-in detail drawers
- [ ] **Automation tab** (`/internal/automation`) — Email tools + ERP sync trigger sections
- [ ] **Clients tab** (`/internal/clients`) — Company directory with search/sort
- [ ] **AI Chat** — Floating chat button (bottom-right), data-aware responses
- [ ] **PDF Upload** — Inventory Intelligence PDF drop → parse → batch search
- [ ] **Add Inventory** — New form to POST inventory items to MySQL
- [ ] **Hero section** — Aviation-inspired redesign, no internal tool references
- [ ] **Error boundaries** — Test /nonexistent-page for 404, check loading states
- [ ] **Security headers** — Verify X-Frame-Options, CSP headers in browser dev tools

## Known Pre-existing Issues (Not Addressed)

- `trigger.config.ts` has a TypeScript error (missing `maxDuration` property) — this is a trigger.dev config file, not part of the main app
- Ports 3000-3008 may accumulate stale Node processes — kill with `powershell.exe -Command "Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`

## What Was Done Today

### Security Hardening (10 fixes)
- MCP auth deny-by-default, MFA timing-safe comparison, portal role checks
- Rate limiting on login/register/search, session type augmentation
- Admin create-client table fix, role-based auth on clients route

### Backend Fixes (12 fixes)
- Contact XSS, ERP token race conditions, bot restart async
- Security headers, error detail stripping, PDF parser UUIDs

### Auth Flow Fixes (Critical)
- Client-as-admin exploit blocked at 3 layers
- Microsoft SSO `prompt: select_account` added
- Favicon rewrite rule

### Internal API Route Fixes
- Command injection fix in automation preview
- Shared mutable state fix in inventory-intelligence
- Input validation on inventory-alarms acknowledge
- Structured error logging across 20+ routes

### Production Readiness (9 new files)
- Error boundaries (root, internal, portal)
- Loading skeletons (root, internal, portal)
- 404 page, robots.ts, sitemap.ts

### Dashboard Restructure (17+ files)
- New TabNav replacing InternalNav
- Dashboard overview with 6 health status cards + aggregation API
- Bots tab with 4 sub-tabs (Fleet, Inventory, Alarms, Quotes)
- ERP tab with detail drawer modals
- Automation tab with email tools + sync trigger
- Clients tab with company directory
- AI Chat panel with data-aware context injection

### Hero Redesign
- Aviation-inspired InstrumentCluster with public-facing content
- Removed all internal tool references from public homepage
