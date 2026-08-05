BEGIN;

CREATE TABLE IF NOT EXISTS matchday_fixtures (
  fixture_key TEXT PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  competition TEXT NOT NULL,
  kickoff_at TIMESTAMPTZ NOT NULL,
  tv TEXT,
  provider_fixture_id BIGINT UNIQUE,
  provider_status TEXT,
  elapsed SMALLINT,
  elapsed_extra SMALLINT,
  goals_home SMALLINT,
  goals_away SMALLINT,
  last_success_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ,
  refresh_locked_until TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  source_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matchday_fixtures_next_idx
  ON matchday_fixtures(finished_at, kickoff_at);

CREATE TABLE IF NOT EXISTS matchday_api_budget (
  budget_day DATE PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0 CHECK (calls >= 0 AND calls <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
