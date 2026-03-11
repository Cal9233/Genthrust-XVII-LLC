-- MFA Migration for portal_users
-- Run against the `genthrust` database

-- Add MFA flag to portal_users (denormalized for fast lookup)
ALTER TABLE portal_users
  ADD COLUMN mfa_enabled TINYINT NOT NULL DEFAULT 0 AFTER is_active;

-- TOTP factor storage
CREATE TABLE mfa_factors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  factor_type ENUM('totp') NOT NULL DEFAULT 'totp',
  secret_encrypted VARCHAR(512) NOT NULL,
  secret_iv VARCHAR(64) NOT NULL,
  secret_auth_tag VARCHAR(64) NOT NULL,
  status ENUM('pending', 'verified') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP NULL,
  UNIQUE KEY uq_user_factor (user_id, factor_type),
  FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Recovery codes
CREATE TABLE mfa_recovery_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE,
  INDEX idx_user_unused (user_id, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
