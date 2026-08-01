BEGIN;

ALTER TABLE motm_matches
  ADD COLUMN IF NOT EXISTS scheduled_open_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_close_at TIMESTAMPTZ;

UPDATE motm_matches
SET scheduled_open_at = kickoff_at + INTERVAL '2 hours'
WHERE scheduled_open_at IS NULL;

UPDATE motm_matches
SET scheduled_close_at = scheduled_open_at + INTERVAL '24 hours'
WHERE scheduled_close_at IS NULL;

CREATE INDEX IF NOT EXISTS motm_scheduled_status_idx
  ON motm_matches(status, scheduled_open_at, scheduled_close_at);

COMMIT;
