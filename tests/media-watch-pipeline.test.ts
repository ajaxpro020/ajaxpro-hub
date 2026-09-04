import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { isMediaWatchCronAuthorized } from "../api/media-watch-daily";
import { MEDIA_WATCH_BACKFILL_FROM } from "../lib/media-watch-pipeline";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const pipeline = read("../lib/media-watch-pipeline.ts");
const daily = read("../api/media-watch-daily.ts");
const backfill = read("../scripts/media-watch-backfill.ts");
const crawl = read("../lib/media-watch-crawl.ts");
const admin = read("../api-impl/media-watch/index.ts");
const transfer = read("../lib/media-watch-transfer.ts");
const revisionMigration = read("../db/migrations/026_media_watch_revision_processing.sql");
const packageJson = read("../package.json");

test("backfill start exact op 1 maart 2026 en is standaard dry-run", () => {
  assert.equal(MEDIA_WATCH_BACKFILL_FROM.toISOString(), "2026-02-28T23:00:00.000Z");
  assert.match(backfill, /dryRun:\s*!execute/);
  assert.match(backfill, /includes\("--execute"\)/);
});

test("dagelijkse route faalt gesloten zonder exact cronsecret", () => {
  const request = new Request("https://ajaxpro.fans/api/media-watch-daily", {
    headers: { authorization: "Bearer juist" },
  });
  assert.equal(isMediaWatchCronAuthorized(request, undefined), false);
  assert.equal(isMediaWatchCronAuthorized(request, "fout"), false);
  assert.equal(isMediaWatchCronAuthorized(request, "juist"), true);
});

test("historische en dagelijkse pipelines verzamelen uitsluitend bronnen", () => {
  assert.match(pipeline, /runMediaWatchBackfill[\s\S]*?runMediaWatchCrawl/);
  assert.match(pipeline, /runDailyMediaWatch[\s\S]*?runMediaWatchCrawl/);
  for (const source of [pipeline, daily, backfill]) {
    assert.doesNotMatch(source, /media-watch-ai|Cloudflare|OpenAI|extractClaims|analy[sz]eReadyMediaWatchSources/i);
  }
});

test("source collection maakt geen claims en markeert niets als verwerkt", () => {
  const automaticCollection = [crawl, pipeline, daily, backfill].join("\n");
  assert.match(crawl, /INSERT INTO media_watch_source_items/);
  assert.match(crawl, /INSERT INTO media_watch_source_item_revisions/);
  assert.doesNotMatch(automaticCollection, /(?:INSERT INTO|UPDATE|DELETE FROM) media_watch_claims/i);
  assert.doesNotMatch(automaticCollection, /processing_status\s*=\s*'processed'/i);
});

test("onverwerkte bronnen hebben geen leeftijdsgrens of verwijderpad", () => {
  assert.doesNotMatch(crawl, /DELETE FROM media_watch_source_items|INTERVAL\s+'?7|published_at\s*>\s*now\(\)/i);
  assert.match(crawl, /processingStatus = attribution\.category === "mike_confirmed" \? "ready" : "new"/);
});

test("obsolete AI- en reviewbestanden blijven verwijderd en migration 026 is revision-only", () => {
  for (const path of [
    "../lib/media-watch-ai.ts",
    "../lib/media-watch-dossiers.ts",
    "../lib/media-watch-review.ts",
  ]) assert.equal(existsSync(new URL(path, import.meta.url)), false, path);
  assert.doesNotMatch(packageJson, /026_media_watch_claim_review/);
  assert.match(packageJson, /026_media_watch_revision_processing/);
  assert.match(revisionMigration, /CREATE TABLE IF NOT EXISTS media_watch_processed_revisions/);
  assert.doesNotMatch(revisionMigration, /(?:UPDATE|DELETE FROM) media_watch_claims/i);
});

test("de adminroute behoudt media-watch.manage en bevat geen obsolete acties", () => {
  assert.match(admin, /getSessionWithPermission\(request, permissions\.mediaWatchManage\)/);
  assert.match(admin, /intent === "crawl"/);
  assert.doesNotMatch(admin, /intent === "(?:analyze|review|compare)"/);
  assert.doesNotMatch(admin, /pending_review|approved|reviewed_at|reviewed_by/);
});

test("alleen de bevestigde transactionele import schrijft claims", () => {
  const automaticCollection = [crawl, pipeline, daily, backfill].join("\n");
  assert.match(admin, /SELECT claim_type,structured_text,evidence_quote/);
  assert.doesNotMatch(automaticCollection, /(?:INSERT INTO|UPDATE|DELETE FROM) media_watch_claims/i);
  assert.match(transfer, /db\(\)\.begin/);
  assert.match(transfer, /INSERT INTO media_watch_claims/);
  assert.match(transfer, /INSERT INTO media_watch_processed_revisions/);
  assert.ok(transfer.indexOf("INSERT INTO media_watch_claims") < transfer.indexOf("INSERT INTO media_watch_processed_revisions"));
});
