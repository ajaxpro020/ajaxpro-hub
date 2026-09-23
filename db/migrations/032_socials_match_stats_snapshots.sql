BEGIN;

CREATE TABLE IF NOT EXISTS socials_match_stats_snapshots (
  fixture_key TEXT PRIMARY KEY REFERENCES matchday_fixtures(fixture_key) ON DELETE CASCADE,
  fotmob_match_id BIGINT NOT NULL,
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS socials_match_stats_snapshots_imported_idx
  ON socials_match_stats_snapshots(imported_at DESC);

COMMIT;
