BEGIN;

CREATE TABLE IF NOT EXISTS media_watch_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  canonical_name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ajax_player_id TEXT REFERENCES ajax_players(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_watch_entities_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT media_watch_entities_canonical_name_not_blank CHECK (btrim(canonical_name) <> '')
);

CREATE TABLE IF NOT EXISTS media_watch_claim_entities (
  claim_id UUID NOT NULL REFERENCES media_watch_claims(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES media_watch_entities(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('primary', 'mentioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (claim_id, entity_id)
);

CREATE INDEX IF NOT EXISTS media_watch_claim_entities_entity_idx
  ON media_watch_claim_entities(entity_id, claim_id);

-- BACKFILL_ENTITIES_START
INSERT INTO media_watch_entities (slug, canonical_name, aliases, ajax_player_id)
VALUES
  ('brian-brobbey', 'Brian Brobbey', '{}'::TEXT[], NULL),
  ('brian-rodriguez', 'Brian Rodríguez', '{}'::TEXT[], NULL),
  ('carlos-forbs', 'Carlos Forbs', '{}'::TEXT[], NULL),
  ('chuba-akpom', 'Chuba Akpom', '{}'::TEXT[], NULL),
  ('dave-vos', 'Dave Vos', '{}'::TEXT[], NULL),
  ('erik-ten-hag', 'Erik ten Hag', '{}'::TEXT[], NULL),
  ('francesco-farioli', 'Francesco Farioli', '{}'::TEXT[], NULL),
  ('frank-de-boer', 'Frank de Boer', '{}'::TEXT[], NULL),
  ('graham-potter', 'Graham Potter', '{}'::TEXT[], NULL),
  ('jan-van-halst', 'Jan van Halst', '{}'::TEXT[], NULL),
  ('jeroen-hoencamp', 'Jeroen Hoencamp', '{}'::TEXT[], NULL),
  ('john-van-t-schip', 'John van ’t Schip', ARRAY['John van ''t Schip']::TEXT[], NULL),
  ('jordi-cruijff', 'Jordi Cruijff', '{}'::TEXT[], NULL),
  ('kamaldeen-sulemana', 'Kamaldeen Sulemana', '{}'::TEXT[], NULL),
  ('kenneth-taylor', 'Kenneth Taylor', '{}'::TEXT[], NULL),
  ('marije-haeck', 'Marije Haeck', '{}'::TEXT[], NULL),
  ('marijn-beuker', 'Marijn Beuker', '{}'::TEXT[], NULL),
  ('maurice-steijn', 'Maurice Steijn', '{}'::TEXT[], NULL),
  ('maurits-hendriks', 'Maurits Hendriks', '{}'::TEXT[], NULL),
  ('mees-hilgers', 'Mees Hilgers', '{}'::TEXT[], NULL),
  ('menno-geelen', 'Menno Geelen', '{}'::TEXT[], NULL),
  ('mika-godts', 'Mika Godts', '{}'::TEXT[], NULL),
  ('steven-bergwijn', 'Steven Bergwijn', '{}'::TEXT[], NULL),
  ('sven-mislintat', 'Sven Mislintat', '{}'::TEXT[], NULL),
  ('tolu-arokodare', 'Tolu Arokodare', '{}'::TEXT[], 'arokodare'),
  ('vaclav-cerny', 'Vaclav Cerny', '{}'::TEXT[], NULL),
  ('william-osula', 'William Osula', '{}'::TEXT[], NULL),
  ('youri-regeer', 'Youri Regeer', ARRAY['Regeer']::TEXT[], 'regeer')
ON CONFLICT (slug) DO NOTHING;
-- BACKFILL_ENTITIES_END

DO $$
DECLARE
  matched_claim_count INTEGER;
BEGIN
  SELECT count(*)::INTEGER
    INTO matched_claim_count
  FROM media_watch_claims
  WHERE id = ANY(ARRAY[
    '970a6e9d-2538-4d85-af72-cff8ba1a5858',
    '2cc76c67-51ab-49de-a866-11ebd42bfe7b',
    '45033a37-6636-40d6-b81b-727639c6a785',
    '9fcb4d78-fbe8-44c8-91f0-cbba6a9b9ac1',
    '059540a1-8956-49c0-b916-bfd679378df8',
    'f12f82f6-1f39-4b41-96ad-b2fe7116fa18',
    '21acf5d4-bf4b-4e09-95ab-a1e65c8027f3',
    '463527f9-0e2b-4abb-a5e5-f6fce1a9dca1',
    '6bb8f763-80b8-4839-af42-7512844463c1',
    'ae844bd5-0541-4bf3-95e7-1085b57ab530',
    '9cfbcc54-611b-431c-a9e0-f5dda34b73f6',
    'fde95dd4-fd0a-420c-bf25-209c6905e0bc',
    'c2f7182b-6a60-4622-a217-29131685d21f',
    '4e4a44aa-2a44-4688-8fdf-48adae817721',
    '679fffa2-455a-4d90-8f6b-4c5eca789a9d',
    '879fb72f-f361-4cb0-91f4-d2dd5254e2a0',
    '461de107-fc46-4a13-876b-a1d1497f99db',
    '2341d9a5-8f3e-4225-b8bb-e85b3fb9476e',
    'cd62bdf8-be1f-43e9-809a-e6958ab03cec',
    'bca248ca-73c8-478a-b138-8a0162690721',
    'aaa050c3-9767-49e3-ac9a-a2dd59aa973f',
    '2a923042-f6bf-4a10-8b01-5a92dc2ee1f9',
    '8d335961-400d-4a1f-9522-fe2d4a6258dc',
    '7d6ccf33-57b1-4649-831d-87cf28008e59',
    '6e254245-f8ba-4e1f-9b94-bd39879fc580',
    '608bba04-9864-4671-b136-4546642cde99',
    'ad53bc03-ed8f-4cbd-ac1f-8cd66cb502b6',
    '328c991e-6d62-44d2-a2d8-854a90da17d8',
    '32a15d05-dabf-4c53-bb91-7a22984a3b5f',
    '6b9edcf6-9fef-4649-a7ec-0fb0cc8c3ac2',
    '2081fc34-4cda-403d-a7bd-7e8c8ef27192',
    '564c9603-f4cf-4571-8474-f114418aedc1',
    'b19792a6-4185-47ea-8a54-c21f9ba009ed',
    '6369522b-08c4-48f4-a8a8-9c63892683a4',
    '4fda9f6f-c1b0-4440-894f-9ed5a725c8d7'
  ]::UUID[]);

  IF matched_claim_count NOT IN (0, 35) THEN
    RAISE EXCEPTION
      'Media Watch entity-backfill verwacht 0 of alle 35 gecontroleerde claims, maar vond er %',
      matched_claim_count;
  END IF;
END;
$$;

-- BACKFILL_LINKS_START
WITH controlled_links (claim_id, entity_slug, role) AS (
  VALUES
    ('970a6e9d-2538-4d85-af72-cff8ba1a5858'::UUID, 'maurits-hendriks', 'primary'),
    ('2cc76c67-51ab-49de-a866-11ebd42bfe7b'::UUID, 'mees-hilgers', 'primary'),
    ('45033a37-6636-40d6-b81b-727639c6a785'::UUID, 'john-van-t-schip', 'mentioned'),
    ('9fcb4d78-fbe8-44c8-91f0-cbba6a9b9ac1'::UUID, 'jan-van-halst', 'primary'),
    ('059540a1-8956-49c0-b916-bfd679378df8'::UUID, 'sven-mislintat', 'primary'),
    ('f12f82f6-1f39-4b41-96ad-b2fe7116fa18'::UUID, 'vaclav-cerny', 'primary'),
    ('21acf5d4-bf4b-4e09-95ab-a1e65c8027f3'::UUID, 'sven-mislintat', 'mentioned'),
    ('463527f9-0e2b-4abb-a5e5-f6fce1a9dca1'::UUID, 'sven-mislintat', 'primary'),
    ('463527f9-0e2b-4abb-a5e5-f6fce1a9dca1'::UUID, 'marije-haeck', 'mentioned'),
    ('6bb8f763-80b8-4839-af42-7512844463c1'::UUID, 'maurice-steijn', 'primary'),
    ('ae844bd5-0541-4bf3-95e7-1085b57ab530'::UUID, 'steven-bergwijn', 'primary'),
    ('9cfbcc54-611b-431c-a9e0-f5dda34b73f6'::UUID, 'brian-brobbey', 'primary'),
    ('fde95dd4-fd0a-420c-bf25-209c6905e0bc'::UUID, 'dave-vos', 'primary'),
    ('c2f7182b-6a60-4622-a217-29131685d21f'::UUID, 'erik-ten-hag', 'primary'),
    ('4e4a44aa-2a44-4688-8fdf-48adae817721'::UUID, 'graham-potter', 'primary'),
    ('679fffa2-455a-4d90-8f6b-4c5eca789a9d'::UUID, 'graham-potter', 'primary'),
    ('879fb72f-f361-4cb0-91f4-d2dd5254e2a0'::UUID, 'chuba-akpom', 'primary'),
    ('461de107-fc46-4a13-876b-a1d1497f99db'::UUID, 'carlos-forbs', 'primary'),
    ('2341d9a5-8f3e-4225-b8bb-e85b3fb9476e'::UUID, 'kamaldeen-sulemana', 'primary'),
    ('cd62bdf8-be1f-43e9-809a-e6958ab03cec'::UUID, 'jeroen-hoencamp', 'primary'),
    ('bca248ca-73c8-478a-b138-8a0162690721'::UUID, 'jeroen-hoencamp', 'primary'),
    ('aaa050c3-9767-49e3-ac9a-a2dd59aa973f'::UUID, 'francesco-farioli', 'primary'),
    ('2a923042-f6bf-4a10-8b01-5a92dc2ee1f9'::UUID, 'menno-geelen', 'primary'),
    ('8d335961-400d-4a1f-9522-fe2d4a6258dc'::UUID, 'sven-mislintat', 'mentioned'),
    ('7d6ccf33-57b1-4649-831d-87cf28008e59'::UUID, 'kenneth-taylor', 'primary'),
    ('6e254245-f8ba-4e1f-9b94-bd39879fc580'::UUID, 'william-osula', 'primary'),
    ('608bba04-9864-4671-b136-4546642cde99'::UUID, 'frank-de-boer', 'primary'),
    ('ad53bc03-ed8f-4cbd-ac1f-8cd66cb502b6'::UUID, 'jordi-cruijff', 'primary'),
    ('328c991e-6d62-44d2-a2d8-854a90da17d8'::UUID, 'jordi-cruijff', 'primary'),
    ('32a15d05-dabf-4c53-bb91-7a22984a3b5f'::UUID, 'marijn-beuker', 'primary'),
    ('6b9edcf6-9fef-4649-a7ec-0fb0cc8c3ac2'::UUID, 'tolu-arokodare', 'primary'),
    ('2081fc34-4cda-403d-a7bd-7e8c8ef27192'::UUID, 'jordi-cruijff', 'primary'),
    ('564c9603-f4cf-4571-8474-f114418aedc1'::UUID, 'mika-godts', 'primary'),
    ('b19792a6-4185-47ea-8a54-c21f9ba009ed'::UUID, 'brian-rodriguez', 'primary'),
    ('6369522b-08c4-48f4-a8a8-9c63892683a4'::UUID, 'youri-regeer', 'primary'),
    ('4fda9f6f-c1b0-4440-894f-9ed5a725c8d7'::UUID, 'youri-regeer', 'primary')
)
INSERT INTO media_watch_claim_entities (claim_id, entity_id, role)
SELECT link.claim_id, entity.id, link.role
FROM controlled_links AS link
JOIN media_watch_claims AS claim ON claim.id = link.claim_id
JOIN media_watch_entities AS entity ON entity.slug = link.entity_slug
ON CONFLICT (claim_id, entity_id) DO NOTHING;
-- BACKFILL_LINKS_END

COMMIT;
