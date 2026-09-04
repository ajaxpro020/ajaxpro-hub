CREATE TABLE IF NOT EXISTS matchday_request_rate_limits (
  source_hash TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0)
);

