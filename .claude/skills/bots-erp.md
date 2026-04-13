---
description: Working with bot fleet, ERP AERO integration, or inventory sync
globs: ["lib/erp-client.ts", "lib/erp-aero.ts", "lib/inventory-db.ts", "lib/bot-helpers.ts", "app/api/internal/bots/**", "app/api/internal/erp/**", "app/api/internal/sync/**", "scripts/sync-parts.ts"]
---

Load @docs/BOTS.md for bot fleet operations and ERP integration.

Two ERP clients — use the right one:
- @lib/erp-client.ts — Production client: 30-min token TTL, shared authPromise prevents thundering herd, module-level singleton
- @lib/erp-aero.ts — Basic client: simple token + fetch, auto-retry on 401 only

Bot fleet: 5 Python Windows services monitored via `sc query` in lib/bot-helpers.ts.
Service names: GT-ILS-Bot, GT-Internal-Bot, GT-Sync-Bot, GT-AOG-Bot, GT-Inventory-Bot.

Inventory DB (@lib/inventory-db.ts) is separate from the main DB — uses BOT_DB_* env vars, port 3306.
ERP base URL: https://wapi.erp.aero — auth via POST /v1/auth/signin with form-urlencoded body.
