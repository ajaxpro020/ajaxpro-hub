BEGIN;

-- Itakura has completed a permanent transfer back to Borussia Mönchengladbach.
UPDATE ajax_players
SET active = false,
    loan_club = NULL,
    loan_end = NULL,
    loan_note = NULL
WHERE id = 'itakura';

-- Šutalo remains an Ajax contract player but is unavailable to the active squad while on loan.
UPDATE ajax_players
SET active = false,
    loan_club = 'SS Lazio',
    loan_end = '2027-06-30',
    loan_note = 'koopoptie, onder voorwaarden verplicht'
WHERE id = 'sutalo';

COMMIT;
