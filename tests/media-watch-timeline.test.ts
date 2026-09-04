import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  mediaWatchTypeLabel,
  renderMediaWatchLibrary,
  renderMediaWatchPersonTimeline,
  renderMediaWatchTabs,
} from "../api-impl/media-watch/timeline";
import {
  buildMediaWatchPageData,
  mediaWatchTemporalGap,
  normalizeMediaWatchSearch,
  type MediaWatchArchiveRow,
} from "../lib/media-watch-timeline";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const querySource = read("../lib/media-watch-timeline.ts");
const viewSource = read("../api-impl/media-watch/timeline.ts");
const routeSource = read("../api-impl/media-watch/index.ts");
const interactionSource = read("../media-watch.mjs");
const crawlerSource = read("../lib/media-watch-crawl.ts");
const contextSource = read("../lib/media-watch-source-context.ts");
const transferSource = read("../lib/media-watch-transfer.ts");

const mika = { id: "person-mika", slug: "mika-godts", name: "Mika Godts", aliases: ["M. Godts"] };
const jordi = { id: "person-jordi", slug: "jordi-cruijff", name: "Jordi Cruijff", aliases: [] };
const row = (overrides: Partial<MediaWatchArchiveRow> = {}): MediaWatchArchiveRow => ({
  claim_id: "statement-1",
  claim_type: "fact",
  structured_text: "Mika Godts keert terug in de basis van Ajax.",
  evidence_quote: "Mika Godts keert terug in de basis van Ajax.",
  claim_created_at: "2026-08-13T13:00:00.000Z",
  source_item_id: "source-1",
  source_revision_id: "revision-1",
  source_title: "Godts keert terug bij Ajax",
  published_at: "2026-08-13T12:00:00.000Z",
  source_text: "Mike Verweij schrijft dat Mika Godts terugkeert in de basis van Ajax.",
  source_url: "https://example.com/publicatie",
  original_medium: "De Telegraaf",
  discovered_via: "Ajax Showtime",
  journalist_name: "Mike Verweij",
  persons: [mika],
  ...overrides,
});

test("1. Archief is de standaardweergave", () => {
  assert.match(routeSource, /data\.timeline \? renderMediaWatchPersonTimeline\(data\.timeline\) : renderMediaWatchLibrary/);
  assert.match(renderMediaWatchTabs("archive"), /Archief/);
});

test("2. bibliotheek bevat echte source moments in chronologische volgorde", () => {
  const data = buildMediaWatchPageData([
    row({ claim_id: "later", source_item_id: "later", source_revision_id: null, published_at: "2026-09-01T12:00:00Z" }),
    row({ claim_id: "eerder", source_item_id: "eerder", source_revision_id: null, published_at: "2023-01-01T12:00:00Z" }),
  ]);
  assert.deepEqual(data.library.moments.map(moment => moment.sourceItemId), ["eerder", "later"]);
  assert.equal((renderMediaWatchLibrary(data.library).match(/data-library-marker/g) ?? []).length, 2);
});

test("3. meerdere uitspraken uit hetzelfde source moment geven één marker", () => {
  const data = buildMediaWatchPageData([row(), row({ claim_id: "statement-2", structured_text: "Tweede uitspraak." })]);
  assert.equal(data.library.moments.length, 1);
  assert.equal(data.library.moments[0].statements.length, 2);
  assert.equal((renderMediaWatchLibrary(data.library).match(/data-library-marker/g) ?? []).length, 1);
});

test("4. zoektekst markeert het juiste source moment zonder de rest te verwijderen", () => {
  const data = buildMediaWatchPageData([
    row(),
    row({ claim_id: "jordi", source_item_id: "source-2", source_revision_id: null, structured_text: "Jordi Cruijff presenteert zijn plan.", source_title: "Plan Cruijff", persons: [jordi] }),
  ], { search: "Mika Godts" });
  assert.equal(data.library.moments.length, 2);
  assert.equal(data.library.matchingMomentCount, 1);
  const html = renderMediaWatchLibrary(data.library);
  assert.equal((html.match(/class="mw-library-marker is-match"/g) ?? []).length, 1);
});

