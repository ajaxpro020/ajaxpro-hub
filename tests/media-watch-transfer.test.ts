import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildMediaWatchExportDocument,
  MEDIA_WATCH_EXPORT_VERSION,
  MEDIA_WATCH_IMPORT_VERSION,
  validateMediaWatchImport,
  type MediaWatchEntityRecord,
  type MediaWatchRevisionRecord,
} from "../lib/media-watch-transfer";

const sourceId = "00000000-0000-4000-8000-000000000001";
const revisionAId = "00000000-0000-4000-8000-000000000011";
const revisionBId = "00000000-0000-4000-8000-000000000012";
const entityId = "00000000-0000-4000-8000-000000000021";

const revision = (overrides: Partial<MediaWatchRevisionRecord> = {}): MediaWatchRevisionRecord => ({
  revisionId: revisionAId,
  sourceItemId: sourceId,
  journalistId: "00000000-0000-4000-8000-000000000031",
  journalistName: "Mike Verweij",
  title: "Ajax haalt Jordi Cruijff",
  url: "https://example.test/ajax",
  publishedAt: "2026-01-01T12:00:00.000Z",
  observedAt: "2026-01-02T12:00:00.000Z",
  originalMedium: "De Telegraaf",
  discoveredVia: "VoetbalPrimeur",
  sourceKind: "primary",
  sourceFormat: "article",
  sourceText: "Mike Verweij meldt dat Jordi Cruijff naar Ajax komt.",
  contentHash: "hash-a",
  ...overrides,
});

const entities: MediaWatchEntityRecord[] = [{
  id: entityId,
  canonicalName: "Jordi Cruijff",
  aliases: ["Cruijff"],
  ajaxPlayerId: null,
}];

const accepted = (overrides: Record<string, unknown> = {}) => ({
  source_item_id: sourceId,
  revision_id: revisionAId,
  decision: "accepted",
  claims: [{
    claim: "Jordi Cruijff komt naar Ajax.",
    claim_type: "fact",
    evidence_quote: "Jordi Cruijff naar Ajax komt",
    entities: [{ entity_id: entityId, canonical_name: "Jordi Cruijff", role: "primary" }],
  }],
  ...overrides,
});

const payload = (...sources: unknown[]) => ({ schema_version: MEDIA_WATCH_IMPORT_VERSION, sources });

test("export gebruikt een versioned schema, revision-ids en bestaande entities", () => {
  const result = buildMediaWatchExportDocument([revision()], entities, new Date("2026-09-03T10:00:00Z"));
  assert.equal(result.schema_version, MEDIA_WATCH_EXPORT_VERSION);
  assert.equal(result.source_count, 1);
  assert.equal(result.sources[0].revision_id, revisionAId);
  assert.equal(result.sources[0].source_passage, revision().sourceText);
  assert.deepEqual(result.existing_entities[0], { entity_id: entityId, canonical_name: "Jordi Cruijff", aliases: ["Cruijff"] });
});

test("secondary export bevat alleen expliciet aan Mike toegeschreven passage", () => {
  const secondary = revision({ sourceKind: "secondary", sourceText: "Gerucht zonder bron. Volgens Mike Verweij komt Jordi Cruijff naar Ajax. Andere tekst." });
  const result = buildMediaWatchExportDocument([secondary], entities);
  assert.equal(result.sources[0].source_passage, "Volgens Mike Verweij komt Jordi Cruijff naar Ajax.");
});

test("accepted import met letterlijke evidence en bestaande entity valideert", () => {
  const preview = validateMediaWatchImport(payload(accepted()), [revision()], entities, new Set());
  assert.equal(preview.valid, true);
  assert.equal(preview.acceptedSources, 1);
  assert.equal(preview.claimCount, 1);
  assert.equal(preview.existingEntitiesUsed, 1);
});

