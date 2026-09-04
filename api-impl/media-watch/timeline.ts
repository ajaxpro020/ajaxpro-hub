import { esc } from "../../lib/motm-view";
import type {
  MediaWatchLibrary,
  MediaWatchPersonTimeline,
  MediaWatchSourceMoment,
  MediaWatchStatement,
} from "../../lib/media-watch-timeline";

const basePath = "/club/tools/media-watch";
const dateFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });
const shortDateFormatter = new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });
const yearFormatter = new Intl.DateTimeFormat("nl-NL", { year: "numeric", timeZone: "Europe/Amsterdam" });
const arrow = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h13M14 7l5 5-5 5"/></svg>`;
const close = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>`;

const isoDate = (value: string | Date) => new Date(value).toISOString().slice(0, 10);
const formatDate = (value: string | Date) => dateFormatter.format(new Date(value));
const formatShortDate = (value: string | Date) => shortDateFormatter.format(new Date(value)).replaceAll(".", "").toLocaleUpperCase("nl-NL");
const yearFor = (value: string | Date) => yearFormatter.format(new Date(value));
export const mediaWatchTypeLabel = (type: string) => ({ fact: "Melding", opinion: "Mening", expectation: "Verwachting" }[type] ?? type);

export const renderMediaWatchTabs = (active: "archive" | "processing") => `<nav class="mw-tabs" aria-label="Media Watch-weergave">
  <a href="${basePath}"${active === "archive" ? ` class="is-active" aria-current="page"` : ""}>Archief</a>
  <a href="${basePath}?tab=processing"${active === "processing" ? ` class="is-active" aria-current="page"` : ""}>Verwerking</a>
</nav>`;

const sourceMeta = (moment: MediaWatchSourceMoment) => [
  moment.originalMedium,
  moment.discoveredVia ? `gevonden via ${moment.discoveredVia}` : null,
].filter(Boolean).map(value => esc(value)).join(" · ");

const renderStatement = (statement: MediaWatchStatement) => `<article class="mw-drawer-statement">
  <span class="mw-statement-type" data-type="${esc(statement.type)}">${esc(mediaWatchTypeLabel(statement.type))}</span>
  <p>${esc(statement.text)}</p>
</article>`;

const renderSourceTemplate = (moment: MediaWatchSourceMoment, index: number, prefix: string) => {
  const templateId = `mw-source-${prefix}-${index}`;
  const people = [...new Map(moment.people.map(person => [person.id, person])).values()];
  return `<template id="${templateId}">
    <header class="mw-drawer-header">
      <div><p>Datum</p><span>${esc(formatDate(moment.publishedAt))}</span></div>
      <button class="mw-drawer-close" type="button" data-source-close aria-label="Sluit bron">${close}</button>
    </header>
    <div class="mw-drawer-body">
      <section class="mw-source-section">
        <h2 id="mw-source-title">Wat Mike zei</h2>
        <div class="mw-drawer-statements">${moment.statements.map(renderStatement).join("")}</div>
      </section>
      ${people.length ? `<section class="mw-source-section"><h3>Personen</h3><p class="mw-drawer-people">${people.map(person => esc(person.name)).join(" · ")}</p></section>` : ""}
      <section class="mw-source-section">
        <h3>Bron</h3>
        <dl class="mw-source-details">
          <div><dt>Journalist</dt><dd>${esc(moment.journalistName)}</dd></div>
          ${moment.originalMedium ? `<div><dt>Oorspronkelijk medium</dt><dd>${esc(moment.originalMedium)}</dd></div>` : ""}
          ${moment.discoveredVia ? `<div><dt>Gevonden via</dt><dd>${esc(moment.discoveredVia)}</dd></div>` : ""}
          <div><dt>Publicatiedatum</dt><dd>${esc(formatDate(moment.publishedAt))}</dd></div>
        </dl>
      </section>
      <a class="mw-publication-link" href="${esc(moment.sourceUrl)}" target="_blank" rel="noreferrer"><span>Bekijk publicatie</span>${arrow}</a>
    </div>
  </template>`;
};

const renderDrawerLayer = () => `<div class="mw-source-layer" aria-hidden="true" data-source-layer>
  <button class="mw-drawer-backdrop" type="button" data-source-close tabindex="-1" aria-label="Sluit bron"></button>
  <aside class="mw-source-drawer" role="dialog" aria-modal="true" aria-labelledby="mw-source-title"><div data-source-content></div></aside>
