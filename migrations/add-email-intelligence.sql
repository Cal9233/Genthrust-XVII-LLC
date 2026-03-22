-- Email Intelligence System — Database Schema
-- Created: 2026-03-17
-- Purpose: Tables for email monitoring state, processing log, and configurable rules
-- Run against: genthrust database (port 3307)

-- Delta link + heartbeat state per monitored mailbox
CREATE TABLE IF NOT EXISTS email_monitor_state (
  mailbox_id VARCHAR(255) PRIMARY KEY,
  mailbox_address VARCHAR(255) NOT NULL,
  delta_link TEXT DEFAULT NULL,
  last_poll_at TIMESTAMP NULL,
  last_success_at TIMESTAMP NULL,
  emails_processed INT DEFAULT 0,
  error_count INT DEFAULT 0,
  enabled TINYINT(1) DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mailbox_address (mailbox_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add unique constraint to existing table (safe no-op if already present)
ALTER TABLE email_monitor_state
  ADD UNIQUE IF NOT EXISTS uq_mailbox_address (mailbox_address);

-- Minimal email processing log (PII-minimized — stores domain only, not full address)
CREATE TABLE IF NOT EXISTS email_monitor_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email_graph_id VARCHAR(500) NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  mailbox_id_ref VARCHAR(255) NOT NULL,
  sender_domain VARCHAR(255),
  score TINYINT NOT NULL,
  score_method ENUM('rules', 'llm') NOT NULL,
  notification_tier ENUM('urgent', 'important', 'low', 'skipped') NOT NULL,
  ro_match VARCHAR(50) DEFAULT NULL,
  task_match TINYINT(1) DEFAULT 0,
  dispatched_at TIMESTAMP NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_graph_id (email_graph_id),
  INDEX idx_content_hash (content_hash),
  INDEX idx_processed_at (processed_at),
  INDEX idx_mailbox_time (mailbox_id_ref, processed_at),
  INDEX idx_tier_dispatched (notification_tier, dispatched_at),
  -- Covers: WHERE notification_tier = ? ORDER BY processed_at DESC LIMIT N
  -- Used by /api/internal/email/monitor for recent urgent alerts
  INDEX idx_tier_processed_at (notification_tier, processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- VIP / blocklist / keyword configuration (admin-editable via dashboard)
CREATE TABLE IF NOT EXISTS email_monitor_rules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rule_type ENUM('vip', 'blocklist', 'keyword_boost', 'keyword_suppress') NOT NULL,
  pattern VARCHAR(255) NOT NULL,
  score_effect TINYINT DEFAULT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rule_type (rule_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
