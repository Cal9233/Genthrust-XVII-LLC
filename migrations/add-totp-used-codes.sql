CREATE TABLE IF NOT EXISTS totp_used_codes (
  user_id INT NOT NULL,
  code CHAR(6) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, code),
  INDEX idx_used_at (used_at)
);
