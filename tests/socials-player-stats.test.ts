import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import { players } from "../data/players";
import { renderSocials } from "../api-impl/socials/index";
import type { SocialMatchdayFixture } from "../lib/socials-match-context";
import { playerStatsFields, isValidPlayerStatsValue } from "../lib/socials-player-stats";
import { socialFormats, socialOutputFormats } from "../lib/socials";

const session:Session={userId:"staff",username:"Redactie",avatarUrl:"/avatar.png",discordRoleIds:["staff"],issuedAt:1,expiresAt:2};
const fixture:SocialMatchdayFixture={fixture_key:"ajax-psv",home_team:"Ajax",away_team:"PSV",competition:"Eredivisie",kickoff_at:"2026-08-08T18:00:00Z",provider_status:"FT",goals_home:2,goals_away:1,finished_at:"2026-08-08T20:00:00Z"};
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Spelerstats is als derde format met verplichte wedstrijdcontext geregistreerd",()=>{
  assert.deepEqual(socialFormats.find(format=>format.id==="player-stats"),{id:"player-stats",title:"Spelerstats",description:"Vaste individuele wedstrijdstatistieken voor een Ajax-speler.",matchContext:"required",availability:"available"});
});

test("Spelerstats gebruikt de bestaande spelersbron zonder duplicaatlijst",()=>{
  const source=read("../api-impl/socials/index.ts");
  assert.match(source,/import \{ loadPlayers, toToolPlayer \} from "\.\.\/\.\.\/lib\/player-registry"/);
  assert.match(source,/data-socials-players/);
  assert.equal(players.length,27);
});

test("Spelerstats heeft exact de acht vaste statistieken en passende validatie",()=>{
  assert.deepEqual(playerStatsFields.map(field=>field.label),["Minuten","Goals","Assists","Schoten","Schoten op doel","Kansen gecreëerd","Passnauwkeurigheid","Gewonnen duels"]);
  assert.equal(playerStatsFields.length,8);
  assert.equal(isValidPlayerStatsValue("minutes","90"),true);
  assert.equal(isValidPlayerStatsValue("passAccuracy","87"),true);
  assert.equal(isValidPlayerStatsValue("passAccuracy","101"),false);
  assert.equal(isValidPlayerStatsValue("goals","1.5"),false);
  assert.equal(isValidPlayerStatsValue("unknown","1"),false);
});

test("Spelerstats koppelt ieder veld aan de gedeelde responsive veldlayout",async()=>{
  const response=await renderSocials(session,async()=>[fixture]);
  const html=await response.text();
  assert.equal((html.match(/class="player-stat-field"/g)??[]).length,playerStatsFields.length);
});

test("Spelerstats rendert spelerselectie, bestaande foto, wedstrijdcontext en beide outputformaten",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.match(html,/data-format-id="player-stats"/);
  assert.match(html,/data-format-workspace="player-stats" data-player-stats-workspace hidden/);
  assert.equal((html.match(/data-player-stat-id=/g)??[]).length,8);
  assert.match(html,/data-player-select/);
  assert.match(html,/value="ter-stegen">Marc-André ter Stegen · #1/);
  assert.match(html,/data-player-preview-photo/);
  assert.match(html,/src="\/assets\/players\/motm\/ter-stegen_2627\.png"/);
  assert.match(html,/data-player-match-select|data-socials-match-context/);
  assert.match(html,/value="portrait-4x5"[^>]*data-width="1080" data-height="1350"/);
  assert.deepEqual(socialOutputFormats.map(({width,height})=>[width,height]),[[1080,1350],[1080,1920]]);
});

test("Spelerstats blokkeert zonder wedstrijdcontext en houdt ontbrekende foto neutraal",async()=>{
  const html=await renderSocials(session,async()=>[]).then(response=>response.text());
  assert.match(html,/data-player-stats-unavailable/);
  assert.match(html,/data-format-id="player-stats"[^>]*disabled/);
  const source=read("../socials/formats/player-stats.mjs");
  assert.match(source,/if\(player\?\.imageUrl\)/);
  assert.match(source,/data-player-preview-placeholder/);
});

test("Spelerstats blijft onafhankelijk van andere format-state en schrijft nergens heen",()=>{
  const main=read("../socials/main.mjs"),source=read("../socials/formats/player-stats.mjs");
  assert.match(main,/"player-stats":initPlayerStats\(root,sharedState\)/);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|FormData|localStorage|sessionStorage/);
  assert.doesNotMatch(source,/motm-admin|motm_votes|motm_match/);
});
