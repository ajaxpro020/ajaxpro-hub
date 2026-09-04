import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { matchMediaWatchClaimEntities, type MediaWatchEntity } from "../lib/media-watch-entities";

const migration = readFileSync(new URL("../db/migrations/025_media_watch_entities.sql", import.meta.url), "utf8");

const block = (start: string, end: string) => {
  const match = migration.match(new RegExp(`${start}([\\s\\S]*?)${end}`));
  assert.ok(match, `Blok ${start} ontbreekt`);
  return match[1];
};

const entityBlock = block("BACKFILL_ENTITIES_START", "BACKFILL_ENTITIES_END");
const linkBlock = block("BACKFILL_LINKS_START", "BACKFILL_LINKS_END");
const entityRows = [...entityBlock.matchAll(/\('([^']+)',\s*'(?:''|[^']+)*',\s*(?:'\{\}'|ARRAY\[[^\]]*\])::TEXT\[\],\s*(?:NULL|'[^']+')\)/g)];
const linkRows = [...linkBlock.matchAll(/\('([0-9a-f-]{36})'::UUID,\s*'([^']+)',\s*'(primary|mentioned)'\)/g)];

test("entityschema ondersteunt canonieke namen, aliases, spelers en rollen", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS media_watch_entities/);
  assert.match(migration, /slug TEXT NOT NULL UNIQUE/);
  assert.match(migration, /canonical_name TEXT NOT NULL/);
  assert.doesNotMatch(migration, /canonical_name TEXT NOT NULL UNIQUE/);
  assert.match(migration, /aliases TEXT\[\] NOT NULL DEFAULT '\{\}'::TEXT\[\]/);
  assert.match(migration, /ajax_player_id TEXT REFERENCES ajax_players\(id\) ON DELETE SET NULL/);
  assert.match(migration, /PRIMARY KEY \(claim_id, entity_id\)/);
  assert.match(migration, /role TEXT NOT NULL CHECK \(role IN \('primary', 'mentioned'\)\)/);
});

test("gecontroleerde entitybackfill bevat exact 28 unieke entities", () => {
  const slugs = entityRows.map(row => row[1]);
  assert.equal(entityRows.length, 28);
  assert.equal(new Set(slugs).size, 28);
  assert.ok(slugs.includes("john-van-t-schip"));
  assert.ok(slugs.includes("youri-regeer"));
  assert.match(entityBlock, /'John van ’t Schip', ARRAY\['John van ''t Schip'\]/);
  assert.match(entityBlock, /'Youri Regeer', ARRAY\['Regeer'\]/);
  assert.match(entityBlock, /'Tolu Arokodare', '\{\}'::TEXT\[\], 'arokodare'/);
  assert.match(entityBlock, /'Youri Regeer', ARRAY\['Regeer'\]::TEXT\[\], 'regeer'/);
});

test("gecontroleerde claimkoppelingen bevatten exact 36 rollen", () => {
  const roles = linkRows.map(row => row[3]);
  assert.equal(linkRows.length, 36);
  assert.equal(roles.filter(role => role === "primary").length, 32);
  assert.equal(roles.filter(role => role === "mentioned").length, 4);
  assert.equal(new Set(linkRows.map(row => `${row[1]}:${row[2]}`)).size, 36);
});

test("many-to-manykoppeling en claims zonder persoon blijven correct", () => {
  const claimIds = linkRows.map(row => row[1]);
  const entitySlugs = linkRows.map(row => row[2]);
  assert.ok(claimIds.filter(id => id === "463527f9-0e2b-4abb-a5e5-f6fce1a9dca1").length > 1);
  assert.ok(entitySlugs.filter(slug => slug === "sven-mislintat").length > 1);

  for (const unlinkedClaimId of [
    "66f31276-7bf2-439e-a48a-e18b61a9d4cd",
    "bfe99804-8d3d-433f-947a-69c92d116b3e",
    "604a0ce6-86ec-4023-9e36-213b4e112ae2",
    "eae9c332-cb44-45f7-8158-7b124cff70c7",
  ]) assert.equal(claimIds.includes(unlinkedClaimId), false);
});

test("migratie laat bestaande claim- en brontabellen ongemoeid", () => {
  assert.doesNotMatch(migration, /ALTER TABLE media_watch_claims/);
  assert.doesNotMatch(migration, /ALTER TABLE media_watch_source_items/);
  assert.doesNotMatch(migration, /(?:UPDATE|DELETE FROM) media_watch_(?:claims|source_items)/);
});

const entities: MediaWatchEntity[] = [
  { id: "sven", canonicalName: "Sven Mislintat", aliases: [] },
  { id: "marije", canonicalName: "Marije Haeck", aliases: [] },
  { id: "regeer", canonicalName: "Youri Regeer", aliases: ["Regeer"] },
];

test("entitymatching gebruikt alleen expliciete canonieke namen of aliases", () => {
  assert.deepEqual(matchMediaWatchClaimEntities({
    structuredText: "Sven Mislintat wilde reageren op Marije Haeck.",
    evidenceQuote: "Sven Mislintat werd om een reactie gevraagd.",
    subject: null,
  }, entities), [
    { entityId: "sven", role: "primary" },
    { entityId: "marije", role: "mentioned" },
  ]);
  assert.deepEqual(matchMediaWatchClaimEntities({
    structuredText: "Ajax verandert de selectie.",
    evidenceQuote: "Dat raakt ook Youri Regeer.",
    subject: null,
  }, entities), [{ entityId: "regeer", role: "mentioned" }]);
});

test("een alias die meerdere entities delen faalt gesloten", () => {
  const ambiguous = [...entities, { id: "ander", canonicalName: "Piet Regeer", aliases: ["Regeer"] }];
  assert.deepEqual(matchMediaWatchClaimEntities({
    structuredText: "Regeer vertrekt bij Ajax.",
    evidenceQuote: "Regeer vertrekt.",
    subject: "Regeer",
  }, ambiguous), []);
});

test("deelwoorden en niet genoemde subjecten leveren geen entitykoppeling op", () => {
  assert.deepEqual(matchMediaWatchClaimEntities({
    structuredText: "De mislintat op de transfermarkt kost Ajax veel.",
    evidenceQuote: "Ajax maakte een kostbare mislintat.",
    subject: "Sven Mislintat",
  }, entities), []);
});
