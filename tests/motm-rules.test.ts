import assert from "node:assert/strict";
import test from "node:test";
import { canVoteAt, rankResults, statusAt, voteLabel, winnerLabel } from "../lib/motm-rules";

const openAt = "2026-08-01T20:00:00.000Z";
const closeAt = "2026-08-02T20:00:00.000Z";
const match = (status: "draft"|"open"|"closed") => ({ status, scheduled_open_at: openAt, scheduled_close_at: closeAt });

test("concept vóór scheduled_open_at blijft Concept", () => {
  assert.equal(statusAt(match("draft"), new Date("2026-08-01T19:59:59Z")), "draft");
});

test("concept wordt na scheduled_open_at Open", () => {
  assert.equal(statusAt(match("draft"), new Date(openAt)), "open");
});

test("open stemming wordt na scheduled_close_at Gesloten", () => {
  assert.equal(statusAt(match("open"), new Date(closeAt)), "closed");
});

test("stemmen na scheduled_close_at wordt geweigerd", () => {
  assert.equal(canVoteAt(match("open"), new Date(closeAt)), false);
});

test("handmatig openen werkt vóór het geplande moment", () => {
  assert.equal(statusAt(match("open"), new Date("2026-08-01T18:00:00Z")), "open");
  assert.equal(canVoteAt(match("open"), new Date("2026-08-01T18:00:00Z")), true);
});

test("handmatig sluiten werkt vóór het geplande moment", () => {
  assert.equal(statusAt(match("closed"), new Date("2026-08-01T18:00:00Z")), "closed");
  assert.equal(canVoteAt(match("closed"), new Date("2026-08-01T18:00:00Z")), false);
});

const row = (id:string,votes:number) => ({ player_id:id,name_snapshot:id,image_url_snapshot:`/${id}.png`,votes });

test("spelers met nul stemmen verschijnen niet in de uitslag", () => {
  assert.deepEqual(rankResults([row("a",2),row("b",0)]).map(result=>result.player_id),["a"]);
});

test("gelijke hoogste score geeft gedeelde winnaars", () => {
  const results=rankResults([row("a",3),row("b",3),row("c",1)]);
  assert.deepEqual(results.filter(result=>result.rank===1).map(result=>result.player_id),["a","b"]);
});

test("dense ranking gebruikt opeenvolgende rangposities en maximaal drie posities", () => {
  const results=rankResults([row("a",5),row("b",5),row("c",3),row("d",1),row("e",1),row("f",0)]);
  assert.deepEqual(results.map(result=>result.rank),[1,1,2,3,3]);
});

test("enkelvoud en meervoud worden correct weergegeven", () => {
  assert.equal(voteLabel(1),"1 stem");
  assert.equal(voteLabel(2),"2 stemmen");
  assert.equal(winnerLabel(1),"1 winnaar");
  assert.equal(winnerLabel(2),"gedeelde winnaars");
});
