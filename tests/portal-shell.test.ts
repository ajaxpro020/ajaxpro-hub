import assert from "node:assert/strict";
import test from "node:test";
import { page } from "../lib/motm-view";

const roles={analyst:"1422264769863221319"};
process.env.PORTAL_TEAM_TOOL_ROLE_IDS=roles.analyst;
const member={username:"Ajacied",avatarUrl:"https://cdn.discordapp.com/avatar.png",discordRoleIds:[]};
const analyst={...member,discordRoleIds:[roles.analyst]};

test("de Club-shell voor een gewoon lid bevat alleen Home en Stemmen",async()=>{
  const html=await page("Stemmen","<main>Inhoud</main>","",member,"motm").text();
  assert.match(html,/href="\/club"/);
  assert.match(html,/href="\/club\/motm" class="active" aria-current="page"/);
  assert.doesNotMatch(html,/href="\/club\/tools"/);
  assert.match(html,/Ajacied/);
  assert.match(html,/action="\/api\/auth\/logout"/);
});

test("de Club-shell toont Teamtools alleen met een teamtoolrecht",async()=>{
  const html=await page("Teamtools","<main>Inhoud</main>","",analyst,"tools").text();
  assert.match(html,/href="\/club\/tools" class="active" aria-current="page"/);
  assert.match(html,/>Teamtools<\/a>/);
  assert.equal((html.match(/class="mobile-nav"/g)??[]).length,1);
  assert.equal((html.match(/class="desktop-nav"/g)??[]).length,1);
});
