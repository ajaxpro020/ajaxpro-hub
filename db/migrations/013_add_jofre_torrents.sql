BEGIN;

INSERT INTO ajax_players (
  id, name, shirt_number, position, image_url, active,
  contract_end, contract_position, contract_note, loan_club, loan_end, loan_note
) VALUES (
  'jofre-torrents', 'Jofre Torrents', NULL, 'Verdediger',
  '/assets/motm-winner-placeholder.svg', true,
  NULL, 'Linkervleugelverdediger', NULL, NULL, NULL, NULL
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  shirt_number = EXCLUDED.shirt_number,
  position = EXCLUDED.position,
  image_url = EXCLUDED.image_url,
  active = EXCLUDED.active,
  contract_position = EXCLUDED.contract_position,
  updated_at = now();

COMMIT;
