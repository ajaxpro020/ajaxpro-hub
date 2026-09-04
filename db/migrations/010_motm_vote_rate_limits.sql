BEGIN;

CREATE TABLE IF NOT EXISTS motm_vote_rate_limits (
  match_id UUID NOT NULL REFERENCES motm_matches(id) ON DELETE CASCADE,
  voter_discord_user_id TEXT NOT NULL,
  last_attempt_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (match_id, voter_discord_user_id)
);

COMMIT;
