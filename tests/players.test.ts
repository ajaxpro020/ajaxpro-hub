import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { players } from "../data/players";

const byId=(id:string)=>players.find(player=>player.id===id);

test("actieve MOTM-selectie bevat de actuele unieke spelersgroep",()=>{
  assert.equal(players.length,28);
  assert.equal(new Set(players.map(player=>player.id)).size,28);
  assert.equal(byId("heerkens")?.shirtNumber,22);
  assert.equal(byId("brandt")?.shirtNumber,8);
  assert.equal(byId("dies-janse")?.shirtNumber,36);
  assert.equal(byId("arokodare")?.shirtNumber,99);
  assert.equal(byId("bounida")?.position,"Middenvelder");
  assert.equal(byId("ter-stegen")?.name,"Marc-André ter Stegen");
  assert.equal(byId("ter-stegen")?.shirtNumber,1);
  assert.equal(byId("ouazane")?.name,"Abdellah Ouazane");
  assert.equal(byId("ouazane")?.shirtNumber,68);
});

test("iedere actieve speler verwijst naar een lokale 2026/27-cutout",()=>{
  for(const player of players){
    assert.match(player.imageUrl,/_2627\.(png|webp)$/);
    assert.ok(existsSync(new URL(`..${player.imageUrl}`,import.meta.url)),`${player.name} mist een afbeelding`);
  }
});
