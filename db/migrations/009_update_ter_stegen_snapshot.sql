BEGIN;

UPDATE motm_match_players
SET image_url_snapshot = '/assets/players/motm/ter-stegen_2627.png'
WHERE player_id = 'ter-stegen'
  AND image_url_snapshot = '/assets/players/motm/ter-stegen_flight_2627.webp';

COMMIT;
