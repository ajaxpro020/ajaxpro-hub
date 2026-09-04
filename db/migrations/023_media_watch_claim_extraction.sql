BEGIN;

ALTER TABLE media_watch_claims
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS attribution JSONB,
  ADD COLUMN IF NOT EXISTS extraction_hash TEXT;

ALTER TABLE media_watch_claims
  DROP CONSTRAINT IF EXISTS media_watch_claims_subject_not_blank,
  DROP CONSTRAINT IF EXISTS media_watch_claims_attribution_object,
  DROP CONSTRAINT IF EXISTS media_watch_claims_extraction_hash_not_blank;

ALTER TABLE media_watch_claims
  ADD CONSTRAINT media_watch_claims_subject_not_blank CHECK (subject IS NULL OR btrim(subject) <> ''),
  ADD CONSTRAINT media_watch_claims_attribution_object CHECK (attribution IS NULL OR jsonb_typeof(attribution) = 'object'),
  ADD CONSTRAINT media_watch_claims_extraction_hash_not_blank CHECK (extraction_hash IS NULL OR btrim(extraction_hash) <> '');

CREATE UNIQUE INDEX IF NOT EXISTS media_watch_claims_source_extraction_unique_idx
  ON media_watch_claims(source_item_id, extraction_hash)
  WHERE extraction_hash IS NOT NULL;

COMMIT;
