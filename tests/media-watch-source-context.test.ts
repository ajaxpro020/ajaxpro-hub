import assert from "node:assert/strict";
import test from "node:test";
import {
  boundedMediaWatchSourcePassage,
  explicitlyAttributedTextForJournalist,
  originalMediumForSecondaryJournalistAttribution,
  relevantMediaWatchSourceText,
} from "../lib/media-watch-source-context";

test("secundaire bronnen bewaren alleen expliciet aan Mike toegeschreven context", () => {
  const sourceText = [
    "De redactie meldt dat Ajax en Werder een akkoord bereikten.",
    "Mike Verweij schrijft: ‘Ajax geeft Youri Regeer toestemming om naar Bremen te reizen.’",
    "De Telegraaf verwacht later meer nieuws.",
  ].join("\n");
  assert.equal(
    relevantMediaWatchSourceText(sourceText, "secondary", "Mike Verweij"),
    "Ajax geeft Youri Regeer toestemming om naar Bremen te reizen.",
  );
});

test("algemene Telegraaf-attributie blijft fail-closed", () => {
  assert.equal(
    explicitlyAttributedTextForJournalist("De Telegraaf meldt dat de transfer rond is.", "Mike Verweij"),
    "",
  );
});

test("primaire bronnen behouden hun volledige brontekst", () => {
  const sourceText = "De volledige primaire brontekst blijft beschikbaar.";
  assert.equal(relevantMediaWatchSourceText(sourceText, "primary", "Mike Verweij"), sourceText);
});

test("broncontext blijft begrensd rond de letterlijke evidencequote", () => {
  const quote = "Ajax verwacht morgen een akkoord.";
  const source = `${"Voor. ".repeat(100)}${quote}${" Na. ".repeat(100)}`;
  const passage = boundedMediaWatchSourcePassage(source, quote, 140);
  assert.match(passage, /^…/);
  assert.match(passage, /Ajax verwacht morgen een akkoord\./);
  assert.match(passage, /…$/);
  assert.ok(passage.length < source.length);
  assert.equal(boundedMediaWatchSourcePassage(source, "Niet aanwezig"), "");
});

test("expliciete Mike-attributie op X krijgt X als oorspronkelijk medium", () => {
  const sourceText = "Ajax heeft een bod ontvangen, schrijft Mike Verweij op X.";
  assert.equal(originalMediumForSecondaryJournalistAttribution(sourceText, "Mike Verweij"), "X");
  assert.match(relevantMediaWatchSourceText(sourceText, "secondary", "Mike Verweij"), /schrijft Mike Verweij op X/);
});

test("voorwaartse X-attributie met Mike Verweij wordt herkend", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("Dat meldt Mike Verweij op X.", "Mike Verweij"),
    "X",
  );
});

test("aldus Mike Verweij op X wordt herkend", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("Ajax houdt rekening met een vertrek, aldus Mike Verweij op X.", "Mike Verweij"),
    "X",
  );
});

test("Verweij op Twitter wordt alleen in een al bevestigde Mike-passage herkend", () => {
  const sourceText = "De Telegraaf-journalist Mike Verweij volgt Ajax. Verweij schrijft op Twitter dat Ajax een bod verwacht.";
  assert.equal(originalMediumForSecondaryJournalistAttribution(sourceText, "Mike Verweij"), "X");
  assert.match(relevantMediaWatchSourceText(sourceText, "secondary", "Mike Verweij"), /Verweij schrijft op Twitter/);
  assert.equal(originalMediumForSecondaryJournalistAttribution("Verweij schrijft op Twitter dat Ajax een bod verwacht.", "Mike Verweij"), null);
});

test("Mike Verweij laat via Twitter weten wordt herkend", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("Mike Verweij laat via Twitter weten dat Ajax door wil pakken.", "Mike Verweij"),
    "X",
  );
});

test("laat Mike Verweij op X weten wordt herkend", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("Dat laat Mike Verweij op X weten.", "Mike Verweij"),
    "X",
  );
});

test("X/Twitter-herkenning is hoofdletterongevoelig", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("mIkE vErWeIj MELDT OP tWiTtEr dat Ajax een akkoord heeft.", "Mike Verweij"),
    "X",
  );
});

test("alleen een Mike-vermelding is geen X-attributie", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("Mike Verweij was aanwezig bij Ajax.", "Mike Verweij"),
    null,
  );
});

test("volgens Mike Verweij zonder X blijft geen X-attributie", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("Volgens Mike Verweij speelt Ajax zondag thuis.", "Mike Verweij"),
    null,
  );
});

test("Mike Verweij meldt zonder X blijft geen X-attributie", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("Mike Verweij meldt dat Ajax zondag thuis speelt.", "Mike Verweij"),
    null,
  );
});

test("Mike Verweij schrijft zonder X blijft geen X-attributie", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("Mike Verweij schrijft dat Ajax zondag thuis speelt.", "Mike Verweij"),
    null,
  );
});

test("bronnen op X zonder Mike blijven geen X-attributie", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("Volgens bronnen op X bereidt Ajax een transfer voor.", "Mike Verweij"),
    null,
  );
});

test("algemene socialmedia-vermelding is geen X-attributie", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("Mike Verweij reageerde op sociale media op Ajax-nieuws.", "Mike Verweij"),
    null,
  );
});

test("een titel met X-attributie lekt niet naar de brontekst", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("De artikeltekst bevat geen toegeschreven X-publicatie.", "Mike Verweij"),
    null,
  );
});

test("een andere journalist op X wordt nooit Mike", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("Valentijn Driessen schrijft op X dat Ajax door moet selecteren.", "Mike Verweij"),
    null,
  );
});

test("een ambiguë achternaam zonder Mike-context blijft fail-closed", () => {
  assert.equal(
    originalMediumForSecondaryJournalistAttribution("Verweij meldt op X dat Ajax een speler volgt.", "Mike Verweij"),
    null,
  );
});