</div>`;

const markerHeight = (id: string) => 30 + [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 38;

const renderLibraryMarker = (moment: MediaWatchSourceMoment, index: number, matches: boolean) => {
  const context = moment.people[0]?.name ?? moment.title;
  return `<button class="mw-library-marker${matches ? " is-match" : ""}" type="button" tabindex="${index === 0 ? "0" : "-1"}"
    data-library-marker data-marker-index="${index}" data-search="${esc(moment.searchText)}"
    data-date="${esc(formatShortDate(moment.publishedAt))}" data-context="${esc(context)}"
    data-source-template="mw-source-library-${index}" aria-label="${esc(`${formatDate(moment.publishedAt)} — ${context}`)}"
    style="--book-height:${markerHeight(moment.id)}px"><i aria-hidden="true"></i></button>`;
};

const renderLibraryYears = (library: MediaWatchLibrary) => {
  const normalizedSearch = library.search.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("nl-NL").trim();
  const groups = new Map<string, Array<{ moment: MediaWatchSourceMoment; index: number }>>();
  library.moments.forEach((moment, index) => {
    const year = yearFor(moment.publishedAt);
    const group = groups.get(year) ?? [];
    group.push({ moment, index });
    groups.set(year, group);
  });
  return [...groups].map(([year, entries]) => `<section class="mw-library-year" aria-labelledby="mw-library-year-${year}">
    <div class="mw-library-year-label"><h2 id="mw-library-year-${year}">${esc(year)}</h2><span>${entries.length} ${entries.length === 1 ? "bronmoment" : "bronmomenten"}</span></div>
    <div class="mw-library-shelf">${entries.map(({ moment, index }) => `${renderLibraryMarker(moment, index, !normalizedSearch || moment.searchText.includes(normalizedSearch))}${renderSourceTemplate(moment, index, "library")}`).join("")}</div>
  </section>`).join("");
};

const serializePeople = (library: MediaWatchLibrary) => JSON.stringify(library.people.map(person => ({
  name: person.name,
  slug: person.slug,
  aliases: person.aliases,
}))).replaceAll("<", "\\u003c");

export const renderMediaWatchLibrary = (library: MediaWatchLibrary) => {
  const firstYear = library.firstPublishedAt ? yearFor(library.firstPublishedAt) : "";
  const lastYear = library.lastPublishedAt ? yearFor(library.lastPublishedAt) : "";
  const period = firstYear === lastYear ? firstYear : `${firstYear}–${lastYear}`;
  const searchActive = Boolean(library.search.trim());
  const defaultSummary = `${library.statementCount} uitspraken · ${library.moments.length} bronmomenten${period ? ` · ${period}` : ""}`;
  const summary = searchActive
    ? library.matchingMomentCount
      ? `<strong>${esc(library.search)}</strong><span>${library.matchingMomentCount} ${library.matchingMomentCount === 1 ? "bronmoment" : "bronmomenten"}</span>`
      : `<strong>Geen uitspraken gevonden voor “${esc(library.search)}”</strong><span>De volledige geschiedenis blijft zichtbaar.</span>`
    : `<span>${esc(defaultSummary)}</span>`;
  const personHref = library.matchingPerson
    ? `${basePath}?entity=${encodeURIComponent(library.matchingPerson.slug)}&q=${encodeURIComponent(library.search)}`
    : "";
  return `<main class="motm-main mw-page mw-page--library">
    <div class="mw-shell">${renderMediaWatchTabs("archive")}
      <header class="mw-library-hero"><p class="mw-kicker">Media Watch</p><h1>Mike Verweij</h1><p>Een doorzoekbaar archief van zijn berichtgeving over Ajax.</p>
        <form class="mw-library-search" action="${basePath}" method="get" data-library-search-form>
          <label for="mw-library-search">Zoek in wat Mike heeft gezegd</label>
          <div><input id="mw-library-search" name="q" type="search" maxlength="160" autocomplete="off" value="${esc(library.search)}" placeholder="Zoek in wat Mike heeft gezegd…" data-library-search><button type="submit">Zoek</button></div>
        </form>
        <div class="mw-search-state" aria-live="polite"><div data-search-summary data-default-summary="${esc(defaultSummary)}">${summary}</div><a href="${esc(personHref || basePath)}"${personHref ? "" : " hidden"} data-person-timeline>Open tijdlijn van <span>${esc(library.matchingPerson?.name ?? "")}</span> ${arrow}</a>${searchActive ? `<button type="button" data-clear-search>Wis zoeken</button>` : `<button type="button" data-clear-search hidden>Wis zoeken</button>`}</div>
      </header>
    </div>
    <section class="mw-library" id="library" aria-label="Historische bronmomenten van Mike Verweij" data-library>
      <div class="mw-library-context" aria-live="polite" data-library-context><time></time><strong></strong></div>
      <div class="mw-library-years">${renderLibraryYears(library)}</div>
    </section>
    <script type="application/json" data-person-index>${serializePeople(library)}</script>
    ${renderDrawerLayer()}
  </main>`;
};

const renderTimelineMoment = (moment: MediaWatchSourceMoment, index: number) => `<article class="mw-moment" id="mw-moment-${index}" data-moment data-moment-index="${index}" data-year="${esc(yearFor(moment.publishedAt))}" data-date="${esc(formatDate(moment.publishedAt))}" style="--moment-gap:${moment.gapSpace}px">
  <div class="mw-moment-date"><time datetime="${esc(isoDate(moment.publishedAt))}">${esc(formatShortDate(moment.publishedAt))}</time><span aria-hidden="true"></span></div>
  <div class="mw-moment-body">
    <header class="mw-source-moment"><div><time datetime="${esc(isoDate(moment.publishedAt))}">${esc(formatDate(moment.publishedAt))}</time>${moment.statements.length > 1 ? `<span>${moment.statements.length} uitspraken</span>` : ""}</div><p>${sourceMeta(moment)}</p><span class="mw-source-title">${esc(moment.title)}</span></header>
    <div class="mw-statements">${moment.statements.map(statement => `<article class="mw-statement"><span class="mw-statement-type" data-type="${esc(statement.type)}">${esc(mediaWatchTypeLabel(statement.type))}</span><p>${esc(statement.text)}</p></article>`).join("")}</div>
    <button class="mw-source-trigger" type="button" data-source-template="mw-source-timeline-${index}" aria-haspopup="dialog">Bekijk bron ${arrow}</button>
    ${renderSourceTemplate(moment, index, "timeline")}
  </div>
