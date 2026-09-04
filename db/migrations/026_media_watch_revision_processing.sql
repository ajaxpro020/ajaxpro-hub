BEGIN;

ALTER TABLE media_watch_source_item_revisions
  ALTER COLUMN crawl_run_id DROP NOT NULL;

INSERT INTO media_watch_source_item_revisions (
  source_item_id, crawl_run_id, title, published_at, source_text,
  deduplication_hash, observed_at
)
SELECT id, NULL, title, published_at, source_text, deduplication_hash,
  COALESCE(updated_at, created_at)
FROM media_watch_source_items
WHERE source_text IS NOT NULL AND btrim(source_text) <> ''
ON CONFLICT (source_item_id, deduplication_hash) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS media_watch_source_item_revisions_id_source_idx
  ON media_watch_source_item_revisions(id, source_item_id);

ALTER TABLE media_watch_claims
  ADD COLUMN IF NOT EXISTS source_revision_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_watch_claims_revision_source_fk') THEN
    ALTER TABLE media_watch_claims
      ADD CONSTRAINT media_watch_claims_revision_source_fk
      FOREIGN KEY (source_revision_id, source_item_id)
      REFERENCES media_watch_source_item_revisions(id, source_item_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS media_watch_claims_source_revision_idx
  ON media_watch_claims(source_revision_id) WHERE source_revision_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS media_watch_processed_revisions (
  revision_id UUID PRIMARY KEY,
  source_item_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result TEXT NOT NULL CHECK (result IN ('accepted', 'rejected')),
  import_hash TEXT NOT NULL,
  claim_count INTEGER NOT NULL DEFAULT 0 CHECK (claim_count >= 0),
  CONSTRAINT media_watch_processed_revisions_import_hash_not_blank CHECK (btrim(import_hash) <> ''),
  CONSTRAINT media_watch_processed_revisions_revision_source_fk
    FOREIGN KEY (revision_id, source_item_id)
    REFERENCES media_watch_source_item_revisions(id, source_item_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS media_watch_processed_revisions_source_idx
  ON media_watch_processed_revisions(source_item_id, processed_at DESC);

CREATE OR REPLACE FUNCTION media_watch_validate_claim_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  linked_journalist_id UUID;
  linked_source_text TEXT;
  linked_revision_source_id UUID;
BEGIN
  SELECT journalist_id, source_text INTO linked_journalist_id, linked_source_text
  FROM media_watch_source_items WHERE id = NEW.source_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source item % bestaat niet', NEW.source_item_id; END IF;
  IF linked_journalist_id IS NULL THEN RAISE EXCEPTION 'Een claim vereist een bron met een gekoppelde journalist'; END IF;
  IF linked_journalist_id <> NEW.journalist_id THEN RAISE EXCEPTION 'Claim en source item moeten aan dezelfde journalist gekoppeld zijn'; END IF;

  IF NEW.source_revision_id IS NOT NULL THEN
    SELECT source_item_id, source_text INTO linked_revision_source_id, linked_source_text
    FROM media_watch_source_item_revisions WHERE id = NEW.source_revision_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Source revision % bestaat niet', NEW.source_revision_id; END IF;
    IF linked_revision_source_id <> NEW.source_item_id THEN RAISE EXCEPTION 'Claim en source revision moeten aan dezelfde bron gekoppeld zijn'; END IF;
  END IF;

  IF linked_source_text IS NULL OR strpos(linked_source_text, NEW.evidence_quote) = 0 THEN
    RAISE EXCEPTION 'Evidence quote moet letterlijk voorkomen in de opgeslagen bronrevision';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_watch_claim_evidence_guard ON media_watch_claims;
CREATE TRIGGER media_watch_claim_evidence_guard
BEFORE INSERT OR UPDATE OF source_item_id, source_revision_id, journalist_id, evidence_quote ON media_watch_claims
FOR EACH ROW EXECUTE FUNCTION media_watch_validate_claim_evidence();

COMMIT;
