import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { players } from "../data/players";

const byId=(id:string)=>players.find(player=>player.id===id);

test("actieve MOTM-selectie volgt Ajax Life met Ouazane als behouden aanvulling",()=>{
  assert.equal(players.length,27);
  assert.equal(new Set(players.map(player=>player.id)).size,27);
  assert.equal(byId("heerkens")?.shirtNumber,22);
  assert.equal(byId("brandt")?.shirtNumber,8);
  assert.equal(byId("dies-janse")?.shirtNumber,36);
  assert.equal(byId("arokodare")?.shirtNumber,99);
  assert.equal(byId("bounida")?.position,"Middenvelder");
  assert.equal(byId("ter-stegen"),undefined);
  assert.equal(byId("ouazane")?.name,"Abdellah Ouazane");
  assert.equal(byId("ouazane")?.shirtNumber,68);
});

test("iedere actieve speler verwijst naar een lokale 2026/27-cutout",()=>{
  for(const player of players){
    assert.match(player.imageUrl,/_2627\.(png|webp)$/);
    assert.ok(existsSync(new URL(`..${player.imageUrl}`,import.meta.url)),`${player.name} mist een afbeelding`);
  }
});
