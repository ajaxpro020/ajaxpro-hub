import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderSocials } from "../api-impl/socials/index";
import type { Session } from "../lib/discord-auth";
import type { SocialMatchdayFixture } from "../lib/socials-match-context";

const session:Session={userId:"staff",username:"Redactie",avatarUrl:"/avatar.png",discordRoleIds:["staff"],issuedAt:1,expiresAt:2};
const fixture:SocialMatchdayFixture={fixture_key:"ajax-psv",home_team:"Ajax",away_team:"PSV",competition:"Eredivisie",kickoff_at:"2026-08-08T18:00:00Z",provider_status:"FT",goals_home:2,goals_away:1,finished_at:"2026-08-08T20:00:00Z"};
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("de Socials-editor toont geen thema- of shirtkeuze meer",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.doesNotMatch(html,/name="social-theme"|socials-theme-choices|>Thema</);
  assert.doesNotMatch(html,/data-preview-theme|data-outblinker-theme|data-social-theme/);
});

test("de centrale editor en actieve formats bevatten geen themalogica",()=>{
  const main=read("../socials/main.mjs");
  assert.match(main,/const sharedState=\{\}/);
  assert.match(main,/const formats=new Map\(formatDefinitions\.map/);
  assert.doesNotMatch(main,/themeInputs|updateTheme|sharedState\.theme/);
  assert.doesNotMatch(read("../socials/formats/stats.mjs"),/dataset\.theme|themeLabel/);
  assert.doesNotMatch(read("../socials/formats/outblinker.mjs"),/dataset\.theme|themeLabel/);
});
