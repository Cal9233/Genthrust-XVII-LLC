# Project Instructions for Claude

## Git Commits
- Never add "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>" or any similar co-author line to git commit messages

## Ecosystem Overview

This is the **Genthrust Website** — the central hub for Genthrust XVII LLC's aviation brokerage operations.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, MySQL (Docker port 3307), NextAuth 5 (Entra ID + Credentials)

### MCP Servers (Project-Scoped via `.mcp.json`)

| Server | Purpose |
|--------|---------|
| `microsoft-365` | Email, calendar, OneDrive, SharePoint via MS Graph API |
| `mysql` | Read-only access to the `genthrust` database (port 3307) |
| `genthrust-bots` | Bot fleet monitoring — statuses, logs, metrics, inventory |
| `genthrust-automation` | ERP AERO API — repair orders, purchase orders, NET30 reminders |
| `sequential-thinking` | Structured multi-step reasoning |
| `filesystem` | File read/write across Genthrust projects |
| `fetch` | HTTP requests to external APIs |

### Key Directories

| Path | What |
|------|------|
| `C:\Genthrust_Website\genthrust-ui\Genthrust-XVII-LLC` | This project (Next.js app) |
| `C:\GenthrustBot` | Python bot fleet (5 bots as Windows services) |
| `C:\GenThrust\automation` | Python NET30 reminders, RO digest, ERP client |
| `C:\Users\GEN_AI\mcp-servers\ms365` | Microsoft 365 MCP server |

### Database

- **Host:** localhost:3307 (Docker MySQL)
- **Database:** `genthrust`
- **Tables:** parts, companies, repair_orders, sales_orders, invoices, quotes, rfqs, documents, catalog_items, portal_users
- **Connection:** `lib/db.ts` (mysql2/promise pool)

### Bot Fleet (via genthrust-bots MCP)

| Bot | Service Name | Function |
|-----|-------------|----------|
| ILS Sniper | GT-ILS-Bot | Monitors ILS marketplace, creates quote drafts |
| Internal Auditor | GT-Internal-Bot | Processes VIP supplier requests |
| OneDrive Sync | GT-Sync-Bot | Syncs inventory from OneDrive |
| AOG Monitor | GT-AOG-Bot | Monitors diverted flights for leads |
| Inventory Intelligence | GT-Inventory-Bot | Tracks sales velocity and stock alerts |

### API Routes

- **Public:** `/api/auth/*`, `/api/contact`, `/api/search`, `/api/register/*`
- **Internal:** `/api/internal/*` (dashboard, clients, invoices, repair-orders, sales-orders)
- **Portal:** `/api/portal/*` (customer-facing document access)
- **MCP:** `/api/mcp` (HTTP MCP endpoint for Claude Desktop)
