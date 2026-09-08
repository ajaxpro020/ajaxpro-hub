BEGIN;

-- Fail closed if a non-Media Watch object still depends on this schema.
DROP TRIGGER IF EXISTS media_watch_claim_evidence_guard ON media_watch_claims;
DROP FUNCTION IF EXISTS media_watch_validate_claim_evidence();

DROP TABLE IF EXISTS media_watch_processed_revisions;
DROP TABLE IF EXISTS media_watch_claim_entities;
DROP TABLE IF EXISTS media_watch_claim_relations;
DROP TABLE IF EXISTS media_watch_claims;
DROP TABLE IF EXISTS media_watch_source_item_revisions;
DROP TABLE IF EXISTS media_watch_source_items;
DROP TABLE IF EXISTS media_watch_crawl_runs;
DROP TABLE IF EXISTS media_watch_entities;
DROP TABLE IF EXISTS media_watch_dossiers;
DROP TABLE IF EXISTS media_watch_journalists;

COMMIT;
