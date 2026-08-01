import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
test("openbare deelroute en bestaande interne stemroute blijven beide bestaan",()=>{
  const routes=new Map(config.rewrites.map((route:{source:string;destination:string})=>[route.source,route.destination]));
  assert.equal(routes.get("/stem/:slug"),"/api/motm/share?slug=:slug");
  assert.equal(routes.get("/club/stemmen/:slug"),"/api/motm/vote?slug=:slug");
});