test("5. zoeken negeert accenten en hoofdletters", () => {
  assert.equal(normalizeMediaWatchSearch("  Mika  Gódts "), "mika godts");
});

test("6. exacte persoonszoekopdracht toont een tijdlijn-CTA", () => {
  const data = buildMediaWatchPageData([row()], { search: "Mika Godts" });
  assert.equal(data.library.matchingPerson?.slug, "mika-godts");
  assert.match(renderMediaWatchLibrary(data.library), /Open tijdlijn van <span>Mika Godts<\/span>/);
});

test("7. een bekende alias kan dezelfde persoons-CTA tonen", () => {
  const data = buildMediaWatchPageData([row()], { search: "M. Godts" });
  assert.equal(data.library.matchingPerson?.slug, "mika-godts");
});

test("8. vrije tekst toont geen incorrecte persoons-CTA", () => {
  const data = buildMediaWatchPageData([row()], { search: "trainer" });
  assert.equal(data.library.matchingPerson, null);
  assert.match(renderMediaWatchLibrary(data.library), /<a[^>]* hidden data-person-timeline>/);
});

test("9. geen zoekresultaat laat de volledige bibliotheek staan", () => {
  const data = buildMediaWatchPageData([row()], { search: "bestaat niet" });
  const html = renderMediaWatchLibrary(data.library);
  assert.equal(data.library.matchingMomentCount, 0);
  assert.match(html, /Geen uitspraken gevonden/);
  assert.equal((html.match(/data-library-marker/g) ?? []).length, 1);
});

test("10. marker opent het juiste source moment", () => {
  const html = renderMediaWatchLibrary(buildMediaWatchPageData([row()]).library);
  assert.match(html, /data-source-template="mw-source-library-0"/);
  assert.match(html, /<template id="mw-source-library-0">/);
});

