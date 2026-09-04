import { createHash } from "node:crypto";
import { isSameOrigin, redirect, type Session } from "../../lib/discord-auth";
import { runMediaWatchCrawl } from "../../lib/media-watch-crawl";
import { db } from "../../lib/motm-db";
import { esc, errorPage, formatMoment, page, pageHeader } from "../../lib/motm-view";
import {
  confirmMediaWatchImport,
  countUnprocessedMediaWatchRevisions,
  getMediaWatchExport,
  previewMediaWatchImport,
  type MediaWatchImportPreview,
  type MediaWatchImportResult,
} from "../../lib/media-watch-transfer";
import { permissions } from "../../lib/permissions.config";
import { MEDIA_WATCH_MAX_BODY_BYTES, MEDIA_WATCH_MAX_FORM_FIELDS, readFormDataWithLimits } from "../../lib/request-limits";
import { getSessionWithPermission } from "../../lib/server-permissions";
import { getMediaWatchPageData } from "../../lib/media-watch-timeline";
import { renderMediaWatchLibrary, renderMediaWatchPersonTimeline, renderMediaWatchTabs } from "./timeline";

const basePath = "/club/tools/media-watch";
const sourceKinds = new Set(["primary", "secondary"]);
const sourceFormats = new Set(["article", "x_post"]);
const paywallValues = new Set(["none", "full"]);

const query = (request: Request) => new URL(request.url).searchParams;
const staff = (request: Request) => getSessionWithPermission(request, permissions.mediaWatchManage);
const dateValue = (value: string | Date) => new Date(value).toISOString().slice(0, 10);
const labelFor = (value: string) => ({ article: "Artikel", x_post: "X-post", primary: "Primair", secondary: "Secundair", none: "Nee", full: "Ja", ready: "Onverwerkt", blocked: "Onvolledig", new: "Toeschrijving onbekend", processed: "Verwerkt", started: "Bezig", succeeded: "Geslaagd", partial: "Deels geslaagd", failed: "Mislukt", fact: "Feitelijke claim", opinion: "Mening", expectation: "Verwachting", low: "Lage stelligheid", medium: "Gemiddelde stelligheid", high: "Hoge stelligheid", action: "Actie", responsibility: "Verantwoordelijkheid", blame: "Schuld", credit: "Krediet" }[value] ?? value);
const clean = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

const hashFor = (url: string, sourceText: string | null) =>
  createHash("sha256").update(sourceText ? `content:${sourceText}` : `url:${url}`).digest("hex");

const validUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (key === "comment" || key.startsWith("utm_")) url.searchParams.delete(key);
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch {
    return null;
  }
};

const isXPostUrl = (value: string) => {
  const url = new URL(value);
  return ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname.toLowerCase()) && /\/status\/\d+/.test(url.pathname);
};

