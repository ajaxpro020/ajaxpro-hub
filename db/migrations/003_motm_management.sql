BEGIN;

ALTER TABLE motm_matches
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_discord_user_id TEXT,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT,
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS motm_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES motm_matches(id) ON DELETE RESTRICT,
  actor_discord_user_id TEXT NOT NULL,
  actor_username_snapshot TEXT NOT NULL,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS motm_audit_log_match_id_idx ON motm_audit_log(match_id);
CREATE INDEX IF NOT EXISTS motm_audit_log_created_at_idx ON motm_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS motm_matches_deleted_at_idx ON motm_matches(deleted_at) WHERE deleted_at IS NOT NULL;

COMMIT;
