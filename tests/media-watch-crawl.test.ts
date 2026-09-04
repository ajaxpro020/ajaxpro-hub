import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { attributionFor, contentVersionDecision, parseAjaxShowtimeArchiveResponse, parseAjaxShowtimeOverview, parseArticle, parsePXRArchiveResponse, parseRss } from "../lib/media-watch-crawl";

const crawlSource = readFileSync(new URL("../lib/media-watch-crawl.ts", import.meta.url), "utf8");

test("crawler kan bevestigde en onbekende source items fail-closed opslaan", () => {
  assert.match(crawlSource, /INSERT INTO media_watch_source_items/);
  assert.match(crawlSource, /const journalistId = attribution\.category === "mike_confirmed" \? mike\.id : null/);
  assert.match(crawlSource, /const processingStatus = attribution\.category === "mike_confirmed" \? "ready" : "new"/);
});

test("RSS-parser leest artikelen zonder trackingparameters", () => {
  const [article] = parseRss(`<rss><channel><item><title><![CDATA[Ajax en De Telegraaf]]></title><link>https://example.test/ajax?utm_source=rss</link><pubDate>Sun, 30 Aug 2026 12:00:00 GMT</pubDate></item></channel></rss>`);
  assert.equal(article.title, "Ajax en De Telegraaf");
  assert.equal(article.url, "https://example.test/ajax");
  assert.equal(article.publishedAt?.toISOString(), "2026-08-30T12:00:00.000Z");
});

test("Ajax Showtime-overzicht levert alleen artikelroutes en dedupliceert links", () => {
  const articles = parseAjaxShowtimeOverview(`<a href="/hoofdnieuws">Hoofdnieuws</a><a href="/hoofdnieuws/verweij-over-ajax">Verweij over Ajax</a><a href="/hoofdnieuws/verweij-over-ajax?comment=1">Verweij over Ajax</a><a href="https://anders.nl/hoofdnieuws/test">Niet lokaal</a>`, "https://www.ajaxshowtime.com/hoofdnieuws");
  assert.deepEqual(articles.map(article => article.url), ["https://www.ajaxshowtime.com/hoofdnieuws/verweij-over-ajax"]);
});

test("artikelparser gebruikt concrete JSON-LD-brontekst en publicatiedatum", () => {
  const parsed = parseArticle(`<script type="application/ld+json">{"@type":"NewsArticle","headline":"Mike Verweij over Ajax","datePublished":"2026-08-30T10:00:00+02:00","articleBody":"Mike Verweij vertelt in De Telegraaf uitgebreid over Ajax en de concrete ontwikkelingen rond de selectie in Amsterdam."}</script>`, { title: "Fallback", url: "https://example.test/artikel", publishedAt: null });
  assert.equal(parsed?.title, "Mike Verweij over Ajax");
  assert.match(parsed?.sourceText ?? "", /concrete ontwikkelingen/);
  assert.equal(parsed?.publishedAt?.toISOString(), "2026-08-30T08:00:00.000Z");
});

test("De Telegraaf zonder Mike blijft relevant maar krijgt geen journalist", () => {
  assert.deepEqual(attributionFor("Ajax krijgt nieuws", "De Telegraaf meldt dat Ajax een speler volgt."), {
    category: "telegraaf_unknown",
    relevant: true,
    journalistIsMike: false,
    originalMedium: "De Telegraaf",
    otherJournalist: null,
  });
});

test("expliciete Mike-attributie koppelt Mike, een losse achternaam niet", () => {
  assert.equal(attributionFor("Mike Verweij meldt Ajax-nieuws", "De details volgen later.").category, "mike_confirmed");
  assert.equal(attributionFor("Ajax-nieuws", "Verweij was aanwezig bij het duel.").journalistIsMike, false);
});

