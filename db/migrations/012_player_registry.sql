BEGIN;

CREATE TABLE IF NOT EXISTS ajax_players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  shirt_number SMALLINT CHECK (shirt_number IS NULL OR shirt_number BETWEEN 0 AND 99),
  position TEXT NOT NULL,
  image_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  contract_end DATE,
  contract_position TEXT,
  contract_note TEXT,
  loan_club TEXT,
  loan_end DATE,
  loan_note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ajax_players_active_order ON ajax_players(active,shirt_number,name);

CREATE OR REPLACE FUNCTION touch_ajax_players_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ajax_players_touch_updated_at ON ajax_players;
CREATE TRIGGER ajax_players_touch_updated_at BEFORE UPDATE ON ajax_players
FOR EACH ROW EXECUTE FUNCTION touch_ajax_players_updated_at();

INSERT INTO ajax_players(id,name,shirt_number,position,image_url,active,contract_end,contract_position,contract_note,loan_club,loan_end,loan_note) VALUES
('ter-stegen','Marc-André ter Stegen',1,'Doelman','/assets/players/motm/ter-stegen_2627.png',true,'2027-06-30','Keeper','gehuurd van FC Barcelona',NULL,NULL,NULL),
('rosa','Lucas Rosa',2,'Verdediger','/assets/players/motm/rosa_2627.png',true,'2029-06-30','Rechtervleugelverdediger',NULL,NULL,NULL,NULL),
('gaaei','Anton Gaaei',3,'Verdediger','/assets/players/motm/gaaei_2627.png',true,'2028-06-30','Rechtervleugelverdediger',NULL,NULL,NULL,NULL),
('itakura','Ko Itakura',4,'Verdediger','/assets/players/motm/itakura_2627.png',true,'2029-06-30','Centrale verdediger',NULL,NULL,NULL,NULL),
('wijndal','Owen Wijndal',5,'Verdediger','/assets/players/motm/wijndal_2627.png',true,'2027-06-30','Linkervleugelverdediger',NULL,NULL,NULL,NULL),
('regeer','Youri Regeer',6,'Middenvelder','/assets/players/motm/regeer_2627.png',true,'2029-06-30','Defensief middenveld',NULL,NULL,NULL,NULL),
('carrizo','Maher Carrizo',7,'Aanvaller','/assets/players/motm/carrizo_2627.png',true,'2030-06-30','Rechtsbuiten',NULL,NULL,NULL,NULL),
('brandt','Julian Brandt',8,'Middenvelder','/assets/players/motm/julian-brandt_2627.webp',true,'2029-06-30','Aanvallend middenveld',NULL,NULL,NULL,NULL),
('dolberg','Kasper Dolberg',9,'Aanvaller','/assets/players/motm/dolberg_2627.png',true,'2029-06-30','Centrumspits',NULL,NULL,NULL,NULL),
('gloukh','Oscar Gloukh',10,'Middenvelder','/assets/players/motm/gloukh_2627.png',true,'2030-06-30','Aanvallend middenveld',NULL,NULL,NULL,NULL),
('caio-henrique','Caio Henrique',12,'Verdediger','/assets/players/motm/caio-henrique_2627.png',true,'2030-06-30','Linkervleugelverdediger',NULL,NULL,NULL,NULL),
('baas','Youri Baas',15,'Verdediger','/assets/players/motm/baas_2627.png',true,'2028-06-30','Centrale verdediger',NULL,NULL,NULL,NULL),
('blind','Daley Blind',17,'Verdediger','/assets/players/motm/blind_2627.png',true,'2027-06-30','Centrale verdediger',NULL,NULL,NULL,NULL),
('klaassen','Davy Klaassen',18,'Middenvelder','/assets/players/motm/klaassen_2627.png',true,'2027-06-30','Centraal middenveld',NULL,NULL,NULL,NULL),
('konadu','Don-Angelo Konadu',19,'Aanvaller','/assets/players/motm/konadu_2627.png',false,'2028-06-30','Centrumspits',NULL,NULL,NULL,NULL),
('edvardsen','Oliver Edvardsen',20,'Aanvaller','/assets/players/motm/edvardsen_2627.png',true,'2028-06-30','Linksbuiten',NULL,NULL,NULL,NULL),
('heerkens','Joeri Heerkens',22,'Doelman','/assets/players/motm/heerkens_2627.png',true,'2030-06-30','Keeper',NULL,NULL,NULL,NULL),
('berghuis','Steven Berghuis',23,'Aanvaller','/assets/players/motm/berghuis_2627.png',true,'2027-06-30','Rechtsbuiten',NULL,NULL,NULL,NULL),
('mokio','Jorthy Mokio',24,'Middenvelder','/assets/players/motm/mokio_2627.png',true,'2031-06-30','Defensief middenveld',NULL,NULL,NULL,NULL),
('paes','Maarten Paes',26,'Doelman','/assets/players/motm/paes_2627.png',true,'2029-06-30','Keeper',NULL,NULL,NULL,NULL),
('bouwman','Aaron Bouwman',30,'Verdediger','/assets/players/motm/bouwman_2627.png',true,'2030-06-30','Centrale verdediger',NULL,NULL,NULL,NULL),
('sutalo','Josip Šutalo',37,'Verdediger','/assets/players/motm/sutalo_2627.png',true,'2028-06-30','Centrale verdediger',NULL,NULL,NULL,NULL),
('leonardo','Marcos Leonardo',38,'Aanvaller','/assets/players/motm/leonardo_2627.png',true,'2031-06-30','Centrumspits',NULL,NULL,NULL,NULL),
('bounida','Rayane Bounida',43,'Middenvelder','/assets/players/motm/bounida_2627.png',true,'2028-06-30','Aanvallend middenveld',NULL,NULL,NULL,NULL),
('arokodare','Tolu Arokodare',99,'Aanvaller','/assets/players/motm/tolu-arokodare_2627.webp',true,'2027-06-30','Centrumspits','gehuurd van Wolverhampton Wanderers',NULL,NULL,NULL),
('dies-janse','Dies Janse',36,'Verdediger','/assets/players/motm/dies-janse_2627.png',true,NULL,'Centrale verdediger',NULL,NULL,NULL,NULL),
('ouazane','Abdellah Ouazane',68,'Middenvelder','/assets/players/motm/ouazane_2627.png',true,NULL,'Middenvelder',NULL,NULL,NULL,NULL),
('van-axel-dongen','Amourricho van Axel Dongen',NULL,'Aanvaller','/assets/motm-winner-placeholder.svg',false,'2027-06-30','Linksbuiten',NULL,NULL,NULL,NULL),
('reverson','Paul Reverson',NULL,'Doelman','/assets/motm-winner-placeholder.svg',false,'2027-06-30','Keeper',NULL,NULL,NULL,NULL),
('van-de-pavert','Ryan van de Pavert',NULL,'Middenvelder','/assets/motm-winner-placeholder.svg',false,'2029-06-30','Verdediger / middenvelder',NULL,'SC Cambuur','2027-06-30',NULL),
('alders','Gerald Alders',NULL,'Verdediger','/assets/motm-winner-placeholder.svg',false,'2028-06-30','Vleugelverdediger',NULL,'Telstar','2027-06-30',NULL),
('avila','Gastón Ávila',NULL,'Verdediger','/assets/motm-winner-placeholder.svg',false,'2028-06-30','Centrale verdediger',NULL,'Rosario Central','2026-12-31','optie tot koop'),
('rijkhoff','Julian Rijkhoff',NULL,'Aanvaller','/assets/motm-winner-placeholder.svg',false,'2028-06-30','Centrumspits','optie voor extra seizoen','FC Andorra','2027-06-30','optie tot koop')
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,shirt_number=excluded.shirt_number,position=excluded.position,image_url=excluded.image_url,
  active=excluded.active,contract_end=excluded.contract_end,contract_position=excluded.contract_position,
  contract_note=excluded.contract_note,loan_club=excluded.loan_club,loan_end=excluded.loan_end,
  loan_note=excluded.loan_note,updated_at=now();

DELETE FROM ajax_players WHERE id='kaplan';

COMMIT;
