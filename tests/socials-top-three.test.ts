import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import type { SocialMatchdayFixture } from "../lib/socials-match-context";
import { renderSocials } from "../api-impl/socials/index";
import { players } from "../data/players";

const loadTopThree=async()=>{
  // De browsermodule heeft bewust geen apart declaration-bestand.
  // @ts-expect-error De pure selectiehelpers zijn ook in Node uitvoerbaar.
  return import("../socials/formats/top-three.mjs");
};
const session:Session={userId:"staff",username:"Redactie",avatarUrl:"/avatar.png",discordRoleIds:["staff"],issuedAt:1,expiresAt:2};
const fixture:SocialMatchdayFixture={fixture_key:"fortuna-ajax",home_team:"Fortuna Sittard",away_team:"Ajax",competition:"Eredivisie",kickoff_at:"2026-09-12T18:00:00Z",provider_status:"FT",goals_home:1,goals_away:5,finished_at:"2026-09-12T20:00:00Z"};
const brandt={fotmobId:516846,optaId:177591,name:"Julian Brandt",rating:8.07,goals:1,assists:0,xg:.77,xa:.09,shotsOnTarget:4,chancesCreated:0,passAccuracy:87.9,duelsWon:null,tackles:0,interceptions:0};
const kehrer={fotmobId:78910,optaId:123,name:"Thilo Kehrer",rating:7.51,goals:0,assists:1,xg:0,xa:.23,shotsOnTarget:0,chancesCreated:2,passAccuracy:91.2,duelsWon:5,tackles:2,interceptions:1};
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Top 3 rendert drie lege handmatige spelerskeuzes",async()=>{
  const html=await renderSocials(session,async()=>[fixture],async()=>players).then(response=>response.text());
  assert.match(html,/data-format-id="top-three"/);
  assert.match(html,/data-format-workspace="top-three" data-top-three-workspace hidden/);
  assert.equal((html.match(/data-top-three-player-slot=/g)??[]).length,3);
  assert.equal((html.match(/data-top-three-preview-player=/g)??[]).length,3);
  assert.equal((html.match(/<option value="">Stats eerst ophalen<\/option>/g)??[]).length,3);
  assert.match(html,/0 van 3 spelers gekozen/);
});

test("gekozen spelers worden in andere slots uitgeschakeld",async()=>{
  const {playerOptionsFor}=await loadTopThree();
  const options=playerOptionsFor([brandt,kehrer],["fotmob:516846","",""],1);
  assert.equal(options.find((option:{key:string})=>option.key==="fotmob:516846")?.disabled,true);
  assert.equal(options.find((option:{key:string})=>option.key==="fotmob:78910")?.disabled,false);
});

test("FotMob-spelling Tsigankov koppelt via stabiel ID aan de bestaande AjaxPro-foto",async()=>{
  const {registryPhotoFor}=await loadTopThree();
  const registry=registryPhotoFor({fotmobId:564847,optaId:194282,name:"Viktor Tsigankov"},players);
  assert.equal(registry?.id,"tsygankov");
  assert.equal(registry?.imageUrl,"/assets/players/motm/tsygankov_2627.png");
});

test("maximaal twee interessante niet-nulstats volgen de afgesproken voorkeur",async()=>{
  const {interestingStatsFor}=await loadTopThree();
  assert.deepEqual(interestingStatsFor(brandt).map((stat:{id:string})=>stat.id),["goals","xg"]);
  assert.deepEqual(interestingStatsFor(kehrer).map((stat:{id:string})=>stat.id),["assists","xa"]);
  assert.deepEqual(interestingStatsFor({...brandt,goals:null,xg:null,xa:null,shotsOnTarget:null,passAccuracy:0}).map((stat:{id:string})=>stat.id),[]);
});

test("Top 3 gebruikt alleen gedeelde state en declareert alle requirements",()=>{
  const source=read("../socials/formats/top-three.mjs");
  assert.match(source,/sharedState\.getMatchStats/);
  assert.match(source,/requirements:\["matchData","matchStats","playerStats","playerPhoto"\]/);
  assert.match(source,/reset\(\)\{selections=\["","",""\];render\(\)\}/);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|fotmob\.com/);
});

test("Top 3 heeft eigen hiërarchische 4:5- en 9:16-composities",()=>{
  const css=read("../socials.css");
  assert.match(css,/\.top-three-preview\{[^}]*aspect-ratio:4\/5/);
  assert.match(css,/\.top-three-preview__player--hero\{[^}]*width:68%/);
  assert.match(css,/\.top-three-preview\[data-aspect=vertical-9x16\]\{aspect-ratio:9\/16/);
  assert.match(css,/vertical-9x16[^\n]*\.top-three-preview__player--hero\{[^}]*height:72%/);
  assert.doesNotMatch(css,/\.top-three-preview[^\n]*(border-radius:999px|podium|medal|gold|silver|bronze)/i);
});
