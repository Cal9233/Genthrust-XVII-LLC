# Database Reference — Genthrust XVII LLC

## Two MySQL Databases

| DB | Port | Connection | File |
|----|------|------------|------|
| `genthrust` | 3307 (Docker) | `query()` | `lib/db.ts` |
| `genthrust_inventory` | 3306 (native) | `inventoryQuery()` | `lib/inventory-db.ts` |

Both use mysql2/promise pools with `connectionLimit: 10`. Drizzle ORM wraps the main pool via `lib/db/index.ts` with schema from `lib/db/schema.ts`.

## genthrust DB (port 3307)

| Table | Key Columns |
|-------|-------------|
| `parts` | erp_product_id, product_name, mfr_part_no, nsn_number, cage_code, hazmat, product_category |
| `companies` | company_name, (customer/supplier directory) |
| `portal_users` | email, password_hash, contact_name, company_id, erp_contact_id, is_active |
| `mfa_factors` | user_id, secret (AES-256-GCM encrypted), verified, created_at |
| `mfa_recovery_codes` | user_id, code_hash (bcrypt), used |
| `repair_orders` | ro_number, vendor_name, status, priority, due_date, total |
| `repair_order_lines` | ro_id, part_number, description, qty, price |
| `sales_orders` | so_number, customer_po, customer_name, status, total |
| `sales_order_lines` | so_id, part_number, description, qty, price |
| `invoices` | invoice_no, account_name, status, due_date, open_balance |
| `invoice_lines` | invoice_id, description, qty, unit_price |
| `quotes` | Quote records |
| `rfqs` | Request for quote records |
| `documents` | Document metadata |
| `catalog_items` | Catalog entries |
| `clients` | Client records |
| `notification_queue` | Email notifications (Outlook integration) |
| `ro_status_history` | Repair order status changes |
| `ro_activity_log` | Field-level activity log |
| `ro_relations` | Links between repair orders |
| `files_upload` | File uploads to SharePoint |

**Auth.js tables** (Drizzle-managed): `users`, `accounts`, `sessions`, `verificationTokens`, `authenticators`

## genthrust_inventory DB (port 3306)

| Table | Purpose |
|-------|---------|
| `inventoryindex` | Part inventory snapshot |
| `shops` | Repair shop directory |
| `ils_pending_quotes` | ILS bot pending quotes |
| `sales_velocity` | Sales velocity data |
| `inventory_watchlist` | User watchlists |
| `inventory_alerts` | Stock level alerts |

## Dual Access Pattern

Raw SQL via `query()` from `lib/db.ts` AND Drizzle ORM via `lib/db/index.ts` (schema in `lib/db/schema.ts`). Both use the same pool. Inventory DB is separate — `genthrust_inventory` on port 3306 (native MySQL), `genthrust` on port 3307 (Docker).
