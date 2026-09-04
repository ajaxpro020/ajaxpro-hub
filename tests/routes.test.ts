import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
test("openbare deelroute en bestaande interne stemroute blijven beide bestaan",()=>{
  const routes=new Map(config.rewrites.map((route:{source:string;destination:string})=>[route.source,route.destination]));
  assert.equal(routes.get("/stem/:slug"),"/api/motm-public?action=share&slug=:slug");
  assert.equal(routes.get("/club/stemmen/:slug"),"/api/motm-public?action=vote&slug=:slug");
  assert.equal(routes.get("/club/stand"),"/api/motm-public?action=stand");
  assert.equal(routes.get("/api/motm"),"/api/motm-public?action=index");
  assert.equal(routes.get("/api/motm/vote"),"/api/motm-public?action=vote");
  assert.equal(routes.get("/api/motm/stand"),"/api/motm-public?action=stand");
  assert.equal(routes.get("/api/motm/share"),"/api/motm-public?action=share");
  assert.equal(routes.get("/api/motm/manage"),"/api/motm-manage");
  assert.equal(routes.get("/club/tools/socials"),"/api/club-tools?view=socials");
  assert.equal(routes.get("/club/tools/media-watch"),"/api/club-tools?view=media-watch");
  for(const [source,destination] of routes)assert.doesNotMatch(`${source} ${destination}`,/transfer-talk/i);
});

test("Socials gebruikt de bestaande club-tools serverless function",()=>{
  assert.equal(config.rewrites.find((route:{source:string})=>route.source==="/club/tools/socials")?.destination,"/api/club-tools?view=socials");
  assert.equal(config.functions["api/socials.ts"],undefined);
});

test("Media Watch gebruikt de bestaande club-tools serverless function",()=>{
  assert.equal(config.rewrites.find((route:{source:string})=>route.source==="/club/tools/media-watch")?.destination,"/api/club-tools?view=media-watch");
  assert.equal(config.functions["api/media-watch.ts"],undefined);
});

test("programma wordt dagelijks automatisch ververst via de bestaande match-API",()=>{
  assert.deepEqual(config.crons.find((cron:{path:string})=>cron.path==="/api/next-match?view=program"),{
    path:"/api/next-match?view=program",
    schedule:"0 5 * * *",
  });
});

test("Media Watch hergebruikt Vercel Cron eenmaal per dag",()=>{
  assert.deepEqual(config.crons.find((cron:{path:string})=>cron.path==="/api/media-watch-daily"),{
    path:"/api/media-watch-daily",
    schedule:"20 4 * * *",
  });
  assert.equal(config.functions["api/media-watch-daily.ts"].maxDuration,300);
});