</article>`;

const renderChronology = (timeline: MediaWatchPersonTimeline) => {
  let activeYear = "";
  return timeline.moments.map((moment, index) => {
    const year = yearFor(moment.publishedAt);
    const separator = year !== activeYear ? `<div class="mw-year-separator"><span></span><strong>${esc(year)}</strong><span></span></div>` : "";
    activeYear = year;
    return separator + renderTimelineMoment(moment, index);
  }).join("");
};

const renderProgress = (timeline: MediaWatchPersonTimeline) => `<aside class="mw-progress" aria-label="Voortgang door de tijdlijn"><div class="mw-progress-inner"><p>Nu in de tijdlijn</p><strong data-active-year>${esc(yearFor(timeline.moments[0].publishedAt))}</strong><span data-active-date>${esc(formatDate(timeline.moments[0].publishedAt))}</span><div class="mw-progress-markers">${timeline.moments.map((moment, index) => `<button type="button" data-progress-marker data-moment-index="${index}" data-distance="${Math.min(index, 3)}" aria-label="Ga naar ${esc(formatDate(moment.publishedAt))}"${index === 0 ? ` aria-current="true"` : ""}><i></i></button>`).join("")}</div><small><b data-active-position>01</b> / ${String(timeline.moments.length).padStart(2, "0")}</small></div></aside>`;

export const renderMediaWatchPersonTimeline = (timeline: MediaWatchPersonTimeline) => {
  const returnHref = `${basePath}${timeline.returnSearch ? `?q=${encodeURIComponent(timeline.returnSearch)}` : ""}#library`;
  return `<main class="motm-main mw-page mw-page--timeline">
    <div class="mw-shell">${renderMediaWatchTabs("archive")}
      <header class="mw-timeline-hero"><a class="mw-back" href="${esc(returnHref)}">← Terug naar archief</a><p class="mw-kicker">Mike Verweij over</p><h1>${esc(timeline.person.name)}</h1><p>${timeline.statementCount} ${timeline.statementCount === 1 ? "uitspraak" : "uitspraken"} in ${timeline.moments.length} ${timeline.moments.length === 1 ? "bronmoment" : "bronmomenten"}</p></header>
      <section class="mw-timeline" aria-label="Tijdlijn over ${esc(timeline.person.name)}"><div class="mw-timeline-layout"><div class="mw-chronology">${renderChronology(timeline)}</div>${renderProgress(timeline)}</div></section>
    </div>
    ${renderDrawerLayer()}
  </main>`;
};
