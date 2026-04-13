# Bot Fleet — Genthrust XVII LLC

## Architecture

The Python bot fleet runs as Windows services on-prem. genthrust-ai calls this project's bot API routes via **Cloudflare Tunnel** (bearer token auth) to get fleet status and inventory data.

```
genthrust-ai (tRPC botsRouter)
  → Cloudflare Tunnel (BOT_BRIDGE_URL, bearer token)
  → XVII-LLC /api/internal/bots/**
  → lib/bot-helpers.ts (sc query) + lib/inventory-db.ts
```

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

## Bot API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/internal/bots` | GET | Fleet status for all 5 bots |
| `/api/internal/bots/inventory` | GET | Inventory snapshot from `genthrust_inventory` DB |
| `/api/internal/bots/logs` | GET | Log tail for specified bot |
| `/api/internal/bots/restart` | POST | Restart a bot Windows service |

## Key Files

- `lib/bot-helpers.ts` — `sc query` wrapper, log parsing, metrics extraction
- `lib/inventory-db.ts` — `genthrust_inventory` DB connection (port 3306)

## Environment Variables

```
# Bot inventory DB (port 3306, native MySQL)
BOT_DB_HOST, BOT_DB_PORT, BOT_DB_NAME, BOT_DB_USER, BOT_DB_PASSWORD

# Cloudflare Tunnel auth (used by genthrust-ai to call bot routes)
BOT_BRIDGE_SECRET
```
