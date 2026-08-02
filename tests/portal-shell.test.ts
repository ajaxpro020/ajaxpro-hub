import assert from "node:assert/strict";
import test from "node:test";
import { errorPage, matchHeading, matchTitle, page } from "../lib/motm-view";

const roles={analyst:"1422264769863221319"};
process.env.PORTAL_TEAM_TOOL_ROLE_IDS=roles.analyst;
const member={username:"Ajacied",avatarUrl:"https://cdn.discordapp.com/avatar.png",discordRoleIds:[]};
const analyst={...member,discordRoleIds:[roles.analyst]};

test("de Club-shell voor een gewoon lid bevat Home, Stemmen en Stand maar geen Tools",async()=>{
  const html=await page("Stemmen","<main>Inhoud</main>","",member,"motm").text();
  assert.match(html,/href="\/club"/);
  assert.match(html,/href="\/club\/motm" class="active" aria-current="page"/);
  assert.match(html,/href="\/club\/stand"/);
  assert.doesNotMatch(html,/href="\/club\/tools"/);
  assert.match(html,/Ajacied/);
  assert.match(html,/action="\/api\/auth\/logout"/);
});

test("de Club-shell toont Tools alleen met een intern toolrecht",async()=>{
  const html=await page("Tools","<main>Inhoud</main>","",analyst,"tools").text();
  assert.match(html,/href="\/club\/tools" class="active" aria-current="page"/);
  assert.match(html,/>Tools<\/a>/);
  assert.doesNotMatch(html,/>Analistentools<\/a>|>Teamtools<\/a>/);
  assert.equal((html.match(/class="mobile-nav"/g)??[]).length,1);
  assert.equal((html.match(/class="desktop-nav"/g)??[]).length,1);
});

test("thuis- en uitwedstrijden gebruiken overal dezelfde centrale volgorde",()=>{
  const home={opponent:"PSV",home_or_away:"home" as const,status:"open"};
  const away={opponent:"Feyenoord",home_or_away:"away" as const,status:"open"};
  assert.equal(matchTitle(home),"Ajax — PSV");
  assert.equal(matchTitle(away),"Feyenoord — Ajax");
  for(const status of ["open","draft","closed"] as const)assert.equal(matchTitle({...away,status}),"Feyenoord — Ajax");
  assert.match(matchHeading({...away,competition:"Eredivisie",kickoff_at:"2026-08-02T12:00:00Z",home_score:null}),/Feyenoord — Ajax/);
});

test("de Tools-403 gebruikt Home en markeert Stemmen niet actief",async()=>{
  const html=await errorPage("Geen toegang","Geen Tools.",403,member,"/club","home").text();
  assert.match(html,/href="\/club" class="active" aria-current="page"/);
  assert.doesNotMatch(html,/href="\/club\/motm" class="active"/);
});

test("Club- en MOTM-pagina's laden stylesheetversie 6",async()=>{
  const html=await page("Club","<main>Inhoud</main>","",member,"home").text();
  assert.match(html,/\/motm\.css\?v=6/);
});
