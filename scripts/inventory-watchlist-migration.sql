-- Inventory Watchlist table for the alarm monitoring system
-- Run against: genthrust_inventory database (port 3306)

CREATE TABLE IF NOT EXISTS inventory_watchlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  part_number VARCHAR(100) NOT NULL,
  condition_code ENUM('OH','AR','NE','SV') NOT NULL,
  description VARCHAR(500) NULL,
  added_by VARCHAR(255) NOT NULL,
  last_known_qty INT NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMP NULL,
  is_active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_part_condition (part_number, condition_code),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