test("rejected import vereist reden, maakt nul claims en valideert", () => {
  const rejected = { source_item_id: sourceId, revision_id: revisionAId, decision: "rejected", reason: "Geen zelfstandige claim.", claims: [] };
  const preview = validateMediaWatchImport(payload(rejected), [revision()], entities, new Set());
  assert.equal(preview.valid, true);
  assert.equal(preview.rejectedSources, 1);
  assert.equal(preview.claimCount, 0);
});

test("accepted zonder claim en rejected met claim falen gesloten", () => {
  const noClaim = validateMediaWatchImport(payload(accepted({ claims: [] })), [revision()], entities, new Set());
  assert.equal(noClaim.valid, false);
  assert.match(noClaim.errors.join("\n"), /minimaal één claim/);
  const rejectedWithClaim = validateMediaWatchImport(payload(accepted({ decision: "rejected", reason: "Nee" })), [revision()], entities, new Set());
  assert.equal(rejectedWithClaim.valid, false);
  assert.match(rejectedWithClaim.errors.join("\n"), /moet leeg zijn/);
});

test("evidencequote moet letterlijk in revision én geëxporteerde passage staan", () => {
  const preview = validateMediaWatchImport(payload(accepted({ claims: [{ ...accepted().claims[0], evidence_quote: "Niet letterlijk aanwezig" }] })), [revision()], entities, new Set());
  assert.equal(preview.valid, false);
  assert.match(preview.errors.join("\n"), /niet letterlijk/);
});

test("verkeerde revision/source-combinatie wordt geweigerd", () => {
  const wrongSource = "00000000-0000-4000-8000-000000000099";
  const preview = validateMediaWatchImport(payload(accepted({ source_item_id: wrongSource })), [revision()], entities, new Set());
  assert.equal(preview.valid, false);
  assert.match(preview.errors.join("\n"), /hoort niet bij/);
});

test("onbekende revision wordt geweigerd", () => {
  const preview = validateMediaWatchImport(payload(accepted({ revision_id: "00000000-0000-4000-8000-000000000098" })), [revision()], entities, new Set());
  assert.equal(preview.valid, false);
  assert.match(preview.errors.join("\n"), /geen bevestigde Mike/);
});

test("entity-id moet exact bij canonical name of alias horen", () => {
  const badEntity = { ...accepted().claims[0], entities: [{ entity_id: entityId, canonical_name: "Andere Persoon", role: "primary" }] };
  const preview = validateMediaWatchImport(payload(accepted({ claims: [badEntity] })), [revision()], entities, new Set());
  assert.equal(preview.valid, false);
  assert.match(preview.errors.join("\n"), /horen niet bij elkaar/);
});

test("null entity-id hergebruikt een exacte bestaande alias zonder fuzzy match", () => {
  const aliasEntity = { ...accepted().claims[0], entities: [{ entity_id: null, canonical_name: "Cruijff", role: "mentioned" }] };
  const preview = validateMediaWatchImport(payload(accepted({ claims: [aliasEntity] })), [revision()], entities, new Set());
  assert.equal(preview.valid, true);
  assert.equal(preview.existingEntitiesUsed, 1);
  assert.deepEqual(preview.newEntityNames, []);
});

test("onbekende exacte naam met null id wordt als nieuwe entity gepland", () => {
  const newEntity = { ...accepted().claims[0], entities: [{ entity_id: null, canonical_name: "Takehiro Tomiyasu", role: "primary" }] };
  const preview = validateMediaWatchImport(payload(accepted({ claims: [newEntity] })), [revision()], entities, new Set());
  assert.equal(preview.valid, true);
  assert.deepEqual(preview.newEntityNames, ["Takehiro Tomiyasu"]);
});

