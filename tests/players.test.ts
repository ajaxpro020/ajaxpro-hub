import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { players } from "../data/players";

const byId=(id:string)=>players.find(player=>player.id===id);

test("actieve MOTM-selectie bevat de actuele unieke spelersgroep",()=>{
  assert.equal(players.length,27);
  assert.equal(new Set(players.map(player=>player.id)).size,27);
  assert.equal(byId("amrabat")?.shirtNumber,4);
  assert.equal(byId("amrabat")?.position,"Middenvelder");
  assert.equal(byId("tsygankov")?.shirtNumber,11);
  assert.equal(byId("tsygankov")?.position,"Aanvaller");
  assert.equal(byId("kehrer")?.shirtNumber,6);
  assert.equal(byId("kehrer")?.position,"Verdediger");
  assert.equal(byId("adingra")?.shirtNumber,7);
  assert.equal(byId("adingra")?.position,"Aanvaller");
  assert.equal(byId("heerkens")?.shirtNumber,22);
  assert.equal(byId("brandt")?.shirtNumber,8);
  assert.equal(byId("arokodare")?.shirtNumber,99);
  assert.equal(byId("bounida")?.position,"Middenvelder");
  assert.equal(byId("ter-stegen")?.name,"Marc-André ter Stegen");
  assert.equal(byId("ter-stegen")?.shirtNumber,1);
  assert.equal(byId("dies-janse")?.shirtNumber,36);
  assert.equal(byId("ouazane")?.shirtNumber,68);
  assert.equal(byId("jofre-torrents")?.position,"Verdediger");
  assert.equal(byId("jofre-torrents")?.shirtNumber,21);
  assert.equal(byId("regeer"),undefined);
  assert.equal(byId("carrizo"),undefined);
  assert.equal(byId("kaplan"),undefined);
  assert.equal(byId("van-axel-dongen"),undefined);
  assert.equal(byId("reverson"),undefined);
  assert.equal(byId("konadu"),undefined);
  assert.equal(byId("sutalo"),undefined);
  assert.equal(byId("itakura"),undefined);
  assert.equal(byId("godts"),undefined);
});

test("iedere actieve speler verwijst naar een lokale 2026/27-cutout",()=>{
  for(const player of players){
    assert.match(player.imageUrl,/_2627\.(png|webp|jpg)$|motm-winner-placeholder\.svg$/);
    assert.ok(existsSync(new URL(`..${player.imageUrl}`,import.meta.url)),`${player.name} mist een afbeelding`);
  }
});
