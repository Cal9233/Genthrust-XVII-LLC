-- Migration: add-legacy-table-indexes
-- Purpose: Add indexes on the legacy `active` table imported from Excel.
--          Without these, every list_repair_orders AI chat query is a full table scan.
-- Author: backend-engineer
-- Date: 2026-03-18
--
-- Note: MySQL does not support "IF NOT EXISTS" on ALTER TABLE ADD INDEX.
--       These statements are idempotent when run via a migration runner that
--       checks whether the index already exists (e.g. Flyway, Liquibase).
--       If running manually, check INFORMATION_SCHEMA.STATISTICS first.

-- Index for shop name filter (supports LIKE '%shopName%' prefix scans when
-- used with a leading wildcard; primarily helps equality and prefix queries)
ALTER TABLE active ADD INDEX idx_active_shop_name (shopName(191));

-- Index for status filter (JS-side filtering still applies, but covering the
-- column lets the engine avoid reading full rows for future SQL-side filters)
ALTER TABLE active ADD INDEX idx_active_current_status (currentStatus(191));