test("ongeldige role, schema-versie en onverwachte velden worden geweigerd", () => {
  const wrongRole = { ...accepted().claims[0], entities: [{ entity_id: entityId, canonical_name: "Jordi Cruijff", role: "subject" }] };
  const invalid = { schema_version: "v2", extra: true, sources: [accepted({ claims: [wrongRole] })] };
  const preview = validateMediaWatchImport(invalid, [revision()], entities, new Set());
  assert.equal(preview.valid, false);
  assert.match(preview.errors.join("\n"), /onverwacht veld 'extra'/);
  assert.match(preview.errors.join("\n"), /media-watch-import-v1/);
  assert.match(preview.errors.join("\n"), /primary of mentioned/);
});

test("duplicate revision in één bestand wordt geweigerd", () => {
  const preview = validateMediaWatchImport(payload(accepted(), accepted()), [revision()], entities, new Set());
  assert.equal(preview.valid, false);
  assert.match(preview.errors.join("\n"), /meer dan één keer/);
});

test("reeds verwerkte revision is idempotent en wordt skipped", () => {
  const preview = validateMediaWatchImport(payload(accepted()), [revision()], entities, new Set([revisionAId]));
  assert.equal(preview.valid, true);
  assert.equal(preview.readySources, 0);
  assert.equal(preview.skippedSources, 1);
  assert.equal(preview.claimCount, 0);
});

test("nieuwe revision van hetzelfde source item blijft verwerkbaar", () => {
  const revisionB = revision({ revisionId: revisionBId, contentHash: "hash-b", sourceText: "Mike Verweij meldt dat Jordi Cruijff naar Ajax komt. Nieuwe versie." });
  const preview = validateMediaWatchImport(payload(accepted({ revision_id: revisionBId })), [revision(), revisionB], entities, new Set([revisionAId]));
  assert.equal(preview.valid, true);
  assert.equal(preview.readySources, 1);
  assert.equal(preview.skippedSources, 0);
});

test("partiële import raakt alleen aanwezige revisions; omitted revision blijft buiten plan", () => {
  const revisionB = revision({ revisionId: revisionBId, contentHash: "hash-b" });
  const preview = validateMediaWatchImport(payload(accepted()), [revision(), revisionB], entities, new Set());
  assert.equal(preview.valid, true);
  assert.equal(preview.totalSources, 1);
  assert.equal(preview.sources.some(source => source.revision_id === revisionBId), false);
});

test("databasequery exporteert alleen confirmed Mike, onverwerkt, oudste eerst en zonder datumlimiet", () => {
  const source = readFileSync(new URL("../lib/media-watch-transfer.ts", import.meta.url), "utf8");
  const exportBlock = source.slice(source.indexOf("export const getMediaWatchExport"), source.indexOf("export const countUnprocessedMediaWatchRevisions"));
  assert.match(exportBlock, /j\.slug='mike-verweij' AND p\.revision_id IS NULL/);
  assert.match(exportBlock, /ORDER BY r\.published_at ASC,r\.observed_at ASC/);
  assert.doesNotMatch(exportBlock, /INTERVAL|published_at\s*>|INSERT|UPDATE|DELETE/i);
});

test("migration koppelt claims en processing aan revisions zonder bestaande claims te wijzigen", () => {
  const migration = readFileSync(new URL("../db/migrations/026_media_watch_revision_processing.sql", import.meta.url), "utf8");
  assert.match(migration, /source_revision_id UUID/);
  assert.match(migration, /FOREIGN KEY \(revision_id, source_item_id\)/);
  assert.match(migration, /result TEXT NOT NULL CHECK \(result IN \('accepted', 'rejected'\)\)/);
  assert.match(migration, /ON CONFLICT \(source_item_id, deduplication_hash\) DO NOTHING/);
  assert.doesNotMatch(migration, /(?:UPDATE|DELETE FROM) media_watch_claims/i);
});

test("export, import en crawler bevatten geen AI-calls of secrets", () => {
  const source = ["../lib/media-watch-transfer.ts", "../lib/media-watch-crawl.ts", "../api-impl/media-watch/index.ts"]
    .map(path => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(source, /OpenAI|Workers AI|Cloudflare AI|api[_-]?key|AI_SECRET/i);
});
