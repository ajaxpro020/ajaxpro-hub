import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  amsterdamDateKey,
  amsterdamLocalToUtc,
  countdownParts,
  modeForMatch,
  nextProviderDelayMs,
  selectProviderFixture,
} from "../lib/matchday-live";

test("Amsterdamse aftraptijd volgt zomer- en wintertijd", () => {
  assert.equal(amsterdamLocalToUtc(2026, 1, 15, 20, 0).toISOString(), "2026-01-15T19:00:00.000Z");
  assert.equal(amsterdamLocalToUtc(2026, 8, 15, 20, 0).toISOString(), "2026-08-15T18:00:00.000Z");
  assert.equal(amsterdamDateKey(new Date("2026-08-05T22:30:00Z")), "2026-08-06");
});

test("countdown ondersteunt meerdere dagen, minder dan een uur en wordt nooit negatief", () => {
  const now = new Date("2026-08-05T10:00:00Z");
  assert.deepEqual(countdownParts("2026-08-07T12:43:00Z", now), { days: 2, hours: 2, minutes: 43, totalMilliseconds: 182_580_000 });
  assert.equal(countdownParts("2026-08-05T10:43:00Z", now).minutes, 43);
  assert.equal(countdownParts("2026-08-05T09:00:00Z", now).totalMilliseconds, 0);
});

test("topbar wisselt bij aftrap, live, rust, verlenging, penalty's en einde", () => {
  const kickoff = "2026-08-05T18:00:00Z";
  assert.equal(modeForMatch({ kickoff, providerStatus: "NS" }, new Date("2026-08-05T17:59:59Z")), "countdown");
  assert.equal(modeForMatch({ kickoff, providerStatus: "NS" }, new Date(kickoff)), "live");
  for (const status of ["1H", "2H", "HT", "ET", "P"]) assert.equal(modeForMatch({ kickoff, providerStatus: status }, new Date(kickoff)), "live");
  for (const status of ["FT", "AET", "PEN"]) assert.equal(modeForMatch({ kickoff, providerStatus: status }, new Date(kickoff)), "hidden");
});

test("callstrategie bewaakt rust, fouten en grenscalls 94, 95, 99 en 100", () => {
  assert.equal(nextProviderDelayMs({ status: "1H", calls: 93 }), 60_000);
  assert.equal(nextProviderDelayMs({ status: "1H", calls: 94 }), 300_000);
  assert.equal(nextProviderDelayMs({ status: "2H", calls: 95 }), 300_000);
  assert.equal(nextProviderDelayMs({ status: "ET", calls: 99 }), 300_000);
  assert.equal(nextProviderDelayMs({ status: "P", calls: 100 }), null);
  assert.equal(nextProviderDelayMs({ status: "HT", calls: 20 }), 960_000);
  assert.equal(nextProviderDelayMs({ status: "1H", calls: 20, failed: true }), 300_000);
  assert.equal(nextProviderDelayMs({ status: "FT", calls: 20 }), null);
});

test("fixturekoppeling respecteert thuis- en uitvolgorde", () => {
  const fixtures = [{ fixture: { id: 12, date: "2026-08-05T18:00:00Z" }, teams: { home: { name: "Ajax" }, away: { name: "Shelbourne FC" } } }];
  assert.equal(selectProviderFixture(fixtures, { home: "Ajax", away: "Shelbourne FC", kickoff: "2026-08-05T18:00:00Z" })?.fixture.id, 12);
  assert.equal(selectProviderFixture(fixtures, { home: "Shelbourne FC", away: "Ajax", kickoff: "2026-08-05T18:00:00Z" }), undefined);
});

test("servercache reserveert calls atomisch en frontend belt alleen AjaxPro", () => {
  const endpoint = readFileSync(new URL("../api/next-match.ts", import.meta.url), "utf8");
  const frontend = readFileSync(new URL("../script.js", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../db/migrations/005_matchday_live.sql", import.meta.url), "utf8");
  assert.match(endpoint, /FOR UPDATE/);
  assert.match(endpoint, /refresh_locked_until/);
  assert.match(endpoint, /elapsed_extra/);
  assert.match(endpoint, /x-apisports-key/);
  assert.match(endpoint, /stale-if-error=86400/);
  assert.doesNotMatch(frontend, /api-sports|API_FOOTBALL_KEY/);
  assert.match(frontend, /fetch\("\/api\/next-match"/);
  assert.match(migration, /CHECK \(calls >= 0 AND calls <= 100\)/);
});