const renderSourceForm = (journalists: any[], source?: any) => {
  const current = source ?? { journalist_id: journalists.find(row => row.slug === "mike-verweij")?.id ?? "", source_kind: "primary", source_format: "article", paywall_status: "none" };
  const action = source ? "Bron bijwerken" : "Bron opslaan";
  return `<section class="management-section">
    <h2>${source ? "Bron bewerken" : "Bron toevoegen"}</h2>
    <form method="post">
      <input type="hidden" name="intent" value="${source ? "update" : "create"}">
      ${source ? `<input type="hidden" name="id" value="${esc(source.id)}">` : ""}
      <div class="form-grid">
        <label>Type bron<select required name="sourceFormat">${["article", "x_post"].map(value => `<option value="${value}"${current.source_format === value ? " selected" : ""}>${labelFor(value)}</option>`).join("")}</select></label>
        <label>Journalist<select name="journalistId"><option value="">Onbekend</option>${journalists.map(row => `<option value="${esc(row.id)}"${row.id === current.journalist_id ? " selected" : ""}>${esc(row.name)}</option>`).join("")}</select></label>
        <label>Publicatiedatum<input required type="date" name="publishedDate" value="${source ? esc(dateValue(source.published_at)) : ""}"></label>
        <label>Titel <em>optioneel bij X</em><input maxlength="500" name="title" value="${esc(source?.title ?? "")}"></label>
        <label>URL<input required type="url" name="url" value="${esc(source?.url ?? "")}" placeholder="https://…"></label>
        <label>X-account <em>alleen indien bekend</em><input maxlength="200" name="sourceAccount" value="${esc(source?.source_account ?? "")}" placeholder="Bijvoorbeeld @MikeVerweij"></label>
        <label>Oorspronkelijk medium <em>optioneel bij X</em><input maxlength="200" name="originalMedium" value="${esc(source?.original_medium ?? "")}" placeholder="Bijvoorbeeld De Telegraaf"></label>
        <label>Gevonden via <em>optioneel bij primaire bron</em><input maxlength="200" name="discoveredVia" value="${esc(source?.discovered_via ?? "")}" placeholder="Bijvoorbeeld VoetbalPrimeur of X"></label>
        <label>Bronsoort<select required name="sourceKind">${["primary", "secondary"].map(value => `<option value="${value}"${current.source_kind === value ? " selected" : ""}>${labelFor(value)}</option>`).join("")}</select></label>
        <label>Paywall<select required name="paywallStatus">${["none", "full"].map(value => `<option value="${value}"${current.paywall_status === value ? " selected" : ""}>${labelFor(value)}</option>`).join("")}</select></label>
      </div>
      <label>Beschikbare brontekst<textarea name="sourceText" rows="12" placeholder="Plak hier de beschikbare artikeltekst of de volledige tekst van de X-post.">${esc(source?.source_text ?? "")}</textarea></label>
      <p class="help">Een openbare bron en een X-post hebben brontekst nodig. Een paywall-artikel mag zonder volledige tekst worden opgeslagen en verschijnt dan als onvolledig.</p>
      <button class="button" type="submit">${action}</button>
    </form>
  </section>`;
};

const renderCrawl = (run?: any) => `<section class="management-section">
  <div class="section-heading"><div><p class="eyebrow">Automatische bronnen</p><h2>Bronnen ophalen</h2></div>${run ? `<span class="status">${esc(labelFor(run.status))}</span>` : ""}</div>
  <p>Controleert de actuele Ajax-feeds van VoetbalPrimeur en VoetbalNieuws en de openbare nieuwsoverzichten van Ajax Showtime.</p>
  <form method="post"><input type="hidden" name="intent" value="crawl"><button class="button" type="submit">Nu crawlen</button></form>
  <p class="help">Nieuwe bevestigde bronnen blijven onverwerkt staan totdat een latere import succesvol is afgerond.</p>
  ${run ? `<p class="help">Laatste crawl: ${esc(formatMoment(run.started_at))} · gevonden ${Number(run.found_count)} · nieuw relevant ${Number(run.new_count)} · duplicaten overgeslagen ${Number(run.skipped_count)} · gewijzigd ${Number(run.changed_count)} · fouten ${Number(run.error_count)}</p>${run.error_message ? `<details><summary>Foutdetails</summary><pre>${esc(run.error_message)}</pre></details>` : ""}` : `<p class="help">Nog geen crawl uitgevoerd.</p>`}
</section>`;

type ImportState = { preview: MediaWatchImportPreview; rawJson: string };

