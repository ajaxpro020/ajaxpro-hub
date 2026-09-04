BEGIN;
ALTER TABLE motm_matches
  ADD COLUMN IF NOT EXISTS announcement_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS announcement_sent_by_discord_user_id TEXT;

UPDATE motm_matches
SET scheduled_close_at = kickoff_at + INTERVAL '3 hours'
WHERE scheduled_close_at IS NULL OR scheduled_close_at > kickoff_at + INTERVAL '3 hours';

ALTER TABLE motm_matches
  ADD CONSTRAINT motm_close_within_match_limit
  CHECK (scheduled_close_at IS NULL OR scheduled_close_at <= kickoff_at + INTERVAL '3 hours');
COMMIT;
