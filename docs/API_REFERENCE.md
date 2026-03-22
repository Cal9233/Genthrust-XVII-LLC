# API Reference — Genthrust XVII LLC

## Public (no auth)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handler |
| `/api/auth/verify-credentials` | POST | Pre-login MFA token generation (rate limited: 5/60s) |
| `/api/contact` | POST | Contact form (logs only — email NOT implemented, TODO: Resend/SendGrid) |
| `/api/search` | GET | Parts search (`?q=`) — LIKE queries on parts table |
| `/api/clients` | GET | Public client listing |
| `/api/register` | POST | Create inactive portal user (rate limited: 3/hr) |
| `/api/register/companies` | GET | Company list for registration dropdown |
| `/api/mcp` | GET/POST/DELETE | MCP HTTP endpoint — 10 AI tools (auth: MCP_API_KEY or MCP_ALLOW_UNAUTHENTICATED) |
| `/api/admin/create-client` | POST | Admin client creation |

## Internal (requires `role: 'internal'`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/internal/dashboard` | GET | Dashboard stats (uses `safeCount()`/`safeQuery()` wrappers) |
| `/api/internal/clients` | GET/POST/PUT/DELETE | Client CRUD + portal user activation |
| `/api/internal/invoices` | GET | Invoice list |
| `/api/internal/invoices/[id]` | GET | Invoice detail |
| `/api/internal/repair-orders` | GET | Repair order list |
| `/api/internal/repair-orders/[id]` | GET | Repair order detail |
| `/api/internal/sales-orders` | GET | Sales order list |
| `/api/internal/sales-orders/[id]` | GET | Sales order detail |
| `/api/internal/bots` | GET | Bot fleet statuses |
| `/api/internal/bots/logs` | GET | Bot log tails |
| `/api/internal/bots/restart` | POST | Restart a bot service |
| `/api/internal/bots/inventory` | GET | Bot inventory data (uses `safeQuery()`) |
| `/api/internal/automation` | GET | Automation data |
| `/api/internal/automation/preview` | GET | Automation preview |
| `/api/internal/inventory-intelligence` | GET | Inventory analytics (uses `safeQuery()`) |
| `/api/internal/inventory-intelligence/search` | GET | Inventory search |
| `/api/internal/sync/parts` | POST | Pull parts from ERP AERO into MySQL |
| `/api/internal/email` | GET/POST | Email drafts via Outlook (Microsoft Graph) |
| `/api/internal/quotes` | GET | Quote management |
| `/api/internal/audit-log` | GET | Access log with timestamp filtering |
| `/api/internal/status-overview` | GET | Aggregated health status for dashboard cards |
| `/api/internal/inventory-alarms` | GET/POST | Watchlist + stock alert management |

## Portal (requires `role: 'client'`, company-scoped)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/portal/dashboard` | GET | Client dashboard |
| `/api/portal/invoices/[id]` | GET | Client's invoice |
| `/api/portal/repair-orders/[id]` | GET | Client's repair order |
| `/api/portal/sales-orders/[id]` | GET | Client's sales order |
| `/api/portal/mfa/enroll` | POST | MFA TOTP enrollment |
| `/api/portal/mfa/disable` | POST | MFA disabling |
| `/api/portal/mfa/challenge` | POST | TOTP challenge verification |
