import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderSocials } from "../api-impl/socials/index";
import type { Session } from "../lib/discord-auth";
import type { SocialMatchdayFixture } from "../lib/socials-match-context";
import { DEFAULT_SOCIAL_THEME, socialThemes } from "../lib/socials";

const session:Session={userId:"staff",username:"Redactie",avatarUrl:"/avatar.png",discordRoleIds:["staff"],issuedAt:1,expiresAt:2};
const fixture:SocialMatchdayFixture={fixture_key:"ajax-psv",home_team:"Ajax",away_team:"PSV",competition:"Eredivisie",kickoff_at:"2026-08-08T18:00:00Z",provider_status:"FT",goals_home:2,goals_away:1,finished_at:"2026-08-08T20:00:00Z"};
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Socials registreert exact de vier toegestane themawaarden met Thuis als standaard",()=>{
  assert.deepEqual(socialThemes,[
    {id:"home",label:"Thuis"},
    {id:"away",label:"Uit"},
    {id:"third",label:"3e shirt"},
    {id:"europa",label:"EL"},
  ]);
  assert.equal(DEFAULT_SOCIAL_THEME,"home");
});

test("de gedeelde Socials-shell rendert één themakeuze met de vier waarden",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.equal((html.match(/name="social-theme"/g)??[]).length,4);
  for(const {id,label} of socialThemes){
    assert.match(html,new RegExp(`name="social-theme" value="${id}" data-theme-label="${label}"`));
  }
  assert.match(html,/name="social-theme" value="home"[^>]* checked/);
  assert.match(html,/data-socials-root data-social-theme="home"/);
});

test("Stats en Quote ontvangen dezelfde gedeelde theme-state en tonen de theme-id",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.equal((html.match(/data-theme="home"/g)??[]).length,3);
  assert.match(html,/data-preview-theme>Thema: Thuis · home/);
  assert.match(html,/data-quote-preview-theme>Thema: Thuis · home/);
  assert.match(html,/data-player-preview-theme>Thema: Thuis · home/);

  const main=read("../socials/main.mjs");
  assert.match(main,/const sharedState=\{theme:/);
  assert.match(main,/stats:initStats\(root,sharedState\),quote:initQuote\(root,sharedState\)/);
  assert.match(main,/sharedState\.theme=input\.value/);
  assert.doesNotMatch(main,/sharedState\s*=.*data-format-id/);
});

test("formatwissels bewaren de gedeelde theme-state",()=>{
  const main=read("../socials/main.mjs");
  const activate=main.slice(main.indexOf("const activate="),main.indexOf("const updateTheme="));
  assert.doesNotMatch(activate,/sharedState\.theme\s*=/);
  assert.match(read("../socials/formats/stats.mjs"),/preview\.dataset\.theme=sharedState\.theme/);
  assert.match(read("../socials/formats/quote.mjs"),/preview\.dataset\.theme=sharedState\.theme/);
});
