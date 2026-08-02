import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSeasonStandings, seasonKeyFor, validSeasonKey, type SeasonMatch } from "../lib/motm-season";

const player=(id:string,votes:number,name=id)=>({player_id:id,name_snapshot:name,image_url_snapshot:`/${id}.png`,votes});
const match=(id:string,players:ReturnType<typeof player>[],counts_for_season=true,kickoff_at=`2026-08-0${id}T12:00:00Z`):SeasonMatch=>({id,slug:`match-${id}`,opponent:"PSV",competition:"Eredivisie",kickoff_at,home_or_away:"home",counts_for_season,players});

test("seizoenkey wisselt correct rond januari en juli",()=>{
  assert.equal(seasonKeyFor("2027-01-15T12:00:00Z"),"2026-27");
  assert.equal(seasonKeyFor("2026-06-30T12:00:00Z"),"2025-26");
  assert.equal(seasonKeyFor("2026-07-01T12:00:00Z"),"2026-27");
  assert.equal(seasonKeyFor("2026-08-02T12:00:00Z"),"2026-27");
  assert.equal(validSeasonKey("2026-27"),true);assert.equal(validSeasonKey("2026/27"),false);
});

test("stand kent dense 5, 3 en 1 punten toe en negeert nul stemmen",()=>{
  const {standings}=buildSeasonStandings([match("1",[player("a",5),player("b",5),player("c",3),player("d",1),player("zero",0)])]);
  assert.deepEqual(standings.map(row=>[row.player_id,row.points]),[["a",5],["b",5],["c",3],["d",1]]);
});

test("uitgesloten wedstrijden veranderen de gewone uitslag niet maar tellen niet in de stand",()=>{
  const excluded=match("1",[player("a",9)],false);const {standings,rounds}=buildSeasonStandings([excluded]);
  assert.deepEqual(standings,[]);assert.equal(rounds[0].results[0].player_id,"a");assert.equal(rounds[0].results[0].votes,9);
});

test("player_id combineert snapshots en gebruikt de meest recente naam en foto, ook na nul stemmen",()=>{
  const {standings}=buildSeasonStandings([match("1",[player("same",4,"Oude naam")],true,"2026-08-01T12:00:00Z"),match("2",[player("same",2,"Nieuwe naam")],true,"2026-08-08T12:00:00Z"),match("3",[player("same",0,"Nieuwste naam")],true,"2026-08-15T12:00:00Z")]);
  assert.equal(standings.length,1);assert.equal(standings[0].name_snapshot,"Nieuwste naam");assert.equal(standings[0].points,10);assert.equal(standings[0].matches,2);
});

test("tie-breakers volgen punten, podiumplaatsen, stemmen, wedstrijden en naam",()=>{
  const {standings}=buildSeasonStandings([match("1",[player("first",4),player("second",3),player("alpha",2),player("beta",2)]),match("2",[player("second",4),player("first",3),player("beta",2),player("alpha",2)])]);
  assert.deepEqual(standings.slice(0,2).map(row=>row.player_id),["first","second"]);
  assert.deepEqual(standings.slice(2).map(row=>row.player_id),["alpha","beta"]);
});

test("standroute filtert server-side op seizoen, gesloten en niet-verwijderd",()=>{
  const source=readFileSync(new URL("../api/motm/stand.ts",import.meta.url),"utf8");
  assert.match(source,/m\.season_key=\$\{season\}/);assert.match(source,/m\.status='closed'/);assert.match(source,/m\.deleted_at IS NULL/);assert.match(source,/Telt niet mee voor de stand/);assert.doesNotMatch(source,/season_exclusion_reason/);
});

test("migratie 004 is additive, backfillt en indexeert seizoenvelden",()=>{
  const sql=readFileSync(new URL("../db/migrations/004_motm_season_standings.sql",import.meta.url),"utf8");for(const field of ["season_key","counts_for_season","season_exclusion_reason","Europe/Amsterdam","motm_matches_season_standings_idx"])assert.ok(sql.includes(field));assert.doesNotMatch(sql,/DROP|TRUNCATE|DELETE\s+FROM/i);
});
