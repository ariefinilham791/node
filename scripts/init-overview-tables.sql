-- Overview demo datasets → MySQL tables
-- Jalankan di database yang sama dengan aplikasi (default: dc_monitoring)
-- Contoh:
--   mysql -h localhost -P 3306 -u app_user -p dc_monitoring < scripts/init-overview-tables.sql

CREATE TABLE IF NOT EXISTS overview_agents (
  agent_id VARCHAR(32) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  account VARCHAR(255) NOT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME NULL,
  number VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  registered TINYINT(1) NOT NULL DEFAULT 0,
  minutes_called INT NOT NULL DEFAULT 0,
  minutes_booked INT NOT NULL DEFAULT 0,
  ticket_generation TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS overview_support_tickets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  created DATETIME NOT NULL,
  status VARCHAR(32) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(32) NOT NULL,
  category VARCHAR(64) NOT NULL,
  type VARCHAR(64) NOT NULL,
  duration VARCHAR(16) NULL,
  policyNumber VARCHAR(64) NOT NULL,
  policyType VARCHAR(32) NOT NULL,
  KEY idx_ost_created (created),
  KEY idx_ost_status (status),
  KEY idx_ost_category (category)
);

CREATE TABLE IF NOT EXISTS overview_support_volume (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  time_label VARCHAR(32) NOT NULL,
  today_count INT NOT NULL,
  yesterday_count INT NOT NULL,
  sort_order INT NOT NULL,
  UNIQUE KEY uq_osv_time (time_label)
);

CREATE TABLE IF NOT EXISTS overview_workflow_stats (
  id CHAR(36) PRIMARY KEY,
  total_cases INT NOT NULL,
  department_stats_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS overview_retention_cohorts (
  cohort_key VARCHAR(64) PRIMARY KEY,
  cohort_size INT NOT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  summary_json JSON NOT NULL,
  weeks_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS overview_retention_aggregate (
  id VARCHAR(32) PRIMARY KEY,
  aggregate_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

