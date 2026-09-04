import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildLiveVoteSnapshot, buildLiveVoteTrend } from "../lib/motm-live";

test("live stemverloop berekent totalen, percentages en sorteert op stemmen",()=>{
  const snapshot=buildLiveVoteSnapshot("open",[
    {player_id:"a",name_snapshot:"Speler A",image_url_snapshot:"/a.png",votes:1},
    {player_id:"b",name_snapshot:"Speler B",image_url_snapshot:"/b.png",votes:3},
    {player_id:"c",name_snapshot:"Speler C",image_url_snapshot:"/c.png",votes:0},
  ],new Date("2026-08-03T12:00:00Z"));
  assert.equal(snapshot.total,4);
  assert.deepEqual(snapshot.players.map(row=>[row.player_id,row.votes,row.percentage]),[["b",3,75],["a",1,25],["c",0,0]]);
  assert.equal(snapshot.updatedAt,"2026-08-03T12:00:00.000Z");
});

test("stemtrend aggregeert alleen geanonimiseerde uurblokken",()=>{
  const trend=buildLiveVoteTrend([
    {bucket:"2026-08-03T14:00:00.000Z",votes:2},
    {bucket:"2026-08-03T12:00:00.000Z",votes:1},
    {bucket:"2026-08-03T13:00:00.000Z",votes:0},
  ]);
  assert.deepEqual(trend,[
    {bucket:"2026-08-03T12:00:00.000Z",votes:1},
    {bucket:"2026-08-03T14:00:00.000Z",votes:2},
  ]);
});

test("live endpoint en UI zijn alleen via centraal motm.manage-beheer bereikbaar",()=>{
  const source=readFileSync(new URL("../api-impl/motm/manage.ts",import.meta.url),"utf8");
  assert.match(source,/const manager = \(request: Request\) => getSessionWithPermission\(request, permissions\.motmManage\)/);
  assert.match(source,/if\(view==="live"&&id\)return liveVotes\(id\)/);
  assert.match(source,/Live stemverloop/);
  assert.match(source,/Cache-Control":"no-store"/);
  assert.doesNotMatch(source,/voter_discord_user_id/);
  assert.match(source,/date_trunc\('hour',created_at\)/);
  assert.match(source,/trend:buildLiveVoteTrend/);
});

test("live beheerroute en automatische polling zijn geconfigureerd",()=>{
  const config=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
  const routes=new Map(config.rewrites.map((route:{source:string;destination:string})=>[route.source,route.destination]));
  assert.equal(routes.get("/club/motm/beheer/:id/live"),"/api/motm-manage?view=live&id=:id");
  const script=readFileSync(new URL("../motm-admin.js",import.meta.url),"utf8");
  assert.match(script,/setInterval\(load,30000\)/);assert.doesNotMatch(script,/8 seconden/);assert.match(script,/textContent/);assert.doesNotMatch(script,/innerHTML/);
});

test("trendmigratie indexeert bestaande stemtijd zonder nieuwe stemtabel",()=>{
  const migration=readFileSync(new URL("../db/migrations/016_motm_vote_trend.sql",import.meta.url),"utf8");
  assert.match(migration,/motm_votes_match_created_at_idx/);
  assert.doesNotMatch(migration,/DROP|DELETE\s+FROM|CREATE TABLE/i);
});
