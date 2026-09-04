BEGIN;

CREATE TABLE IF NOT EXISTS media_watch_source_item_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id UUID NOT NULL REFERENCES media_watch_source_items(id) ON DELETE RESTRICT,
  crawl_run_id UUID NOT NULL REFERENCES media_watch_crawl_runs(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  source_text TEXT NOT NULL,
  deduplication_hash TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_watch_source_item_revisions_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT media_watch_source_item_revisions_text_not_blank CHECK (btrim(source_text) <> ''),
  CONSTRAINT media_watch_source_item_revisions_hash_not_blank CHECK (btrim(deduplication_hash) <> ''),
  CONSTRAINT media_watch_source_item_revisions_unique_content UNIQUE (source_item_id, deduplication_hash)
);

ALTER TABLE media_watch_crawl_runs
  ADD COLUMN IF NOT EXISTS changed_count INTEGER NOT NULL DEFAULT 0 CHECK (changed_count >= 0);

CREATE INDEX IF NOT EXISTS media_watch_source_item_revisions_observed_idx
  ON media_watch_source_item_revisions(source_item_id, observed_at DESC);

COMMIT;
