BEGIN;
ALTER TABLE motm_matches
  ADD COLUMN IF NOT EXISTS season_key TEXT,
  ADD COLUMN IF NOT EXISTS counts_for_season BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS season_exclusion_reason TEXT;
UPDATE motm_matches SET season_key = CASE WHEN EXTRACT(MONTH FROM kickoff_at AT TIME ZONE 'Europe/Amsterdam') >= 7 THEN EXTRACT(YEAR FROM kickoff_at AT TIME ZONE 'Europe/Amsterdam')::int::text || '-' || RIGHT((EXTRACT(YEAR FROM kickoff_at AT TIME ZONE 'Europe/Amsterdam')::int + 1)::text, 2) ELSE (EXTRACT(YEAR FROM kickoff_at AT TIME ZONE 'Europe/Amsterdam')::int - 1)::text || '-' || RIGHT(EXTRACT(YEAR FROM kickoff_at AT TIME ZONE 'Europe/Amsterdam')::int::text, 2) END WHERE season_key IS NULL;
ALTER TABLE motm_matches ALTER COLUMN season_key SET NOT NULL;
CREATE INDEX IF NOT EXISTS motm_matches_season_standings_idx ON motm_matches(season_key, counts_for_season, status, deleted_at);
COMMIT;
