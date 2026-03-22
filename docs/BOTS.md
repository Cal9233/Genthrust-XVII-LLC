# Bot Fleet & ERP Integration — Genthrust XVII LLC

## Bot Fleet

5 Python bots running as Windows services, monitored via `sc query` in `lib/bot-helpers.ts`.

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
- **Basic client:** `lib/erp-aero.ts` — simple token + fetch, auto-retry on 401
- **Production client:** `lib/erp-client.ts` — 30-min token TTL, single concurrent auth request (prevents thundering herd)
- **Auth:** POST `/v1/auth/signin` with form-encoded cid/email/password
- **Functions:** `getPartsList(page, pageSize)`, `getPartDetails(productId)`, `clearTokenCache()`
- **Sync endpoint:** `/api/internal/sync/parts` pulls parts into MySQL `parts` table
- **Sync script:** `scripts/sync-parts.ts` (also via trigger.dev)
- **Automation:** NET30 payment reminders, RO digests via `genthrust-automation` MCP server