const renderProcessing = (waitingCount: number, state?: ImportState, result?: MediaWatchImportResult) => `<section class="management-section">
  <div class="section-heading"><div><p class="eyebrow">Media Watch verwerking</p><h2>${waitingCount} ${waitingCount === 1 ? "bronrevisie wacht" : "bronrevisies wachten"} op verwerking</h2></div></div>
  <p>Exporteer de volledige onverwerkte Mike Verweij-wachtrij als JSON. Exporteren wijzigt geen status.</p>
  <form method="post"><input type="hidden" name="intent" value="export"><button class="button" type="submit">Exporteer onverwerkte bronnen</button></form>
  <hr>
  <form method="post" enctype="multipart/form-data">
    <input type="hidden" name="intent" value="preview-import">
    <label>Verwerkte JSON<input required type="file" name="importFile" accept="application/json,.json"></label>
    <button class="button" type="submit">Importeer verwerkte JSON</button>
  </form>
  ${result ? `<p class="status status-open">Import geslaagd: ${result.importedSources} verwerkt (${result.acceptedSources} accepted, ${result.rejectedSources} rejected), ${result.claimCount} claims, ${result.createdEntities} nieuwe entities. ${result.skippedSources} reeds verwerkt overgeslagen.</p>` : ""}
  ${state ? `<div class="management-card"><h3>Importpreview</h3>
    <p>${state.preview.totalSources} bronnen in bestand · ${state.preview.acceptedSources} accepted · ${state.preview.rejectedSources} rejected · ${state.preview.claimCount} claims · ${state.preview.existingEntitiesUsed} bestaande entities gebruikt · ${state.preview.newEntityNames.length} nieuwe entities · ${state.preview.skippedSources} reeds verwerkt overgeslagen · ${state.preview.errors.length} validatiefouten</p>
    ${state.preview.errors.length ? `<ul>${state.preview.errors.map(error => `<li>${esc(error)}</li>`).join("")}</ul><p class="status status-error">Niet geïmporteerd. Herstel het volledige bestand en valideer opnieuw.</p>` : `<form method="post"><input type="hidden" name="intent" value="confirm-import"><textarea hidden name="importJson">${esc(state.rawJson)}</textarea><button class="button" type="submit">Import bevestigen</button></form>`}
  </div>` : ""}
  <p class="help">Alleen bevestigde Mike Verweij-revisions worden geëxporteerd. De import gebruikt geen AI en schrijft pas na een volledig geldige preview.</p>
</section>`;


const renderRevisions = (source: any, revisions: any[]) => `<section class="management-section">
  <div class="section-heading"><div><p class="eyebrow">Bronhistorie</p><h2>Later gevonden versies</h2></div><span class="status">${revisions.length}</span></div>
  <p class="help">De oorspronkelijke versie is opgeslagen op ${esc(formatMoment(source.created_at))} en blijft het vaste bronbewijs. Latere online wijzigingen staan hieronder afzonderlijk.</p>
  ${revisions.length ? revisions.map(revision => `<details><summary>${esc(formatMoment(revision.observed_at))} · ${esc(revision.title)}</summary><p class="help">Publicatiedatum ${esc(formatMoment(revision.published_at))} · inhoudshash ${esc(revision.deduplication_hash)}</p><pre>${esc(revision.source_text)}</pre></details>`).join("") : `<p class="group-empty">Voor deze URL zijn nog geen inhoudelijke wijzigingen gevonden.</p>`}
</section>`;

const renderClaims = (claims: any[]) => `<section class="management-section">
  <div class="section-heading"><div><p class="eyebrow">Controle</p><h2>Gevonden claims</h2></div><span class="status">${claims.length}</span></div>
  <p class="help">Elke claim staat direct naast de letterlijke bewijsquote uit de opgeslagen brontekst.</p>
  ${claims.length ? claims.map(claim => {
    const parties = Array.isArray(claim.attributed_parties) ? claim.attributed_parties : [];
    const attribution = claim.attribution && typeof claim.attribution === "object" ? claim.attribution : null;
    const attributionParts = attribution ? [attribution.kind ? labelFor(String(attribution.kind)) : null, attribution.actor, attribution.action, attribution.target].filter(Boolean) : [];
    return `<article class="management-card"><strong>${esc(labelFor(claim.claim_type))}</strong><p>${esc(claim.structured_text)}</p><blockquote><strong>Letterlijk bewijs</strong><p>${esc(claim.evidence_quote)}</p></blockquote>${claim.subject ? `<p class="help">Onderwerp: ${esc(claim.subject)}</p>` : ""}${parties.length ? `<p class="help">Genoemde personen/partijen: ${parties.map((party: unknown) => esc(String(party))).join(", ")}</p>` : ""}${attributionParts.length ? `<p class="help">Toeschrijving: ${attributionParts.map(part => esc(String(part))).join(" · ")}</p>` : ""}</article>`;
  }).join("") : `<p class="group-empty">Voor deze bron zijn nog geen claims opgeslagen.</p>`}
</section>`;
const renderSourceList = (sources: any[]) => sources.length ? `<div class="manage-list">${sources.map(source => `<a href="${basePath}?id=${encodeURIComponent(source.id)}"><span class="status">${esc(dateValue(source.published_at))}</span><span><strong>${esc(source.title)}</strong><small>${esc(labelFor(source.source_format))}${source.source_account ? ` · ${esc(source.source_account)}` : ""} · ${esc(source.original_medium ?? "Oorspronkelijke bron onbekend")}${source.discovered_via ? ` · gevonden via ${esc(source.discovered_via)}` : ""} · ${esc(labelFor(source.source_kind))} · ${esc(labelFor(source.processing_status))}</small></span><b>Open →</b></a>`).join("")}</div>` : `<p class="group-empty">Geen bronnen.</p>`;

