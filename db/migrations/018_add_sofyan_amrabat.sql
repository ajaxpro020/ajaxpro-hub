BEGIN;

INSERT INTO ajax_players (
  id, name, shirt_number, position, image_url, active,
  contract_end, contract_position, contract_note, loan_club, loan_end, loan_note
) VALUES (
  'amrabat', 'Sofyan Amrabat', 4, 'Middenvelder',
  '/assets/players/motm/amrabat_2627.jpg', true,
  '2028-06-30', 'Verdedigende middenvelder', NULL, NULL, NULL, NULL
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
  updated_at = now();

COMMIT;
