BEGIN;

UPDATE ajax_players
SET shirt_number = 21,
    image_url = '/assets/players/motm/jofre-torrents_2627.png'
WHERE id = 'jofre-torrents';

UPDATE ajax_players
SET image_url = '/assets/players/motm/julian-brandt_2627.png'
WHERE id = 'brandt';

UPDATE ajax_players
SET image_url = '/assets/players/motm/tolu-arokodare_2627.png'
WHERE id = 'arokodare';

COMMIT;
