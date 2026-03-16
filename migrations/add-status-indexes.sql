-- ============================================================
-- Performance Migration: Status & Sort Column Indexes
-- Generated: 2026-03-14
-- Applies to: ERP-synced tables (repair_orders, sales_orders,
--             invoices, quote_requests, rfqs) and line-item
--             FK columns used in GROUP BY JOINs.
--
-- All statements use IF NOT EXISTS / CREATE INDEX ... to be
-- idempotent.  Run against the genthrust schema as the app user
-- or a DBA with ALTER privilege.
-- ============================================================

-- ============================================================
-- repair_orders
-- ============================================================

-- Status filter (WHERE status = ? / NOT IN (...))
ALTER TABLE repair_orders
  ADD INDEX IF NOT EXISTS idx_ro_status (status);

-- Sort column — every list page hits ORDER BY erp_modified_at DESC
ALTER TABLE repair_orders
  ADD INDEX IF NOT EXISTS idx_ro_modified (erp_modified_at);

-- Composite: status filter + sort (covers the most common query pattern)
ALTER TABLE repair_orders
  ADD INDEX IF NOT EXISTS idx_ro_status_modified (status, erp_modified_at);

-- Portal client filter (WHERE vendor_name = ?)
ALTER TABLE repair_orders
  ADD INDEX IF NOT EXISTS idx_ro_vendor_name (vendor_name);

-- ============================================================
-- repair_order_lines  (FK used in LEFT JOIN GROUP BY)
-- ============================================================

ALTER TABLE repair_order_lines
  ADD INDEX IF NOT EXISTS idx_rol_repair_order_id (repair_order_id);

-- ============================================================
-- sales_orders
-- ============================================================

ALTER TABLE sales_orders
  ADD INDEX IF NOT EXISTS idx_so_status (status);

ALTER TABLE sales_orders
  ADD INDEX IF NOT EXISTS idx_so_modified (erp_modified_at);

ALTER TABLE sales_orders
  ADD INDEX IF NOT EXISTS idx_so_status_modified (status, erp_modified_at);

-- Portal client filter (WHERE customer_name = ?)
ALTER TABLE sales_orders
  ADD INDEX IF NOT EXISTS idx_so_customer_name (customer_name);

-- ============================================================
-- sales_order_lines  (FK used in LEFT JOIN GROUP BY)
-- ============================================================

ALTER TABLE sales_order_lines
  ADD INDEX IF NOT EXISTS idx_sol_sales_order_id (sales_order_id);

-- ============================================================
-- invoices
-- ============================================================

ALTER TABLE invoices
  ADD INDEX IF NOT EXISTS idx_inv_status (status);

ALTER TABLE invoices
  ADD INDEX IF NOT EXISTS idx_inv_modified (erp_modified_at);

ALTER TABLE invoices
  ADD INDEX IF NOT EXISTS idx_inv_status_modified (status, erp_modified_at);

-- Portal client filter (WHERE account_name = ?)
ALTER TABLE invoices
  ADD INDEX IF NOT EXISTS idx_inv_account_name (account_name);

-- ============================================================
-- invoice_lines  (FK used in LEFT JOIN GROUP BY)
-- ============================================================

ALTER TABLE invoice_lines
  ADD INDEX IF NOT EXISTS idx_il_invoice_id (invoice_id);

-- ============================================================
-- quote_requests  (quotes module)
-- ============================================================

-- Status filter (WHERE status = ?)
ALTER TABLE quote_requests
  ADD INDEX IF NOT EXISTS idx_qr_status (status);

-- Sort column (ORDER BY received_at DESC)
ALTER TABLE quote_requests
  ADD INDEX IF NOT EXISTS idx_qr_received_at (received_at);

-- Composite for filtered list pages
ALTER TABLE quote_requests
  ADD INDEX IF NOT EXISTS idx_qr_status_received (status, received_at);

-- ============================================================
-- rfqs  (RFQ module)
-- ============================================================

ALTER TABLE rfqs
  ADD INDEX IF NOT EXISTS idx_rfq_status (status);
