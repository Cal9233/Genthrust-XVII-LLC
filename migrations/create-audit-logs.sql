-- Audit Logs table
-- Tracks all user actions, API requests, and system events for compliance and debugging.

CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  user_id         VARCHAR(255)          NULL,
  user_email      VARCHAR(255)          NULL,
  user_role       ENUM('internal', 'client', 'system') NULL,
  action          VARCHAR(50)           NOT NULL,
  resource_type   VARCHAR(50)           NULL,
  resource_id     VARCHAR(255)          NULL,
  ip_address      VARCHAR(45)           NULL,
  user_agent      TEXT                  NULL,
  method          VARCHAR(10)           NULL,
  path            VARCHAR(500)          NULL,
  status_code     SMALLINT UNSIGNED     NULL,
  success         BOOLEAN               NOT NULL DEFAULT TRUE,
  error_message   TEXT                  NULL,
  metadata        JSON                  NULL,
  duration_ms     INT UNSIGNED          NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Query by time range (retention sweeps, dashboards)
CREATE INDEX idx_audit_timestamp  ON audit_logs (timestamp);

-- User activity lookup
CREATE INDEX idx_audit_user       ON audit_logs (user_id, timestamp);

-- Action-type filtering (e.g. all LOGIN_FAILED in last 24h)
CREATE INDEX idx_audit_action     ON audit_logs (action, timestamp);

-- Resource history (who touched this repair_order?)
CREATE INDEX idx_audit_resource   ON audit_logs (resource_type, resource_id);

-- IP-based forensics
CREATE INDEX idx_audit_ip         ON audit_logs (ip_address, timestamp);
