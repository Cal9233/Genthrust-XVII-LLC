-- Quote Requests & Responses schema
-- Ported from Genthrust_Inventory email/quote system
-- Renamed to QuoteRequest to avoid conflict with XVII Sales Quote

CREATE TABLE IF NOT EXISTS quote_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email_id VARCHAR(512) UNIQUE,
  sender_email VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255) DEFAULT '',
  subject VARCHAR(500) DEFAULT '',
  body LONGTEXT,
  part_numbers JSON,
  status ENUM('pending', 'processed', 'responded') DEFAULT 'pending',
  received_at DATETIME,
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_sender_email (sender_email),
  INDEX idx_received_at (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quote_responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quote_id INT NOT NULL,
  response_text LONGTEXT,
  part_number VARCHAR(100),
  price_quoted DECIMAL(12, 2),
  availability VARCHAR(255),
  sent_at DATETIME,
  sent_by VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_quote_responses_quote FOREIGN KEY (quote_id) REFERENCES quote_requests(id) ON DELETE CASCADE,
  INDEX idx_quote_id (quote_id),
  INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
