BEGIN;

-- Keeps the existing one-row-per-voter model while making hourly trend reads cheap.
CREATE INDEX IF NOT EXISTS motm_votes_match_created_at_idx
  ON motm_votes(match_id, created_at);

COMMIT;
