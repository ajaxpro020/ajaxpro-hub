BEGIN;

INSERT INTO ajax_players (
  id, name, shirt_number, position, image_url, active,
  contract_end, contract_position, contract_note, loan_club, loan_end, loan_note, arrival_deal
) VALUES (
  'bissouma', 'Yves Bissouma', NULL, 'Middenvelder',
  '/assets/motm-winner-placeholder.svg', true,
  '2027-06-30', 'Controlerende middenvelder',
  'Akkoord en medische keuring gemeld; officiële Ajax-bevestiging en rugnummer nog afwachten.',
  NULL, NULL, NULL,
  '{
    "status": "partly_reported",
    "updatedAt": "2026-09-16",
    "fromClub": "Tottenham Hotspur",
    "transferType": "Transfervrij",
    "fee": "Geen transfersom gemeld",
    "terms": [
      "Een contract tot en met juni 2027 wordt gemeld.",
      "Een optiejaar wordt gemeld.",
      "Een automatische verlenging bij een bepaald aantal wedstrijden wordt gemeld."
    ],
    "note": "De overgang, contractvoorwaarden en medische keuring zijn door meerdere media gemeld, maar een officiële Ajax-publicatie met de definitieve voorwaarden en het rugnummer ontbreekt nog.",
    "sources": [
      {"label": "NOS", "url": "https://nos.nl/artikel/2631106-ajax-slaat-na-sluiten-markt-toe-en-haalt-transfervrije-middenvelder-bissouma"},
      {"label": "Ajax1", "url": "https://www.ajax1.nl/breaking-bissouma-bereikt-akkoord-met-ajax-details-bekend/"}
    ]
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  position = EXCLUDED.position,
  image_url = EXCLUDED.image_url,
  active = EXCLUDED.active,
  contract_end = EXCLUDED.contract_end,
  contract_position = EXCLUDED.contract_position,
  contract_note = EXCLUDED.contract_note,
  arrival_deal = EXCLUDED.arrival_deal,
  updated_at = now();

UPDATE ajax_players SET image_url = '/assets/players/motm/kehrer_2627.png' WHERE id = 'kehrer';
UPDATE ajax_players SET image_url = '/assets/players/motm/adingra_2627.png' WHERE id = 'adingra';
UPDATE ajax_players SET image_url = '/assets/players/motm/amrabat_2627.png' WHERE id = 'amrabat';
UPDATE ajax_players SET image_url = '/assets/players/motm/tsygankov_2627.png' WHERE id = 'tsygankov';

COMMIT;
