BEGIN;

CREATE OR REPLACE FUNCTION prevent_always_retained_ajax_player_delete() RETURNS trigger AS $$
BEGIN
  IF OLD.id = 'ouazane' THEN
    RAISE EXCEPTION 'ajax_players row ouazane is protected and cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ajax_players_protect_always_retained ON ajax_players;
CREATE TRIGGER ajax_players_protect_always_retained
BEFORE DELETE ON ajax_players
FOR EACH ROW EXECUTE FUNCTION prevent_always_retained_ajax_player_delete();

COMMIT;
