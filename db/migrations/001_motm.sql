BEGIN;
CREATE TABLE IF NOT EXISTS motm_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE,
  opponent TEXT NOT NULL, competition TEXT NOT NULL, kickoff_at TIMESTAMPTZ NOT NULL,
  home_or_away TEXT NOT NULL CHECK (home_or_away IN ('home','away')),
  home_score SMALLINT, away_score SMALLINT, season TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed')),
  created_by_discord_user_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ, closed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS motm_match_players (
  match_id UUID NOT NULL REFERENCES motm_matches(id) ON DELETE RESTRICT,
  player_id TEXT NOT NULL, name_snapshot TEXT NOT NULL, shirt_number_snapshot SMALLINT,
  position_snapshot TEXT NOT NULL, image_url_snapshot TEXT NOT NULL,
  PRIMARY KEY (match_id, player_id)
);
CREATE TABLE IF NOT EXISTS motm_votes (
  match_id UUID NOT NULL REFERENCES motm_matches(id) ON DELETE RESTRICT,
  voter_discord_user_id TEXT NOT NULL, player_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, voter_discord_user_id),
  FOREIGN KEY (match_id, player_id) REFERENCES motm_match_players(match_id, player_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS motm_one_open_match_per_kickoff ON motm_matches(kickoff_at, opponent) WHERE status = 'open';
COMMIT;
