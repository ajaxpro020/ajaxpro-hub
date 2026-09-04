BEGIN;

CREATE TABLE IF NOT EXISTS media_watch_journalists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  primary_medium TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_watch_journalists_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT media_watch_journalists_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE IF NOT EXISTS media_watch_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_watch_dossiers_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT media_watch_dossiers_title_not_blank CHECK (btrim(title) <> '')
);

CREATE TABLE IF NOT EXISTS media_watch_source_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id UUID NOT NULL REFERENCES media_watch_journalists(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  original_medium TEXT NOT NULL,
  discovered_via TEXT,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('primary', 'secondary')),
  source_text TEXT,
  paywall_status TEXT NOT NULL DEFAULT 'unknown' CHECK (paywall_status IN ('unknown', 'none', 'partial', 'full')),
  processing_status TEXT NOT NULL DEFAULT 'new' CHECK (processing_status IN ('new', 'ready', 'processed', 'blocked')),
  deduplication_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_watch_source_items_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT media_watch_source_items_url_not_blank CHECK (btrim(url) <> ''),
  CONSTRAINT media_watch_source_items_original_medium_not_blank CHECK (btrim(original_medium) <> ''),
  CONSTRAINT media_watch_source_items_hash_not_blank CHECK (btrim(deduplication_hash) <> ''),
  CONSTRAINT media_watch_secondary_source_has_discovery_site CHECK (
    source_kind = 'primary'
    OR (discovered_via IS NOT NULL AND btrim(discovered_via) <> '' AND lower(btrim(discovered_via)) <> lower(btrim(original_medium)))
  )
);

CREATE TABLE IF NOT EXISTS media_watch_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id UUID NOT NULL REFERENCES media_watch_source_items(id) ON DELETE RESTRICT,
  journalist_id UUID NOT NULL REFERENCES media_watch_journalists(id) ON DELETE RESTRICT,
  dossier_id UUID REFERENCES media_watch_dossiers(id) ON DELETE SET NULL,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('fact', 'opinion', 'expectation')),
  structured_text TEXT NOT NULL,
  evidence_quote TEXT NOT NULL,
  certainty TEXT CHECK (certainty IN ('low', 'medium', 'high')),
  attributed_parties TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_watch_claims_structured_text_not_blank CHECK (btrim(structured_text) <> ''),
  CONSTRAINT media_watch_claims_evidence_quote_not_blank CHECK (btrim(evidence_quote) <> '')
);

CREATE OR REPLACE FUNCTION media_watch_validate_claim_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  linked_journalist_id UUID;
  linked_source_text TEXT;
BEGIN
  SELECT journalist_id, source_text INTO linked_journalist_id, linked_source_text
  FROM media_watch_source_items WHERE id = NEW.source_item_id;
  IF linked_journalist_id IS NULL THEN RAISE EXCEPTION 'Source item % bestaat niet', NEW.source_item_id; END IF;
  IF linked_journalist_id <> NEW.journalist_id THEN RAISE EXCEPTION 'Claim en source item moeten aan dezelfde journalist gekoppeld zijn'; END IF;
  IF linked_source_text IS NULL OR strpos(linked_source_text, NEW.evidence_quote) = 0 THEN RAISE EXCEPTION 'Evidence quote moet letterlijk voorkomen in de beschikbare brontekst'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_watch_claim_evidence_guard ON media_watch_claims;
CREATE TRIGGER media_watch_claim_evidence_guard
BEFORE INSERT OR UPDATE OF source_item_id, journalist_id, evidence_quote ON media_watch_claims
FOR EACH ROW EXECUTE FUNCTION media_watch_validate_claim_evidence();

CREATE TABLE IF NOT EXISTS media_watch_claim_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  earlier_claim_id UUID NOT NULL REFERENCES media_watch_claims(id) ON DELETE RESTRICT,
  later_claim_id UUID NOT NULL REFERENCES media_watch_claims(id) ON DELETE RESTRICT,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('consistent', 'addition', 'revision', 'frame_shift', 'contradiction', 'uncertain')),
  explanation TEXT,
  review_status TEXT NOT NULL DEFAULT 'candidate' CHECK (review_status IN ('candidate', 'confirmed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_watch_claim_relations_distinct_claims CHECK (earlier_claim_id <> later_claim_id),
  CONSTRAINT media_watch_claim_relations_unique_pair UNIQUE (earlier_claim_id, later_claim_id)
);

CREATE TABLE IF NOT EXISTS media_watch_crawl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id UUID REFERENCES media_watch_journalists(id) ON DELETE RESTRICT,
  trigger_kind TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_kind IN ('manual', 'scheduled')),
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'succeeded', 'partial', 'failed')),
  found_count INTEGER NOT NULL DEFAULT 0 CHECK (found_count >= 0),
  new_count INTEGER NOT NULL DEFAULT 0 CHECK (new_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  paywalled_count INTEGER NOT NULL DEFAULT 0 CHECK (paywalled_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  CONSTRAINT media_watch_crawl_runs_finished_after_start CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX IF NOT EXISTS media_watch_source_items_journalist_published_idx ON media_watch_source_items(journalist_id, published_at DESC);
CREATE INDEX IF NOT EXISTS media_watch_source_items_processing_status_idx ON media_watch_source_items(processing_status);
CREATE INDEX IF NOT EXISTS media_watch_claims_journalist_created_idx ON media_watch_claims(journalist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_watch_claims_dossier_idx ON media_watch_claims(dossier_id) WHERE dossier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS media_watch_claim_relations_later_claim_idx ON media_watch_claim_relations(later_claim_id);
CREATE INDEX IF NOT EXISTS media_watch_crawl_runs_started_idx ON media_watch_crawl_runs(started_at DESC);

INSERT INTO media_watch_journalists (slug, name, primary_medium)
VALUES ('mike-verweij', 'Mike Verweij', 'De Telegraaf')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
