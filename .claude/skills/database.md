---
description: Working with database schema, migrations, Drizzle ORM, or SQL queries
globs: ["lib/db/**", "lib/inventory-db.ts", "drizzle.config.ts", "drizzle/**", "lib/db.ts"]
---

Load @docs/DATABASE.md for full dual-database reference.

Two separate databases:
- genthrust (port 3307, Docker) — main app DB, Drizzle-managed
  - Raw SQL: query() from lib/db.ts
  - Drizzle ORM: db from lib/db/index.ts, schema at @lib/db/schema.ts
- genthrust_inventory (port 3306, native MySQL) — bot inventory DB
  - Access via inventoryQuery() from @lib/inventory-db.ts

IMPORTANT: Use safeCount()/safeQuery() wrappers for all dashboard DB endpoints — never raw queries.

Schema changes: edit @lib/db/schema.ts → npm run db:generate → npm run db:migrate.
Never use npm run db:push in production — migrations only.
Config: @drizzle.config.ts (uses DB_* env vars, not BOT_DB_*).