test("11. meerdere uitspraken staan samen in één detail", () => {
  const html = renderMediaWatchLibrary(buildMediaWatchPageData([
    row(),
    row({ claim_id: "statement-2", claim_type: "expectation", structured_text: "Ajax verwacht hem te kunnen opstellen." }),
  ]).library);
  assert.match(html, /Mika Godts keert terug/);
  assert.match(html, /Ajax verwacht hem te kunnen opstellen/);
  assert.equal((html.match(/<template id="mw-source-library-/g) ?? []).length, 1);
});

test("12. typen zijn vertaald naar mensentaal", () => {
  assert.equal(mediaWatchTypeLabel("fact"), "Melding");
  assert.equal(mediaWatchTypeLabel("opinion"), "Mening");
  assert.equal(mediaWatchTypeLabel("expectation"), "Verwachting");
});

test("13. publieke bibliotheek en tijdlijn tonen geen technische labels", () => {
  const data = buildMediaWatchPageData([row()], { entity: "mika-godts" });
  const publicHtml = renderMediaWatchLibrary(data.library) + renderMediaWatchPersonTimeline(data.timeline!);
  assert.doesNotMatch(publicHtml, />\s*(?:claim|evidence|bewijs|primary|mentioned|entity)\s*</i);
  assert.doesNotMatch(publicHtml, /Bekijk bewijs/i);
});

test("14. source URL blijft de publicatielink", () => {
  const html = renderMediaWatchLibrary(buildMediaWatchPageData([row()]).library);
  assert.match(html, /href="https:\/\/example\.com\/publicatie"/);
  assert.match(html, /Bekijk publicatie/);
});

test("15. null original medium wordt niet gefabriceerd", () => {
  const html = renderMediaWatchLibrary(buildMediaWatchPageData([row({ original_medium: null, discovered_via: null })]).library);
  assert.doesNotMatch(html, /Oorspronkelijk medium<\/dt>/);
});

test("16. persoonstimeline blijft via entity slug bereikbaar", () => {
  const data = buildMediaWatchPageData([row()], { entity: "mika-godts", search: "Mika Godts" });
  assert.ok(data.timeline);
  const html = renderMediaWatchPersonTimeline(data.timeline!);
  assert.match(html, /Mika Godts/);
  assert.match(html, /Terug naar archief/);
  assert.match(html, /q=Mika%20Godts/);
});

test("17. persoonstimeline bevat uitsluitend gekoppelde uitspraken", () => {
  const data = buildMediaWatchPageData([
    row(),
    row({ claim_id: "jordi", source_item_id: "source-2", source_revision_id: null, structured_text: "Jordi Cruijff presenteert zijn plan.", persons: [jordi] }),
  ], { entity: "mika-godts" });
  assert.equal(data.timeline?.statementCount, 1);
  assert.doesNotMatch(renderMediaWatchPersonTimeline(data.timeline!), /presenteert zijn plan/);
});

test("18. tijdlijn behoudt echte tijdsafstand en progressrail", () => {
  const data = buildMediaWatchPageData([
    row({ claim_id: "2023", source_item_id: "2023", source_revision_id: null, published_at: "2023-04-28T12:00:00Z" }),
    row({ claim_id: "2025", source_item_id: "2025", source_revision_id: null, published_at: "2025-05-30T12:00:00Z" }),
  ], { entity: "mika-godts" });
  assert.ok(mediaWatchTemporalGap(763) > mediaWatchTemporalGap(7));
  assert.equal((renderMediaWatchPersonTimeline(data.timeline!).match(/data-progress-marker/g) ?? []).length, 2);
});

test("19. proximity gebruikt één lichte animation loop en compositor transforms", () => {
  assert.match(interactionSource, /requestAnimationFrame\(animate\)/);
  assert.match(interactionSource, /translate3d/);
  assert.doesNotMatch(interactionSource, /react|framer|motion\//i);
});

test("20. reduced motion schakelt de proximity-interactie uit", () => {
  assert.match(interactionSource, /prefers-reduced-motion/);
  assert.match(interactionSource, /reducedMotion\.matches/);
});

test("21. bibliotheek gebruikt roving tabindex en pijltjestoetsen", () => {
  assert.match(interactionSource, /ArrowLeft/);
  assert.match(interactionSource, /marker\.tabIndex = markerIndex === rovingIndex \? 0 : -1/);
});

test("22. drawer ondersteunt Escape, focus trap en focus restore", () => {
  assert.match(interactionSource, /event\.key === "Escape"/);
  assert.match(interactionSource, /sourceTrigger\?\.focus\(\)/);
  assert.match(interactionSource, /event\.key !== "Tab"/);
});

test("23. Verwerking blijft ongewijzigd bereikbaar", () => {
  assert.match(renderMediaWatchTabs("processing"), /tab=processing/);
  for (const name of ["renderProcessing", "renderCrawl", "renderSourceForm", "renderInbox"]) assert.match(routeSource, new RegExp(name));
});

test("24. export, import, crawler en X-via-secondary blijven gekoppeld", () => {
  for (const name of ["getMediaWatchExport", "previewMediaWatchImport", "confirmMediaWatchImport", "runMediaWatchCrawl"]) assert.match(routeSource, new RegExp(name));
  assert.match(transferSource, /media-watch-export-v1/);
  assert.match(crawlerSource, /Ajax Showtime/);
  assert.match(contextSource, /originalMediumForSecondaryJournalistAttribution/);
});

test("25. auth blijft gelden en publieke UI doet geen database- of AI-mutaties", () => {
  assert.match(routeSource, /getSessionWithPermission\(request, permissions\.mediaWatchManage\)/);
  assert.doesNotMatch(querySource, /\b(?:INSERT|UPDATE|DELETE)\b/i);
  assert.doesNotMatch(querySource + viewSource + interactionSource, /Workers AI|Cloudflare|OpenAI|extractClaims/i);
});
