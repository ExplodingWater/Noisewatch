-- Migration: add new columns to reports table
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS device_info TEXT,
  ADD COLUMN IF NOT EXISTS source VARCHAR(32),
  ADD COLUMN IF NOT EXISTS accuracy_meters INTEGER,
  ADD COLUMN IF NOT EXISTS audio_path TEXT,
  ADD COLUMN IF NOT EXISTS severity VARCHAR(16);

-- Add submitted_time column if missing (older DBs may not have it)
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS submitted_time TIME WITHOUT TIME ZONE DEFAULT (CURRENT_TIME);

-- Optionally create an index on severity for faster stats queries
CREATE INDEX IF NOT EXISTS reports_severity_idx ON reports (severity);