const renderInbox = (sources: any[]) => {
  const mikeSources = sources.filter(source => source.journalist_slug === "mike-verweij");
  const telegraafCandidates = sources.filter(source => !source.journalist_slug && String(source.original_medium ?? "").toLowerCase() === "de telegraaf");
  return `<section class="management-section">
    <div class="section-heading"><div><p class="eyebrow">Inbox</p><h2>Opgeslagen bronnen</h2></div><span class="status">${sources.length}</span></div>
    <h3>Mike Verweij bevestigd</h3>
    <p class="help">Alleen deze bronnen zijn aantoonbaar aan Mike Verweij toegeschreven. Onverwerkte bronnen blijven zonder vervaldatum beschikbaar.</p>
    ${renderSourceList(mikeSources)}
    <h3>De Telegraaf, journalist onbekend</h3>
    <p class="help">Kandidaten met aantoonbare De Telegraaf-herkomst, zonder betrouwbare journalistkoppeling. Ze blijven fail-closed buiten verwerking.</p>
    ${renderSourceList(telegraafCandidates)}
  </section>`;
};
const processingOverview = async (request: Request, session: Session, importState?: ImportState) => {
  const [journalists, sources, runs, waitingCount] = await Promise.all([
    db()`SELECT id,slug,name FROM media_watch_journalists WHERE active=true ORDER BY name`,
    db()`SELECT s.id,s.title,s.published_at,s.original_medium,s.discovered_via,s.source_kind,s.source_format,s.source_account,s.paywall_status,s.processing_status,j.slug AS journalist_slug FROM media_watch_source_items s LEFT JOIN media_watch_journalists j ON j.id=s.journalist_id WHERE (j.slug='mike-verweij' AND s.processing_status IN ('ready','processed')) OR (j.id IS NULL AND lower(s.original_medium)='de telegraaf' AND s.processing_status='new') ORDER BY s.published_at DESC,s.created_at DESC LIMIT 100`,
    db()`SELECT id,status,found_count,new_count,skipped_count,changed_count,error_count,error_message,started_at,finished_at FROM media_watch_crawl_runs ORDER BY started_at DESC LIMIT 1`,
    countUnprocessedMediaWatchRevisions(),
  ]);
  const [run] = runs;
  const saved = query(request).get("saved") === "1";
  const importedValue = query(request).get("imported");
  const imported = importedValue === null ? Number.NaN : Number(importedValue);
  const result = Number.isInteger(imported) && imported >= 0 ? {
    importedSources: imported,
    skippedSources: Number(query(request).get("skipped") ?? 0),
    acceptedSources: Number(query(request).get("accepted") ?? 0),
    rejectedSources: Number(query(request).get("rejected") ?? 0),
    claimCount: Number(query(request).get("claims") ?? 0),
    createdEntities: Number(query(request).get("entities") ?? 0),
  } : undefined;
  return page("Media Watch · Verwerking", `<main class="motm-main admin mw-page mw-processing">${renderMediaWatchTabs("processing")}${pageHeader("Verwerking", "Media Watch", "/club/tools", "Tools")}${saved ? `<p class="status status-open">Bron opgeslagen</p>` : ""}<p class="page-intro">Verzamel openbare broninformatie en bewaar betrouwbare Mike Verweij-context. Claims worden niet automatisch aangemaakt.</p>${renderProcessing(waitingCount, importState, result)}${renderCrawl(run)}${renderSourceForm(journalists as any[])}${renderInbox(sources as any[])}</main>`, "", session, "tools", undefined, { stylesheets: ["/media-watch.css?v=3"] });
};

const archiveOverview = async (request: Request, session: Session) => {
  const parameters = query(request);
  const data = await getMediaWatchPageData({
    search: parameters.get("q") ?? "",
    entity: parameters.get("entity") ?? "",
  });
  const html = data.timeline ? renderMediaWatchPersonTimeline(data.timeline) : renderMediaWatchLibrary(data.library);
  return page(data.timeline ? `${data.timeline.person.name} · Media Watch` : "Media Watch", html, "", session, "tools", undefined, {
    stylesheets: ["/media-watch.css?v=3"],
    moduleScripts: ["/media-watch.mjs?v=3"],
  });
};

