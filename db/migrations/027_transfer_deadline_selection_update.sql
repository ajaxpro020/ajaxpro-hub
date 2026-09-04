BEGIN;

INSERT INTO ajax_players (
  id, name, shirt_number, position, image_url, active,
  contract_end, contract_position, contract_note, loan_club, loan_end, loan_note, loan_deal
) VALUES
(
  'kehrer', 'Thilo Kehrer', 6, 'Verdediger',
  '/assets/players/motm/kehrer_2627.jpg', true,
  '2027-06-30', 'Centrale verdediger', 'gehuurd van AS Monaco', NULL, NULL, NULL,
  '{
    "status": "confirmed",
    "updatedAt": "2026-09-02",
    "terms": ["Gehuurd van AS Monaco voor de rest van het seizoen 2026/27."],
    "note": "Ajax en AS Monaco hebben geen koopoptie, huursom of salarisverdeling openbaar gemaakt.",
    "sources": [{"label": "Ajax", "url": "https://www.ajax.nl/club/pers/persberichten/ajax-en-as-monaco-bereiken-akkoord-over-thilo-kehrer/"}]
  }'::jsonb
),
(
  'adingra', 'Simon Adingra', 7, 'Aanvaller',
  '/assets/players/motm/adingra_2627.jpg', true,
  '2027-06-30', 'Vleugelaanvaller', 'gehuurd van Sunderland AFC', NULL, NULL, NULL,
  '{
    "status": "confirmed",
    "updatedAt": "2026-09-02",
    "terms": ["Gehuurd van Sunderland AFC voor de rest van het seizoen 2026/27.", "Ajax heeft een optie tot koop."],
    "note": "De hoogte en voorwaarden van de koopoptie zijn niet openbaar gemaakt.",
    "sources": [{"label": "Ajax", "url": "https://www.ajax.nl/club/pers/persberichten/simon-adingra-op-huurbasis-naar-ajax/"}]
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  shirt_number = EXCLUDED.shirt_number,
  position = EXCLUDED.position,
  image_url = EXCLUDED.image_url,
  active = EXCLUDED.active,
  contract_end = EXCLUDED.contract_end,
  contract_position = EXCLUDED.contract_position,
  contract_note = EXCLUDED.contract_note,
  loan_club = EXCLUDED.loan_club,
  loan_end = EXCLUDED.loan_end,
  loan_note = EXCLUDED.loan_note,
  loan_deal = EXCLUDED.loan_deal,
  updated_at = now();

UPDATE ajax_players
SET shirt_number = NULL,
    active = false,
    loan_club = 'Werder Bremen',
    loan_end = '2027-06-30',
    loan_note = 'optie tot koop',
    loan_deal = '{
      "status": "confirmed",
      "updatedAt": "2026-08-31",
      "terms": ["Verhuurd aan Werder Bremen tot de zomer van 2027.", "Werder Bremen heeft een optie tot koop.", "Het Ajax-contract loopt tot en met 30 juni 2029."],
      "note": "De hoogte en voorwaarden van de koopoptie zijn niet openbaar gemaakt.",
      "sources": [{"label": "Ajax", "url": "https://www.ajax.nl/club/pers/persberichten/youri-regeer-naar-werder-bremen-op-huurbasis/"}]
    }'::jsonb
WHERE id = 'regeer';

UPDATE ajax_players
SET shirt_number = NULL,
    active = false,
    loan_club = 'FC Kopenhagen',
    loan_end = '2027-06-30',
    loan_note = NULL,
    loan_deal = '{
      "status": "confirmed",
      "updatedAt": "2026-08-31",
      "terms": ["Verhuurd aan FC Kopenhagen tot het einde van het seizoen 2026/27.", "Het Ajax-contract loopt tot en met 30 juni 2030."],
      "note": "In de officiële bekendmaking worden geen koopoptie of financiële afspraken genoemd.",
      "sources": [{"label": "Ajax", "url": "https://www.ajax.nl/club/pers/persberichten/maher-carrizo-op-huurbasis-naar-fc-kopenhagen/"}]
    }'::jsonb
WHERE id = 'carrizo';

UPDATE ajax_players
SET active = false,
    loan_club = 'De Graafschap',
    loan_end = '2027-06-30',
    loan_note = 'optie tot koop',
    loan_deal = '{
      "status": "confirmed",
      "updatedAt": "2026-09-01",
      "terms": ["Verhuurd aan De Graafschap tot het einde van het seizoen 2026/27.", "De Graafschap heeft een optie tot koop.", "Het Ajax-contract loopt tot en met 30 juni 2027."],
      "note": "De hoogte en voorwaarden van de koopoptie zijn niet openbaar gemaakt.",
      "sources": [{"label": "Ajax", "url": "https://www.ajax.nl/club/pers/persberichten/paul-reverson-op-huurbasis-naar-de-graafschap/"}]
    }'::jsonb
WHERE id = 'reverson';

UPDATE ajax_players
SET active = false,
    loan_club = 'Lommel SK',
    loan_end = '2027-06-30',
    loan_note = 'optie tot koop',
    loan_deal = '{
      "status": "confirmed",
      "updatedAt": "2026-08-21",
      "terms": ["Verhuurd aan Lommel SK tot en met 30 juni 2027.", "Lommel SK heeft een optie tot koop.", "Het Ajax-contract loopt tot en met 30 juni 2028."],
      "note": "De hoogte en voorwaarden van de koopoptie zijn niet openbaar gemaakt.",
      "sources": [{"label": "Ajax", "url": "https://www.ajax.nl/club/pers/persberichten/don-angelo-konadu-op-huurbasis-naar-lommel-sk"}]
    }'::jsonb
WHERE id = 'konadu';

UPDATE ajax_players
SET loan_club = NULL,
    loan_end = NULL,
    loan_note = NULL,
    loan_deal = NULL
WHERE id = 'van-de-pavert';

UPDATE ajax_players
SET active = false,
    contract_end = '2026-09-02',
    contract_note = 'arbeidsovereenkomst beëindigd op 2 september 2026',
    loan_club = NULL,
    loan_end = NULL,
    loan_note = NULL,
    loan_deal = NULL
WHERE id = 'van-axel-dongen';

UPDATE ajax_players SET contract_end = '2029-06-30' WHERE id = 'dies-janse';
UPDATE ajax_players SET contract_end = '2028-06-30', contract_position = 'Aanvallend middenveld' WHERE id = 'ouazane';
UPDATE ajax_players SET shirt_number = 21, contract_end = '2030-06-30' WHERE id = 'jofre-torrents';

COMMIT;
