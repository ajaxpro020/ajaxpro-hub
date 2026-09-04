BEGIN;

ALTER TABLE media_watch_source_items
  ALTER COLUMN journalist_id DROP NOT NULL,
  ALTER COLUMN original_medium DROP NOT NULL;

ALTER TABLE media_watch_source_items
  ADD COLUMN IF NOT EXISTS source_format TEXT NOT NULL DEFAULT 'article',
  ADD COLUMN IF NOT EXISTS source_account TEXT;

ALTER TABLE media_watch_source_items
  DROP CONSTRAINT IF EXISTS media_watch_source_items_source_format_check;

ALTER TABLE media_watch_source_items
  ADD CONSTRAINT media_watch_source_items_source_format_check
  CHECK (source_format IN ('article', 'x_post'));

ALTER TABLE media_watch_source_items
  DROP CONSTRAINT IF EXISTS media_watch_x_post_has_text;

ALTER TABLE media_watch_source_items
  ADD CONSTRAINT media_watch_x_post_has_text
  CHECK (source_format <> 'x_post' OR (source_text IS NOT NULL AND btrim(source_text) <> ''));

CREATE UNIQUE INDEX IF NOT EXISTS media_watch_source_items_url_unique_idx
  ON media_watch_source_items(url);

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
  IF NOT FOUND THEN RAISE EXCEPTION 'Source item % bestaat niet', NEW.source_item_id; END IF;
  IF linked_journalist_id IS NULL THEN RAISE EXCEPTION 'Een claim vereist een bron met een gekoppelde journalist'; END IF;
  IF linked_journalist_id <> NEW.journalist_id THEN RAISE EXCEPTION 'Claim en source item moeten aan dezelfde journalist gekoppeld zijn'; END IF;
  IF linked_source_text IS NULL OR strpos(linked_source_text, NEW.evidence_quote) = 0 THEN RAISE EXCEPTION 'Evidence quote moet letterlijk voorkomen in de beschikbare brontekst'; END IF;
  RETURN NEW;
END;
$$;

COMMIT;