const detail = async (request: Request, session: Session, id: string) => {
  const journalists = await db()`SELECT id,slug,name FROM media_watch_journalists WHERE active=true ORDER BY name`;
  const [source] = await db()`SELECT * FROM media_watch_source_items WHERE id=${id}`;
  if (!source) return errorPage("Niet gevonden", "Deze bron bestaat niet.", 404, session, basePath, "tools");
  const revisions = await db()`SELECT id,title,published_at,source_text,deduplication_hash,observed_at FROM media_watch_source_item_revisions WHERE source_item_id=${id} ORDER BY observed_at DESC`;
  const claims = await db()`SELECT claim_type,structured_text,evidence_quote,subject,certainty,attributed_parties,attribution,created_at FROM media_watch_claims WHERE source_item_id=${id} ORDER BY created_at ASC`;
  return page("Bron bewerken", `<main class="motm-main admin mw-page mw-processing">${renderMediaWatchTabs("processing")}${pageHeader("Bron bewerken", "Media Watch", `${basePath}?tab=processing`, "Inbox")}<p class="page-intro">Toegevoegd ${esc(formatMoment(source.created_at))}. Bewerk alleen wat je in de bron kunt onderbouwen.</p>${renderSourceForm(journalists as any[], source)}${renderClaims(claims as any[])}${renderRevisions(source, revisions as any[])}</main>`, "", session, "tools", undefined, { stylesheets: ["/media-watch.css?v=3"] });
};

export const renderMediaWatch = async (request: Request, session: Session) => {
  try {
    const id = query(request).get("id");
    if (id) return detail(request, session, id);
    return query(request).get("tab") === "processing"
      ? processingOverview(request, session)
      : archiveOverview(request, session);
  } catch (error) {
    console.error("Media Watch failed", error);
    return errorPage("Database niet beschikbaar", "Controleer of Media Watch-migraties 020 tot en met 026 op deze omgeving zijn uitgevoerd.", 503, session, "/club/tools", "tools");
  }
};

export async function GET(request: Request) {
  const session = await staff(request);
  if (!session) return redirect(`/api/auth/discord-login?returnTo=${basePath}`);
  return renderMediaWatch(request, session);
}

