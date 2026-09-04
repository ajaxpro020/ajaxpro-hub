import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import { renderSocials } from "../api-impl/socials/index";
import type { SocialMatchdayFixture } from "../lib/socials-match-context";
import { isValidStatsValue, statsFields } from "../lib/socials-stats";

const session:Session={userId:"staff",username:"Redactie",avatarUrl:"/avatar.png",discordRoleIds:["staff"],issuedAt:1,expiresAt:2};
const fixture:SocialMatchdayFixture={fixture_key:"ajax-psv",home_team:"Ajax",away_team:"PSV",competition:"Eredivisie",kickoff_at:"2026-08-08T18:00:00Z",provider_status:"FT",goals_home:2,goals_away:1,finished_at:"2026-08-08T20:00:00Z"};
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Stats heeft exact de zes vaste velden",()=>{
  assert.deepEqual(statsFields.map(field=>field.label),["xG","Balbezit","Schoten","Schoten op doel","Corners","Overtredingen"]);
  assert.deepEqual(statsFields.map(field=>field.kind),["decimal","percentage","integer","integer","integer","integer"]);
});

test("Stats gebruikt een expliciete responsive label- en invoerstructuur",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.equal((html.match(/class="stats-field-label"/g)??[]).length,statsFields.length);
  assert.doesNotMatch(html,/class="stats-field"[^>]*>\s*<legend/);
});

test("Stats-validatie accepteert lege en passende waarden en weigert ongeldige invoer",()=>{
  for(const id of statsFields.map(field=>field.id))assert.equal(isValidStatsValue(id,""),true);
  assert.equal(isValidStatsValue("xg","1.42"),true);
  assert.equal(isValidStatsValue("xg","1.234"),false);
  assert.equal(isValidStatsValue("possession","54.5"),true);
  assert.equal(isValidStatsValue("possession","101"),false);
  assert.equal(isValidStatsValue("shots","12"),true);
  assert.equal(isValidStatsValue("shots","12.5"),false);
  assert.equal(isValidStatsValue("unknown","1"),false);
});

test("Stats rendert vaste Ajax- en tegenstandervelden met beide outputformaten",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.equal((html.match(/data-stat-id=/g)??[]).length,12);
  assert.equal((html.match(/data-team="ajax"/g)??[]).length,6);
  assert.equal((html.match(/data-team="opponent"/g)??[]).length,6);
  assert.match(html,/value="portrait-4x5"[^>]*data-width="1080" data-height="1350"/);
  assert.match(html,/value="vertical-9x16"[^>]*data-width="1080" data-height="1920"/);
  assert.match(html,/Download PNG · template volgt/);
  assert.match(html,/\/socials\/main\.mjs/);
});

test("Stats blokkeert zonder vereiste wedstrijdcontext",async()=>{
  const html=await renderSocials(session,async()=>[]).then(response=>response.text());
  assert.match(html,/data-stats-unavailable/);
  assert.match(html,/Stats is nu niet beschikbaar/);
  assert.match(html,/data-stats-workspace hidden/);
  assert.match(html,/data-format-id="stats"[^>]*aria-pressed="false"[^>]*disabled/);
});

test("Stats blijft een losse formatmodule met lokale reset en zonder writes",()=>{
  const source=read("../socials/formats/stats.mjs");
  assert.match(source,/export const initStats/);
  assert.match(source,/data-stats-reset/);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
  assert.doesNotMatch(source,/matchSelect\.value\s*=/);
});
