BEGIN;

ALTER TABLE ajax_players
ADD COLUMN IF NOT EXISTS loan_deal JSONB;

UPDATE ajax_players SET loan_deal = '{
  "status": "confirmed",
  "updatedAt": "2026-08-21",
  "terms": ["Gehuurd van FC Barcelona voor het seizoen 2026/27."],
  "note": "Ajax en FC Barcelona hebben geen koopoptie, huursom of salarisverdeling openbaar gemaakt.",
  "sources": [{"label": "Ajax", "url": "https://www.ajax.nl/club/pers/persberichten/ajax-huurt-marc-ter-stegen-van-fc-barcelona/"}]
}'::jsonb WHERE id = 'ter-stegen';

UPDATE ajax_players SET loan_deal = '{
  "status": "confirmed",
  "updatedAt": "2026-08-21",
  "terms": ["Gehuurd van Wolverhampton Wanderers tot de zomer van 2027.", "Ajax heeft een optie tot koop."],
  "note": "De hoogte en voorwaarden van de koopoptie zijn niet openbaar gemaakt.",
  "sources": [{"label": "Ajax", "url": "https://www.ajax.nl/club/pers/persberichten/ajax-huurt-tolu-arokodare-van-wolverhampton-wanderers/"}, {"label": "Wolves", "url": "https://www.wolves.co.uk/news/mens-first-team/20260729-arokodare-completes-loan-move-away/?isNative=true&trk=public_post_comment-text"}]
}'::jsonb WHERE id = 'arokodare';

UPDATE ajax_players SET loan_deal = '{
  "status": "reported",
  "updatedAt": "2026-08-21",
  "terms": ["Gemelde huursom: €3 miljoen.", "Gemelde koopoptie: circa €7,5–8 miljoen; onder voorwaarden zou die verplicht worden."],
  "note": "Ajax en SS Lazio hebben de financiële afspraken nog niet officieel gepubliceerd. De berichtgeving over bedragen en aanvullende voorwaarden verschilt; deze gegevens zijn daarom nadrukkelijk onbevestigd.",
  "sources": [{"label": "Di Marzio via SoccerNews", "url": "https://www.soccernews.nl/news/sutalo-verlaat-ajax-per-direct-bestemming-bekend/"}, {"label": "FootballTransfers", "url": "https://www.footballtransfers.com/nl/transfernieuws/nl-eredivisie/2026/08/ajax-gelinkt-aan-naderend-akkoord-met-lazio-over-transfer-sutalo"}]
}'::jsonb WHERE id = 'sutalo';

UPDATE ajax_players SET loan_deal = '{
  "status": "confirmed",
  "updatedAt": "2026-08-21",
  "terms": ["Verhuurd aan SC Cambuur tot en met 30 juni 2027.", "Het Ajax-contract loopt tot en met 30 juni 2029."],
  "note": "In de officiële bekendmaking worden geen koopoptie of financiële afspraken genoemd.",
  "sources": [{"label": "Ajax", "url": "https://english.ajax.nl/articles/ryan-van-de-pavert-joins-sc-cambuur-on-loan/"}]
}'::jsonb WHERE id = 'van-de-pavert';

UPDATE ajax_players SET loan_deal = '{
  "status": "confirmed",
  "updatedAt": "2026-08-21",
  "terms": ["Verhuurd aan Telstar voor het seizoen 2026/27.", "Het Ajax-contract loopt tot en met 30 juni 2028."],
  "note": "In de officiële bekendmaking worden geen koopoptie of financiële afspraken genoemd.",
  "sources": [{"label": "Ajax", "url": "https://english.ajax.nl/articles/gerald-alders-joins-telstar-on-loan-again"}]
}'::jsonb WHERE id = 'alders';

UPDATE ajax_players SET loan_deal = '{
  "status": "confirmed",
  "updatedAt": "2026-08-21",
  "terms": ["Verhuurd aan Rosario Central tot en met 31 december 2026.", "Rosario Central heeft een optie tot koop."],
  "note": "De hoogte en voorwaarden van de koopoptie zijn niet openbaar gemaakt.",
  "sources": [{"label": "Ajax", "url": "https://www.ajax.nl/club/pers/persberichten/gaston-avila-op-huurbasis-naar-ca-rosario-central"}]
}'::jsonb WHERE id = 'avila';

UPDATE ajax_players SET loan_deal = '{
  "status": "confirmed",
  "updatedAt": "2026-08-21",
  "terms": ["Verhuurd aan FC Andorra tot de zomer van 2027.", "FC Andorra heeft een optie tot koop.", "Het Ajax-contract loopt tot en met 30 juni 2028; Ajax heeft een optie voor nog een seizoen."],
  "note": "De hoogte en voorwaarden van de koopoptie zijn niet openbaar gemaakt.",
  "sources": [{"label": "Ajax", "url": "https://www.ajax.nl/club/pers/persberichten/contractverlenging-en-verhuur-julian-rijkhoff-aan-fc-andorra/"}]
}'::jsonb WHERE id = 'rijkhoff';

COMMIT;
