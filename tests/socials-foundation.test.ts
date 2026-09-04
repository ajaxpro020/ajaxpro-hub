import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { socialFormats, socialOutputFormats } from "../lib/socials";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Socials registreert formats met een eigen matchContext-behoefte",()=>{
  assert.deepEqual(socialFormats.map(format=>({id:format.id,matchContext:format.matchContext})),[
    {id:"stats",matchContext:"required"},
    {id:"quote",matchContext:"optional"},
    {id:"player-stats",matchContext:"required"},
  ]);
});

test("Socials registreert uitsluitend de twee afgesproken outputformaten",()=>{
  assert.deepEqual(socialOutputFormats.map(({width,height})=>[width,height]),[[1080,1350],[1080,1920]]);
});

test("Socials leest recente en eerstvolgende wedstrijd uit de bestaande matchday-tabel",()=>{
  const source=read("../lib/socials-match-context.ts");
  assert.match(source,/FROM matchday_fixtures WHERE kickoff_at<=now\(\)/);
  assert.match(source,/FROM matchday_fixtures WHERE kickoff_at>now\(\)/);
  assert.doesNotMatch(source,/INSERT|UPDATE|DELETE|CREATE TABLE/i);
});

test("Socials blijft onderdeel van club-tools en maakt geen eigen API-entrypoint",()=>{
  const tools=read("../api/club-tools.ts");
  assert.match(tools,/permissions\.toolsSocials/);
  assert.match(tools,/renderSocials/);
  assert.throws(()=>read("../api/socials.ts"));
});