test("een expliciete Mike-publicatie op X overschrijft het secundaire oorspronkelijke medium", () => {
  const attribution = attributionFor(
    "Ajax Showtime citeert De Telegraaf",
    "De Telegraaf-journalist Mike Verweij meldt op X dat Ajax snel een beslissing verwacht.",
  );
  assert.equal(attribution.category, "mike_confirmed");
  assert.equal(attribution.originalMedium, "X");
  assert.match(crawlSource, /'secondary','article'/);
  for (const sourceName of ["Ajax Showtime", "VoetbalPrimeur"]) {
    assert.equal(attribution.originalMedium, "X", `${sourceName} houdt dezelfde generieke X-attributie`);
    assert.match(crawlSource, /discovered_via=\$\{source\.name\}/, `${sourceName} blijft discovered_via`);
  }
});

test("laat Mike Verweij op X weten bevestigt Mike via dezelfde centrale X-attributie", () => {
  const attribution = attributionFor("Ajax-nieuws", "Dat laat Mike Verweij op X weten.");
  assert.equal(attribution.category, "mike_confirmed");
  assert.equal(attribution.originalMedium, "X");
});

test("een X-attributie in alleen de titel verandert geen oorspronkelijk medium", () => {
  const attribution = attributionFor(
    "Mike Verweij meldt op X dat Ajax doorpakt",
    "Ajax speelt komende zondag een thuiswedstrijd.",
  );
  assert.equal(attribution.originalMedium, null);
});

test("de oorspronkelijke inhoud en bekende revisies worden overgeslagen", () => {
  assert.equal(contentVersionDecision("hash-a", "hash-a", false), "skip");
  assert.equal(contentVersionDecision("hash-a", "hash-b", true), "skip");
});

test("nieuwe inhoud voor een bekende URL wordt als revision opgeslagen", () => {
  assert.equal(contentVersionDecision("hash-a", "hash-b", false), "store_revision");
  assert.match(crawlSource, /INSERT INTO media_watch_source_item_revisions/);
});


test("een expliciet andere Telegraaf-journalist wordt geen Mike-kandidaat", () => {
  const attribution = attributionFor("Wim Kieft zegt wat Ajax moet doen", "De Telegraaf publiceert de column.");
  assert.equal(attribution.category, "other_journalist");
  assert.equal(attribution.relevant, false);
  assert.equal(attribution.otherJournalist, "Wim Kieft");
});

test("PXR-archiefdata wordt naar dezelfde artikelkandidaat vertaald", () => {
  const [candidate] = parsePXRArchiveResponse({ data: [{
    newsTitle: "Verweij brengt Ajax-nieuws",
    host: "https://www.voetbalprimeur.nl",
    path: "/nieuws/123/ajax.html",
    newsPublishDate: "2026-03-01T11:00:00.000Z",
    metaDescription: "De Telegraaf meldt nieuws over Ajax.",
  }] });
  assert.deepEqual(candidate, {
    title: "Verweij brengt Ajax-nieuws",
    url: "https://www.voetbalprimeur.nl/nieuws/123/ajax.html",
    publishedAt: new Date("2026-03-01T11:00:00.000Z"),
    discoveryText: "De Telegraaf meldt nieuws over Ajax.",
  });
});

test("Ajax Showtime-archiefdata bewaart bron- en excerptcontext voor voorselectie", () => {
  const [candidate] = parseAjaxShowtimeArchiveResponse({ data: [{
    title: "Ajax werkt aan transfer",
    url: "https://www.ajaxshowtime.com/hoofdnieuws/ajax-transfer",
    published_at: "2026-04-02T08:00:00.000Z",
    excerpt: "Mike Verweij schrijft over de transfer.",
    source: "De Telegraaf",
  }] });
  assert.equal(candidate.discoveryText, "Mike Verweij schrijft over de transfer.\nDe Telegraaf");
  assert.equal(candidate.publishedAt?.toISOString(), "2026-04-02T08:00:00.000Z");
});
