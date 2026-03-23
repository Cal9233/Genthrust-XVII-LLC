-- Migration: create-users-v2
-- Purpose: Unified users table combining portal_users (clients) and internal/admin team members
--          into a single table with a 3-role system (admin | internal | client).
--
-- CRITICAL: mfa_factors and mfa_recovery_codes reference portal_users.id via FK.
-- We preserve portal_users intact. users_v2 stores portal_user_id (the original
-- portal_users.id) for migrated client rows so auth can still look up MFA factors
-- by that legacy ID. New client registrations must insert into BOTH portal_users
-- (to get an MFA-compatible ID) and users_v2.
--
-- Author: backend-engineer
-- Date: 2026-03-22

CREATE TABLE IF NOT EXISTS users_v2 (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role ENUM('admin', 'internal', 'client') NOT NULL DEFAULT 'client',
  password_hash VARCHAR(255),
  -- portal_user_id: links back to portal_users.id for MFA factor FK resolution.
  -- NULL for admin/internal users who do not have MFA through portal_users.
  portal_user_id INT,
  company_id INT,
  erp_contact_id INT,
  mfa_enabled TINYINT NOT NULL DEFAULT 0,
  is_active TINYINT NOT NULL DEFAULT 0,
  last_login DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  INDEX idx_users_v2_role (role),
  INDEX idx_users_v2_company (company_id),
  INDEX idx_users_v2_email_active (email, is_active),
  INDEX idx_users_v2_portal_user_id (portal_user_id)
);

-- Migrate portal_users data.
-- SUBSTRING_INDEX handles edge cases: single-word names get the same word as both
-- first and last (e.g. 'Acme' → first_name='Acme', last_name='Acme').
-- Duplicate emails are silently ignored (INSERT IGNORE) if migration is re-run.
INSERT IGNORE INTO users_v2 (
  email, first_name, last_name, role,
  password_hash, portal_user_id, company_id, erp_contact_id,
  mfa_enabled, is_active, created_at, updated_at
)
SELECT
  email,
  SUBSTRING_INDEX(contact_name, ' ', 1) AS first_name,
  CASE
    WHEN LOCATE(' ', contact_name) > 0 THEN SUBSTRING_INDEX(contact_name, ' ', -1)
    ELSE contact_name
  END AS last_name,
  'client' AS role,
  password_hash,
  id AS portal_user_id,
  company_id,
  erp_contact_id,
  mfa_enabled,
  is_active,
  created_at,
  updated_at
FROM portal_users;

-- Seed admin (Cal)
INSERT IGNORE INTO users_v2 (email, first_name, last_name, role, is_active)
VALUES ('cmalagon@genthrust.net', 'Calvin', 'Malagon', 'admin', 1);

-- Seed internal team
INSERT IGNORE INTO users_v2 (email, first_name, last_name, role, is_active)
VALUES
  ('jmalagon@genthrust.net',    'Jose',     'Malagon',   'internal', 1),
  ('sgallagher@genthrust.net',  'Sandra',   'Gallagher', 'internal', 1),
  ('ogonzalez@genthrust.net',   'Oscar',    'Gonzalez',  'internal', 1),
  ('pflaviani@genthrust.net',   'Patricia', 'Flaviani',  'internal', 1);
