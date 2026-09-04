BEGIN;

UPDATE ajax_players
SET image_url = '/assets/players/motm/jofre-torrents_2627.jpg', updated_at = now()
WHERE id = 'jofre-torrents';

COMMIT;
