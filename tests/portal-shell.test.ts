import assert from "node:assert/strict";
import test from "node:test";
import { page } from "../lib/motm-view";

const user={username:"Ajacied",avatarUrl:"https://cdn.discordapp.com/avatar.png"};

test("de gedeelde Club-shell bevat alle drie hoofdroutes en profielacties",async()=>{
  const html=await page("Stemmen","<main>Inhoud</main>","",user,"motm").text();
  assert.match(html,/href="\/club"/);
  assert.match(html,/href="\/club\/motm" class="active" aria-current="page"/);
  assert.match(html,/href="\/club\/tools"/);
  assert.match(html,/Ajacied/);
  assert.match(html,/action="\/api\/auth\/logout"/);
});

test("de shell reserveert één mobiele navigatie en één desktopnavigatie",async()=>{
  const html=await page("Tools","<main>Inhoud</main>","",user,"tools").text();
  assert.equal((html.match(/class="mobile-nav"/g)??[]).length,1);
  assert.equal((html.match(/class="desktop-nav"/g)??[]).length,1);
});