const sourceData = async (form: FormData) => {
  const journalistId = clean(form, "journalistId") || null;
  const sourceFormat = clean(form, "sourceFormat");
  const suppliedSourceAccount = clean(form, "sourceAccount");
  const sourceText = clean(form, "sourceText") || null;
  const suppliedTitle = clean(form, "title");
  const title = suppliedTitle || (sourceFormat === "x_post" && sourceText ? sourceText.slice(0, 120) : "");
  const url = validUrl(clean(form, "url"));
  const accountFromUrl = sourceFormat === "x_post" && url ? new URL(url).pathname.split("/").filter(Boolean)[0] : null;
  const sourceAccount = suppliedSourceAccount || (accountFromUrl && accountFromUrl !== "i" ? "@" + accountFromUrl.replace(/^@/, "") : null);
  const publishedDate = clean(form, "publishedDate");
  const originalMedium = clean(form, "originalMedium") || null;
  const discoveredVia = clean(form, "discoveredVia") || (sourceFormat === "x_post" ? "X" : null);
  const sourceKind = clean(form, "sourceKind");
  const paywallStatus = clean(form, "paywallStatus");
  const publishedAt = /^\d{4}-\d{2}-\d{2}$/.test(publishedDate) ? new Date(`${publishedDate}T12:00:00.000Z`) : null;
  if (!sourceFormats.has(sourceFormat) || !title || title.length > 500 || !url || !publishedAt || Number.isNaN(publishedAt.getTime()) || publishedAt.toISOString().slice(0, 10) !== publishedDate || (originalMedium?.length ?? 0) > 200 || (sourceAccount?.length ?? 0) > 200 || !sourceKinds.has(sourceKind) || !paywallValues.has(paywallStatus)) return null;
  if (sourceFormat === "article" && !originalMedium) return null;
  if (sourceFormat === "x_post" && (!isXPostUrl(url) || !sourceText)) return null;
  if (sourceKind === "secondary" && (!discoveredVia || (originalMedium && discoveredVia.toLowerCase() === originalMedium.toLowerCase()))) return null;
  if (sourceFormat === "article" && paywallStatus === "none" && !sourceText) return null;
  const processingStatus = !sourceText ? "blocked" : journalistId ? "ready" : "new";
  return { journalistId, title, url, publishedAt, originalMedium, discoveredVia, sourceKind, sourceFormat, sourceAccount, paywallStatus, sourceText, processingStatus, deduplicationHash: hashFor(url, sourceText) };
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorPage("Ongeldige aanvraag", "Ververs de pagina.", 403);
  const session = await staff(request);
  if (!session) return redirect(`/api/auth/discord-login?returnTo=${basePath}`);
  const form = await readFormDataWithLimits(request, { maxBytes: MEDIA_WATCH_MAX_BODY_BYTES, maxFields: MEDIA_WATCH_MAX_FORM_FIELDS });
  if (form instanceof Response) return form;
  const intent = clean(form, "intent");
  if (intent === "export") {
    try {
      const exported = await getMediaWatchExport();
      const date = new Date().toISOString().slice(0, 10);
      return new Response(JSON.stringify(exported, null, 2), {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="media-watch-unprocessed-${date}.json"`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      });
    } catch (error) {
      console.error("Media Watch export failed", error);
      return errorPage("Export mislukt", "De onverwerkte revisions konden niet betrouwbaar worden geëxporteerd.", 503, session, basePath, "tools");
    }
  }
  if (intent === "preview-import") {
    const file = form.get("importFile");
    if (!file || typeof file === "string" || !file.size) {
      return errorPage("Geen JSON-bestand", "Selecteer een niet-leeg JSON-bestand.", 400, session, basePath, "tools");
    }
    const rawJson = await file.text();
    try {
      const preview = await previewMediaWatchImport(rawJson);
      return processingOverview(request, session, { preview, rawJson });
    } catch (error) {
      console.error("Media Watch import preview failed", error);
      return errorPage("Preview mislukt", "Het bestand kon niet tegen de opgeslagen revisions worden gevalideerd.", 503, session, basePath, "tools");
    }
  }
  if (intent === "confirm-import") {
    const rawJson = clean(form, "importJson");
    if (!rawJson) return errorPage("Import ontbreekt", "Valideer eerst een JSON-bestand.", 400, session, basePath, "tools");
    try {
      const result = await confirmMediaWatchImport(rawJson);
      if ("valid" in result) return processingOverview(request, session, { preview: result, rawJson });
      const parameters = new URLSearchParams({
        tab: "processing",
        imported: String(result.importedSources),
        skipped: String(result.skippedSources),
        accepted: String(result.acceptedSources),
        rejected: String(result.rejectedSources),
        claims: String(result.claimCount),
        entities: String(result.createdEntities),
      });
      return redirect(`${basePath}?${parameters}`);
    } catch (error) {
      console.error("Media Watch import failed", error);
      return errorPage("Import mislukt", "De transactie is teruggedraaid; geen revision uit dit bestand is half geïmporteerd.", 503, session, basePath, "tools");
    }
  }
  if (intent === "crawl") {
    try {
      const result = await runMediaWatchCrawl();
      return redirect(`${basePath}?tab=processing&run=${encodeURIComponent(result.runId)}`);
    } catch (error) {
      console.error("Media Watch crawl failed", error);
      return errorPage("Crawl mislukt", "De crawl kon niet worden gestart of vastgelegd. Controleer de database en probeer opnieuw.", 503, session, basePath, "tools");
    }
  }
  const data = await sourceData(form);
  if (!data || !["create", "update"].includes(intent)) return errorPage("Controleer de bron", "Vul alle verplichte velden in. Een secundaire bron heeft een vindplaats nodig; een openbare bron of X-post heeft tekst nodig.", 400, session, basePath, "tools");
  try {
    if (data.journalistId) {
      const [journalist] = await db()`SELECT id FROM media_watch_journalists WHERE id=${data.journalistId} AND active=true`;
      if (!journalist) return errorPage("Ongeldige journalist", "Kies een actieve journalist of laat de journalist onbekend.", 400, session, basePath, "tools");
    }
    if (intent === "create") {
      const [duplicate] = await db()`SELECT id FROM media_watch_source_items WHERE url=${data.url} OR deduplication_hash=${data.deduplicationHash} LIMIT 1`;
      if (duplicate) return redirect(`${basePath}?id=${duplicate.id}`);
      const created = await db().begin(async transaction => {
        const [source] = await transaction`INSERT INTO media_watch_source_items(journalist_id,title,url,published_at,original_medium,discovered_via,source_kind,source_format,source_account,source_text,paywall_status,processing_status,deduplication_hash) VALUES(${data.journalistId},${data.title},${data.url},${data.publishedAt},${data.originalMedium},${data.discoveredVia},${data.sourceKind},${data.sourceFormat},${data.sourceAccount},${data.sourceText},${data.paywallStatus},${data.processingStatus},${data.deduplicationHash}) RETURNING id`;
        if (data.sourceText) await transaction`INSERT INTO media_watch_source_item_revisions(source_item_id,crawl_run_id,title,published_at,source_text,deduplication_hash) VALUES(${source.id},NULL,${data.title},${data.publishedAt},${data.sourceText},${data.deduplicationHash})`;
        return source;
      });
      return redirect(`${basePath}?id=${created.id}`);
    }
    const id = clean(form, "id");
    if (!id) return errorPage("Niet gevonden", "Deze bron bestaat niet.", 404, session, basePath, "tools");
    const [duplicate] = await db()`SELECT id FROM media_watch_source_items WHERE id<>${id} AND (url=${data.url} OR deduplication_hash=${data.deduplicationHash}) LIMIT 1`;
    if (duplicate) return errorPage("Dubbele bron", "Deze URL of brontekst staat al in Media Watch.", 409, session, `${basePath}?id=${id}`, "tools");
    const updated = await db().begin(async transaction => {
      const [existing] = await transaction`SELECT id,title,published_at,source_text,deduplication_hash FROM media_watch_source_items WHERE id=${id} FOR UPDATE`;
      if (!existing) return null;
      if (typeof existing.source_text === "string" && existing.source_text.trim()) {
        await transaction`INSERT INTO media_watch_source_item_revisions(source_item_id,crawl_run_id,title,published_at,source_text,deduplication_hash) VALUES(${id},NULL,${existing.title},${existing.published_at},${existing.source_text},${existing.deduplication_hash}) ON CONFLICT (source_item_id,deduplication_hash) DO NOTHING`;
      }
      const [source] = await transaction`UPDATE media_watch_source_items SET journalist_id=${data.journalistId},title=${data.title},url=${data.url},published_at=${data.publishedAt},original_medium=${data.originalMedium},discovered_via=${data.discoveredVia},source_kind=${data.sourceKind},source_format=${data.sourceFormat},source_account=${data.sourceAccount},source_text=${data.sourceText},paywall_status=${data.paywallStatus},processing_status=CASE WHEN ${data.processingStatus}='ready' AND EXISTS(SELECT 1 FROM media_watch_source_item_revisions r JOIN media_watch_processed_revisions p ON p.revision_id=r.id WHERE r.source_item_id=${id} AND r.deduplication_hash=${data.deduplicationHash}) THEN 'processed' ELSE ${data.processingStatus} END,deduplication_hash=${data.deduplicationHash},updated_at=now() WHERE id=${id} RETURNING id`;
      if (data.sourceText) await transaction`INSERT INTO media_watch_source_item_revisions(source_item_id,crawl_run_id,title,published_at,source_text,deduplication_hash) VALUES(${id},NULL,${data.title},${data.publishedAt},${data.sourceText},${data.deduplicationHash}) ON CONFLICT (source_item_id,deduplication_hash) DO NOTHING`;
      return source;
    });
    if (!updated) return errorPage("Niet gevonden", "Deze bron bestaat niet.", 404, session, basePath, "tools");
    return redirect(`${basePath}?id=${updated.id}`);
  } catch (error) {
    console.error("Media Watch save failed", error);
    return errorPage("Opslaan mislukt", "Controleer de invoer en of Media Watch-migraties 020 tot en met 026 zijn uitgevoerd.", 503, session, basePath, "tools");
  }
}
