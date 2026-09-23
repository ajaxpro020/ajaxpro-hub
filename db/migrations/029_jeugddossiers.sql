BEGIN;

CREATE TABLE IF NOT EXISTS youth_dossiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  birth_year SMALLINT,
  career_status TEXT NOT NULL CHECK (career_status IN ('active','retired','unknown')),
  featured BOOLEAN NOT NULL DEFAULT false,
  featured_order INTEGER,
  ajax_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  departure_type TEXT NOT NULL CHECK (departure_type IN ('contract_declined','chose_to_leave','released','sold','unknown')),
  departure_reason JSONB,
  career_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_situation JSONB NOT NULL DEFAULT '{}'::jsonb,
  retired_date DATE,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  editorial_summary TEXT,
  editorial_tags TEXT[] NOT NULL DEFAULT '{}',
  photo JSONB,
  last_checked_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS youth_dossiers_featured_idx ON youth_dossiers(featured, featured_order, name);
CREATE INDEX IF NOT EXISTS youth_dossiers_name_idx ON youth_dossiers(name);

COMMIT;
