BEGIN;

ALTER TABLE media_watch_claim_relations
  DROP CONSTRAINT IF EXISTS media_watch_claim_relations_relation_type_check;

ALTER TABLE media_watch_claim_relations
  ADD CONSTRAINT media_watch_claim_relations_relation_type_check
  CHECK (relation_type IN ('consistent', 'addition', 'adjustment', 'frame_shift', 'contradiction', 'not_comparable', 'revision', 'uncertain'));

CREATE INDEX IF NOT EXISTS media_watch_claims_dossier_published_idx
  ON media_watch_claims(dossier_id, created_at ASC)
  WHERE dossier_id IS NOT NULL;

COMMIT;
