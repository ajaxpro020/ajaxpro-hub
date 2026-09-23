BEGIN;
CREATE TABLE IF NOT EXISTS youth_dossier_dataset (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  schema_version TEXT NOT NULL DEFAULT '1.0',
  dataset_revision BIGINT NOT NULL DEFAULT 1,
  dataset_as_of DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO youth_dossier_dataset (singleton, dataset_as_of)
SELECT true, max(last_checked_at) FROM youth_dossiers
ON CONFLICT (singleton) DO NOTHING;
COMMIT;
