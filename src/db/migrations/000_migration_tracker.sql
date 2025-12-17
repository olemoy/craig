-- Migration 000: Create migration tracking table
-- This table tracks which migrations have been applied to the database

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT NOT NULL
);
