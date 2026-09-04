import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import type { SocialMatchdayFixture } from "../lib/socials-match-context";
import { renderSocials } from "../api-impl/socials/index";

const session:Session={userId:"staff",username:"Redactie",avatarUrl:"/avatar.png",discordRoleIds:["staff"],issuedAt:1,expiresAt:2};
const fixture:SocialMatchdayFixture={fixture_key:"ajax-psv",home_team:"Ajax",away_team:"PSV",competition:"Eredivisie",kickoff_at:"2026-08-08T18:00:00Z",provider_status:"FT",goals_home:2,goals_away:1,finished_at:"2026-08-08T20:00:00Z"};
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("de eerste render toont alleen het actieve Stats-workspace en de gedeelde instellingen",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.match(html,/data-format-workspace="stats" data-stats-workspace>/);
  assert.match(html,/data-format-workspace="quote" data-quote-workspace hidden>/);
  assert.match(html,/data-socials-root/);
  assert.match(html,/name="social-theme"/);
  assert.match(html,/name="social-output"/);
});

test("formatkaarten tonen geen extra wedstrijdcontext-tags",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.doesNotMatch(html,/class="status"/);
  assert.match(html,/data-match-context="required"/);
  assert.match(html,/data-match-context="optional"/);
});

test("formatwissel toggelt uitsluitend workspaces en bewaart de module-state",()=>{
  const main=read("../socials/main.mjs");
  assert.match(main,/root\.querySelectorAll\("\[data-format-workspace\]"\)/);
  assert.match(main,/workspace\.hidden=workspace\.dataset\.formatWorkspace!==id/);
  assert.doesNotMatch(main,/modules\[activeId\].*reset/);

  const stats=read("../socials/formats/stats.mjs");
  const quote=read("../socials/formats/quote.mjs");
  assert.match(stats,/return \{activate:render,deactivate\(\)\{\}\}/);
  assert.match(quote,/return \{activate:render,deactivate:releasePhotoUrl\}/);
  assert.match(quote,/data-quote-reset\].*quote\.value="".*name\.value=""/s);
});

test("CSS maakt hidden-workspaces ook met de bestaande grid-layout onzichtbaar",()=>{
  assert.match(read("../socials.css"),/\.socials-shell \[hidden\]\{display:none!important\}/);
});
