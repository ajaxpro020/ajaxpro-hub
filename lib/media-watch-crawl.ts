import { createHash } from "node:crypto";
import { db } from "./motm-db";
import { originalMediumForSecondaryJournalistAttribution } from "./media-watch-source-context";

const MAX_ARTICLES_PER_SOURCE = 15;
const ARCHIVE_PAGE_SIZE = 100;
const NEWSIFIER_PAGE_SIZE = 50;
const MAX_ARCHIVE_PAGES = 80;
const FETCH_TIMEOUT_MS = 12_000;
const AJAX_SHOWTIME_ARTICLE_DELAY_MS = 350;
const AJAX_SHOWTIME_MAX_429_RETRIES = 3;
const USER_AGENT = "AjaxPro-Media-Watch/1.0 (+https://ajaxpro.nl)";

type Candidate = { title: string; url: string; publishedAt: Date | null; discoveryText?: string };
type PublicationWindow = { from: Date; to: Date };
type CrawlSource = {
  name: string;
  discoverLatest: () => Promise<Candidate[]>;
  discoverBackfill: (window: PublicationWindow) => Promise<Candidate[]>;
};
type Article = Candidate & { sourceText: string };

export type MediaWatchCrawlOptions = {
  mode?: "latest" | "backfill";
  triggerKind?: "manual" | "scheduled";
  publishedFrom?: Date;
  publishedTo?: Date;
  dryRun?: boolean;
};

export type CrawlResult = {
  runId: string;
  status: "succeeded" | "partial" | "failed";
  foundCount: number;
  newCount: number;
  skippedCount: number;
  changedCount: number;
  errorCount: number;
};

export type SourceOnlyExample = {
  date: string;
  title: string;
  source: string;
  url: string;
  reason: string;
};

export type SourceOnlySourceResult = {
  source: string;
  candidateCount: number;
  confirmedMike: number;
  unknown: number;
  otherJournalist: number;
  unreadable: number;
  oldestDate: string | null;
  newestDate: string | null;
  pagination: "complete" | "failed";
  paginationNote: string;
  examples: SourceOnlyExample[];
};

export type SourceOnlyResult = {
  mode: "source-only";
  from: string;
  to: string;
  status: "succeeded" | "partial" | "failed";
  sources: SourceOnlySourceResult[];
  totals: Omit<SourceOnlySourceResult, "source" | "oldestDate" | "newestDate" | "pagination" | "paginationNote" | "examples">;
  errors: string[];
};

const decodeEntities = (value: string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&apos;|&#39;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">");

const textFromHtml = (value: string) => decodeEntities(value)
  .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
  .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/\r/g, "")
  .replace(/[ \t]+/g, " ")
  .replace(/ *\n */g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const asDate = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeUrl = (value: string, base?: string) => {
  try {
    const url = new URL(decodeEntities(value.trim()), base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key === "comment" || key.startsWith("utm_")) url.searchParams.delete(key);
    }
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch {
    return null;
  }
};

const xmlValue = (block: string, tag: string) => {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? textFromHtml(match[1]) : "";
};

export const parseRss = (xml: string) => [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].flatMap(match => {
  const block = match[0];
  const title = xmlValue(block, "title");
  const url = normalizeUrl(xmlValue(block, "link") || xmlValue(block, "guid"));
  if (!title || !url) return [];
  return [{ title, url, publishedAt: asDate(xmlValue(block, "pubDate") || xmlValue(block, "dc:date")) }];
});

export const parseAjaxShowtimeOverview = (html: string, baseUrl: string) => {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = normalizeUrl(match[1] || match[2], baseUrl);
    if (!url) continue;
    const parsed = new URL(url);
    if (parsed.hostname !== "www.ajaxshowtime.com") continue;
    if (!/^\/(?:hoofdnieuws|bijzaken-en-geruchten|opinie)\/[^/]+$/.test(parsed.pathname)) continue;
    if (seen.has(url)) continue;
    const title = textFromHtml(match[3]);
    if (!title || /^meer (?:artikelen|laden)$/i.test(title)) continue;
    seen.add(url);
    candidates.push({ title, url, publishedAt: null });
  }
  return candidates;
};

const responseText = async (response: Response) => {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.text();
  if (!body.trim()) throw new Error("lege response");
  if (body.length > 6_000_000) throw new Error("response groter dan 6 MB");
  return body;
};

const fetchText = async (url: string, accept: string) => {
  const response = await fetch(url, {
    headers: { Accept: accept, "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return responseText(response);
};

const wait = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

const retryAfterMilliseconds = (response: Response, attempt: number) => {
  const retryAfter = response.headers.get("retry-after")?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const timestamp = Date.parse(retryAfter);
    if (Number.isFinite(timestamp)) return Math.max(0, timestamp - Date.now());
  }
  return 1_000 * (2 ** attempt);
};

const fetchAjaxShowtimeArticleText = async (url: string) => {
  await wait(AJAX_SHOWTIME_ARTICLE_DELAY_MS);
  for (let attempt = 0; attempt <= AJAX_SHOWTIME_MAX_429_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status !== 429) return responseText(response);
    if (attempt === AJAX_SHOWTIME_MAX_429_RETRIES) throw new Error("HTTP 429 na maximaal aantal retries");
    await wait(retryAfterMilliseconds(response, attempt));
  }
  throw new Error("HTTP 429 na maximaal aantal retries");
};

const fetchArticleText = (sourceName: string, url: string) => sourceName === "Ajax Showtime"
  ? fetchAjaxShowtimeArticleText(url)
  : fetchText(url, "text/html");

const fetchJson = async (url: string) => JSON.parse(await fetchText(url, "application/json")) as unknown;

const inPublicationWindow = (date: Date | null, window: PublicationWindow) => Boolean(
  date && date >= window.from && date <= window.to,
);

const hasMikeDiscoverySignal = (candidate: Candidate) => /\b(?:Mike\s+Verweij|Verweij|De\s+Telegraaf)\b/i
  .test(`${candidate.title}\n${candidate.discoveryText ?? ""}`);

export const parsePXRArchiveResponse = (payload: unknown) => {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { data?: unknown }).data)) return [];
  return (payload as { data: unknown[] }).data.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const title = typeof row.newsTitle === "string" ? row.newsTitle.trim() : "";
    const host = typeof row.host === "string" ? row.host : "";
    const path = typeof row.path === "string" ? row.path : "";
    const url = normalizeUrl(`${host}${path}`);
    const publishedAt = asDate(row.newsPublishDate ?? row.newsDate);
    if (!title || !url || !publishedAt) return [];
    const discoveryText = [row.newsSubTitle, row.metaTitle, row.metaDescription]
      .filter(value => typeof value === "string").join("\n");
    return [{ title, url, publishedAt, discoveryText }];
  });
};

export const parseAjaxShowtimeArchiveResponse = (payload: unknown) => {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { data?: unknown }).data)) return [];
  return (payload as { data: unknown[] }).data.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const url = typeof row.url === "string" ? normalizeUrl(row.url) : null;
    const publishedAt = asDate(row.published_at);
    if (!title || !url || !publishedAt) return [];
    const discoveryText = [row.excerpt, row.source]
      .filter(value => typeof value === "string").join("\n");
    return [{ title, url, publishedAt, discoveryText }];
  });
};

const discoverPXRArchive = async (configuration: {
  apiHost: string;
  contextId: number;
  tagId: number;
}, window: PublicationWindow) => {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_ARCHIVE_PAGES; page += 1) {
    const parameters = new URLSearchParams({
      checkNextPage: "true",
      experimentGroup: "b",
      newsStatus: "published",
      page: String(page),
      perPage: String(ARCHIVE_PAGE_SIZE),
      scope: "public",
      tagID: String(configuration.tagId),
    });
    const rawPageCandidates = parsePXRArchiveResponse(await fetchJson(
      `${configuration.apiHost}/domain/${configuration.contextId}/news?${parameters}`,
    ));
    const pageCandidates = rawPageCandidates.filter(candidate => !seen.has(candidate.url) && Boolean(seen.add(candidate.url)));
    if (rawPageCandidates.length && !pageCandidates.length) throw new Error("PXR-archiefpaginering herhaalde een pagina");
    if (!pageCandidates.length) break;
    candidates.push(...pageCandidates.filter(candidate => inPublicationWindow(candidate.publishedAt, window) && hasMikeDiscoverySignal(candidate)));
    const newest = Math.max(...pageCandidates.map(candidate => candidate.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY));
    if (newest < window.from.getTime() || pageCandidates.length < ARCHIVE_PAGE_SIZE) break;
    if (page === MAX_ARCHIVE_PAGES) throw new Error("PXR-archief bereikte de veiligheidslimiet vóór de begindatum");
  }
  return candidates;
};

const discoverAjaxShowtimeArchive = async (window: PublicationWindow) => {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < MAX_ARCHIVE_PAGES; page += 1) {
    const parameters = new URLSearchParams({
      is_sticky: "1",
      offset: String(page * NEWSIFIER_PAGE_SIZE),
      page_size: String(NEWSIFIER_PAGE_SIZE),
      display_page: "tags",
      tenant_id: "ajaxshowtime.com",
    });
    const rawPageCandidates = parseAjaxShowtimeArchiveResponse(await fetchJson(
      `https://cloud1-service.newsifier.nl/api/v2/article/scopes/by-tag/hoofdnieuws,%20bijzaken-en-geruchten/0?${parameters}`,
    ));
    const pageCandidates = rawPageCandidates.filter(candidate => !seen.has(candidate.url) && Boolean(seen.add(candidate.url)));
    if (rawPageCandidates.length && !pageCandidates.length) throw new Error("Ajax Showtime-archiefpaginering herhaalde een pagina");
    if (!pageCandidates.length) break;
    candidates.push(...pageCandidates.filter(candidate => inPublicationWindow(candidate.publishedAt, window) && hasMikeDiscoverySignal(candidate)));
    const newest = Math.max(...pageCandidates.map(candidate => candidate.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY));
    if (newest < window.from.getTime() || pageCandidates.length < NEWSIFIER_PAGE_SIZE) break;
    if (page === MAX_ARCHIVE_PAGES - 1) throw new Error("Ajax Showtime-archief bereikte de veiligheidslimiet vóór de begindatum");
  }
  return candidates;
};

const rssSource = (name: string, url: string, archive: { apiHost: string; contextId: number; tagId: number }): CrawlSource => ({
  name,
  discoverLatest: async () => parseRss(await fetchText(url, "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8"))
    .slice(0, MAX_ARTICLES_PER_SOURCE),
  discoverBackfill: window => discoverPXRArchive(archive, window),
});

const ajaxShowtimeSource: CrawlSource = {
  name: "Ajax Showtime",
  discoverLatest: async () => {
    const overviewUrls = [
      "https://www.ajaxshowtime.com/hoofdnieuws",
      "https://www.ajaxshowtime.com/bijzaken-en-geruchten",
    ];
    const pages = await Promise.all(overviewUrls.map(url => fetchText(url, "text/html")));
    const seen = new Set<string>();
    return pages.flatMap((html, index) => parseAjaxShowtimeOverview(html, overviewUrls[index]))
      .filter(candidate => !seen.has(candidate.url) && Boolean(seen.add(candidate.url)))
      .slice(0, MAX_ARTICLES_PER_SOURCE);
  },
  discoverBackfill: discoverAjaxShowtimeArchive,
};

const crawlSources: CrawlSource[] = [
  rssSource("VoetbalPrimeur", "https://www.voetbalprimeur.nl/rss/index.xml?tag=ajax", { apiHost: "https://api.voetbalprimeur.nl", contextId: 1, tagId: 21568 }),
  rssSource("VoetbalNieuws", "https://www.voetbalnieuws.nl/feed/news.xml?tag=ajax", { apiHost: "https://api.voetbalnieuws.nl", contextId: 400, tagId: 21568 }),
  ajaxShowtimeSource,
];

const jsonLdObjects = (html: string) => {
  const values: unknown[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { values.push(JSON.parse(decodeEntities(match[1]).trim())); } catch { /* use HTML fallback */ }
  }
  return values;
};

const findString = (value: unknown, keys: Set<string>): string | null => {
  if (Array.isArray(value)) {
    for (const entry of value) { const found = findString(entry, keys); if (found) return found; }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, entry] of Object.entries(value)) {
    if (keys.has(key) && typeof entry === "string" && entry.trim()) return entry.trim();
  }
  for (const entry of Object.values(value)) { const found = findString(entry, keys); if (found) return found; }
  return null;
};

const metaContent = (html: string, names: string[]) => {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
    ];
    for (const pattern of patterns) { const match = html.match(pattern); if (match) return decodeEntities(match[1]).trim(); }
  }
  return null;
};

export const parseArticle = (html: string, candidate: Candidate): Article | null => {
  const objects = jsonLdObjects(html);
  const structuredBody = objects.map(value => findString(value, new Set(["articleBody"]))).find(Boolean) ?? null;
  const articleFragment = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? "";
  const paragraphText = [...articleFragment.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match => textFromHtml(match[1])).filter(Boolean).join("\n\n");
  const blocksStart = html.search(/<div\b[^>]*id=["']article-blocks["'][^>]*>/i);
  const blocksEnd = blocksStart >= 0 ? html.indexOf("<section class=\"articlesList", blocksStart) : -1;
  const blocksText = blocksStart >= 0 && blocksEnd > blocksStart ? textFromHtml(html.slice(blocksStart, blocksEnd)) : "";
  const sourceText = [structuredBody ? textFromHtml(structuredBody) : "", paragraphText, blocksText].sort((left, right) => right.length - left.length)[0];
  if (sourceText.length < 80) return null;
  const structuredTitle = objects.map(value => findString(value, new Set(["headline"]))).find(Boolean);
  const title = structuredTitle || metaContent(html, ["og:title", "twitter:title"]) || candidate.title;
  const structuredDate = objects.map(value => findString(value, new Set(["datePublished"]))).find(Boolean);
  const publishedAt = asDate(structuredDate) || asDate(metaContent(html, ["article:published_time", "datePublished"])) || candidate.publishedAt;
  if (!title || !publishedAt) return null;
  return { ...candidate, title: textFromHtml(title), publishedAt, sourceText };
};

type SourceCategory = "mike_confirmed" | "telegraaf_unknown" | "other_journalist" | "irrelevant";

const attributionVerbs = "meldt|schrijft|vertelt|zegt|verwacht|beweert|weet(?: te vertellen)?|laat(?:\\s+(?:(?:op|via)\\s+(?:x|twitter)\\s+)?)?weten|stelt|is van mening|benadrukt|reageert|laat blijken|onthult|verklaart|komt met|verneemt|vindt|denkt|vermoedt";
const otherJournalists = ["Wim Kieft", "Valentijn Driessen"] as const;

const personIsSource = (name: string, title: string, sourceText: string) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const combined = `${title}\n${sourceText}`;
  return new RegExp(`\\b(?:volgens|aldus)\\s+(?:de )?${escaped}\\b`, "i").test(combined)
    || new RegExp(`\\b${escaped}\\b[^.]{0,90}\\b(?:${attributionVerbs})\\b`, "i").test(combined)
    || new RegExp(`\\b(?:(?:zo|dat)\\s+)?(?:${attributionVerbs})\\s+(?:(?:De\\s+Telegraaf-)?(?:journalist|verslaggever|columnist|Ajax-?watcher|Ajax-?volger)\\s+)?${escaped}\\b`, "i").test(combined)
    || new RegExp(`\\b${escaped}\\b[^.!?]{0,160}\\bzo\\s+laat\\s+hij\\s+blijken\\b`, "i").test(combined)
    || new RegExp(`\\b(?:journalist|verslaggever|columnist|Ajax-?watcher|Ajax-?volger)\\s+${escaped}\\b`, "i").test(combined)
    || new RegExp(`(?:^|[\\s'“”\\"])${escaped}\\s*:`, "i").test(title);
};

export const attributionFor = (title: string, sourceText: string) => {
  const combined = `${title}\n${sourceText}`;
  const mentionsTelegraaf = /\bDe Telegraaf\b/i.test(combined);
  const mikeXOriginalMedium = originalMediumForSecondaryJournalistAttribution(sourceText, "Mike Verweij");
  const mikeIsSource = mikeXOriginalMedium === "X" || personIsSource("Mike Verweij", title, sourceText);
  const otherJournalist = otherJournalists.find(name => personIsSource(name, title, sourceText)) ?? null;
  const category: SourceCategory = mikeIsSource
    ? "mike_confirmed"
    : otherJournalist
      ? "other_journalist"
      : mentionsTelegraaf
        ? "telegraaf_unknown"
        : "irrelevant";
  return {
    category,
    relevant: category === "mike_confirmed" || category === "telegraaf_unknown",
    journalistIsMike: category === "mike_confirmed",
    originalMedium: mikeIsSource
      ? mikeXOriginalMedium ?? (mentionsTelegraaf ? "De Telegraaf" : null)
      : mentionsTelegraaf ? "De Telegraaf" : null,
    otherJournalist,
  };
};

const sourceOnlyReason = (title: string, sourceText: string) => {
  const combined = `${title}\n${sourceText}`;
  if (/\b(?:volgens|aldus)\s+(?:de )?Mike Verweij\b/i.test(combined)) {
    return "Mike Verweij wordt expliciet genoemd na 'volgens' of 'aldus'.";
  }
  if (/\bMike Verweij\b[^.]{0,90}\b(?:meldt|schrijft|vertelt|zegt|verwacht|beweert|weet(?: te vertellen)?|laat weten|stelt|is van mening|benadrukt|reageert|laat blijken|onthult|verklaart|komt met|verneemt|vindt|denkt|vermoedt)\b/i.test(combined)) {
    return "Mike Verweij is expliciet gekoppeld aan een bestaande attributiewerkwoordregel.";
  }
  if (/\b(?:journalist|verslaggever|columnist|Ajax-?watcher|Ajax-?volger)\s+Mike Verweij\b/i.test(combined)) {
    return "De artikeltekst benoemt Mike Verweij expliciet als journalistieke bron.";
  }
  return "De bestaande attributielogica vond een expliciete Mike Verweij-vermelding.";
};

const sourceOnlyDate = (date: Date | null) => date?.toISOString() ?? null;

export const runMediaWatchSourceOnly = async (options: {
  from: Date;
  to?: Date;
}): Promise<SourceOnlyResult> => {
  const to = options.to ?? new Date();
  const window: PublicationWindow = { from: options.from, to };
  const errors: string[] = [];
  const sources: SourceOnlySourceResult[] = [];

  for (const source of crawlSources) {
    const result: SourceOnlySourceResult = {
      source: source.name,
      candidateCount: 0,
      confirmedMike: 0,
      unknown: 0,
      otherJournalist: 0,
      unreadable: 0,
      oldestDate: null,
      newestDate: null,
      pagination: "complete",
      paginationNote: "archiefadapter afgerond zonder herhaalde pagina of veiligheidslimiet",
      examples: [],
    };
    try {
      const discovered = await source.discoverBackfill(window);
      result.candidateCount = discovered.length;
      const dates = discovered.map(candidate => candidate.publishedAt?.getTime() ?? NaN).filter(Number.isFinite);
      if (dates.length) {
        result.oldestDate = new Date(Math.min(...dates)).toISOString();
        result.newestDate = new Date(Math.max(...dates)).toISOString();
      }
      await processCandidates(source.name, discovered, async candidate => {
        try {
          const html = await fetchArticleText(source.name, candidate.url);
          const article = parseArticle(html, candidate);
          if (!article || !inPublicationWindow(article.publishedAt, window)) {
            result.unreadable += 1;
            return;
          }
          const attribution = attributionFor(article.title, article.sourceText);
          if (attribution.category === "mike_confirmed") {
            result.confirmedMike += 1;
            if (result.examples.length < 10) {
              result.examples.push({
                date: sourceOnlyDate(article.publishedAt)!,
                title: article.title,
                source: source.name,
                url: article.url,
                reason: sourceOnlyReason(article.title, article.sourceText),
              });
            }
          } else if (attribution.category === "other_journalist") {
            result.otherJournalist += 1;
          } else {
            result.unknown += 1;
          }
        } catch (error) {
          result.unreadable += 1;
          errors.push(`${source.name}: ${candidate.url} — ${error instanceof Error ? error.message : "onbekende fout"}`);
        }
      });
    } catch (error) {
      result.pagination = "failed";
      result.paginationNote = error instanceof Error ? error.message : "onbekende archieffout";
      errors.push(`${source.name}: ${result.paginationNote}`);
    }
    sources.push(result);
  }

  const totals = sources.reduce<SourceOnlyResult["totals"]>((total, source) => {
    total.candidateCount += source.candidateCount;
    total.confirmedMike += source.confirmedMike;
    total.unknown += source.unknown;
    total.otherJournalist += source.otherJournalist;
    total.unreadable += source.unreadable;
    return total;
  }, { candidateCount: 0, confirmedMike: 0, unknown: 0, otherJournalist: 0, unreadable: 0 });
  const failedSources = sources.filter(source => source.pagination === "failed").length;
  return {
    mode: "source-only",
    from: options.from.toISOString(),
    to: to.toISOString(),
    status: failedSources === sources.length ? "failed" : failedSources || errors.length ? "partial" : "succeeded",
    sources,
    totals,
    errors: errors.slice(0, 50),
  };
};

const hashFor = (sourceText: string) => createHash("sha256").update(`content:${sourceText}`).digest("hex");

export const contentVersionDecision = (originalHash: string, incomingHash: string, revisionAlreadyStored: boolean) =>
  originalHash === incomingHash || revisionAlreadyStored ? "skip" : "store_revision";

const inBatches = async <T>(items: T[], size: number, action: (item: T) => Promise<void>) => {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(action));
  }
};

const processCandidates = async <T>(sourceName: string, items: T[], action: (item: T) => Promise<void>) => {
  if (sourceName === "Ajax Showtime") {
    for (const item of items) await action(item);
    return;
  }
  await inBatches(items, 5, action);
};

const publicationWindowFor = (options: MediaWatchCrawlOptions): PublicationWindow | null => {
  if ((options.mode ?? "latest") !== "backfill") return null;
  const from = options.publishedFrom;
  const to = options.publishedTo;
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new Error("Backfill vereist een geldige publishedFrom en publishedTo");
  }
  if (to.getTime() - from.getTime() > 370 * 24 * 60 * 60_000) {
    throw new Error("Backfillvenster mag maximaal 370 dagen beslaan");
  }
  return { from, to };
};

export const runMediaWatchCrawl = async (options: MediaWatchCrawlOptions = {}): Promise<CrawlResult> => {
  const sql = db();
  const publicationWindow = publicationWindowFor(options);
  const dryRun = Boolean(options.dryRun);
  const [mike] = await sql`SELECT id FROM media_watch_journalists WHERE slug='mike-verweij' AND active=true`;
  if (!mike) throw new Error("Mike Verweij ontbreekt in media_watch_journalists");
  const [run] = dryRun
    ? [{ id: "dry-run" }]
    : await sql`INSERT INTO media_watch_crawl_runs(journalist_id,trigger_kind,status) VALUES(${mike.id},${options.triggerKind ?? "manual"},'started') RETURNING id`;
  let foundCount = 0;
  let newCount = 0;
  let skippedCount = 0;
  let changedCount = 0;
  let errorCount = 0;
  let successfulSources = 0;
  const errors: string[] = [];
  const seenCandidateUrls = new Set<string>();
  const seenContentHashes = new Set<string>();

  for (const source of crawlSources) {
    try {
      const discovered = publicationWindow
        ? await source.discoverBackfill(publicationWindow)
        : await source.discoverLatest();
      const candidates = discovered.filter(candidate =>
        !seenCandidateUrls.has(candidate.url) && Boolean(seenCandidateUrls.add(candidate.url)));
      foundCount += candidates.length;
      successfulSources += 1;
      await processCandidates(source.name, candidates, async candidate => {
        try {
          const html = await fetchArticleText(source.name, candidate.url);
          const article = parseArticle(html, candidate);
          if (!article) throw new Error("titel, datum of volledige artikeltekst niet betrouwbaar uitleesbaar");
          if (publicationWindow && !inPublicationWindow(article.publishedAt, publicationWindow)) return;
          if (!/\bAjax\b/i.test(`${article.title}\n${article.sourceText}`)) return;
          const attribution = attributionFor(article.title, article.sourceText);
          if (!attribution.relevant) return;
          const deduplicationHash = hashFor(article.sourceText);
          if (seenContentHashes.has(deduplicationHash)) { skippedCount += 1; return; }
          seenContentHashes.add(deduplicationHash);
          const [byUrl] = await sql`SELECT id,journalist_id,title,published_at,original_medium,source_text,processing_status,deduplication_hash FROM media_watch_source_items WHERE url=${article.url} LIMIT 1`;
          if (byUrl) {
            const [knownRevision] = await sql`SELECT id FROM media_watch_source_item_revisions WHERE source_item_id=${byUrl.id} AND deduplication_hash=${deduplicationHash} LIMIT 1`;
            if (contentVersionDecision(String(byUrl.deduplication_hash), deduplicationHash, Boolean(knownRevision)) === "skip") {
              skippedCount += 1;
              return;
            }
            const [sameContentElsewhere] = await sql`SELECT id FROM media_watch_source_items WHERE id<>${byUrl.id} AND deduplication_hash=${deduplicationHash} UNION SELECT source_item_id AS id FROM media_watch_source_item_revisions WHERE source_item_id<>${byUrl.id} AND deduplication_hash=${deduplicationHash} LIMIT 1`;
            if (sameContentElsewhere) { skippedCount += 1; return; }
            if (dryRun) { changedCount += 1; return; }
            const journalistId = attribution.category === "mike_confirmed" ? mike.id : byUrl.journalist_id;
            const processingStatus = journalistId ? "ready" : "new";
            await sql.begin(async transaction => {
              if (typeof byUrl.source_text === "string" && byUrl.source_text.trim()) {
                await transaction`INSERT INTO media_watch_source_item_revisions(source_item_id,crawl_run_id,title,published_at,source_text,deduplication_hash) VALUES(${byUrl.id},${run.id},${byUrl.title},${byUrl.published_at},${byUrl.source_text},${byUrl.deduplication_hash}) ON CONFLICT (source_item_id,deduplication_hash) DO NOTHING`;
              }
              await transaction`UPDATE media_watch_source_items SET journalist_id=${journalistId},title=${article.title},published_at=${article.publishedAt},original_medium=${attribution.originalMedium ?? byUrl.original_medium},discovered_via=${source.name},source_text=${article.sourceText},processing_status=${processingStatus},deduplication_hash=${deduplicationHash},updated_at=now() WHERE id=${byUrl.id}`;
              await transaction`INSERT INTO media_watch_source_item_revisions(source_item_id,crawl_run_id,title,published_at,source_text,deduplication_hash) VALUES(${byUrl.id},${run.id},${article.title},${article.publishedAt},${article.sourceText},${deduplicationHash}) ON CONFLICT (source_item_id,deduplication_hash) DO NOTHING`;
            });
            changedCount += 1;
            return;
          }
          const [byHash] = await sql`SELECT id FROM media_watch_source_items WHERE deduplication_hash=${deduplicationHash} UNION SELECT source_item_id AS id FROM media_watch_source_item_revisions WHERE deduplication_hash=${deduplicationHash} LIMIT 1`;
          if (byHash) { skippedCount += 1; return; }
          if (dryRun) { newCount += 1; return; }
          const journalistId = attribution.category === "mike_confirmed" ? mike.id : null;
          const processingStatus = attribution.category === "mike_confirmed" ? "ready" : "new";
          const inserted = await sql.begin(async transaction => {
            const [created] = await transaction`INSERT INTO media_watch_source_items(journalist_id,title,url,published_at,original_medium,discovered_via,source_kind,source_format,source_account,source_text,paywall_status,processing_status,deduplication_hash) VALUES(${journalistId},${article.title},${article.url},${article.publishedAt},${attribution.originalMedium},${source.name},'secondary','article',NULL,${article.sourceText},'none',${processingStatus},${deduplicationHash}) ON CONFLICT DO NOTHING RETURNING id`;
            if (!created) return null;
            await transaction`INSERT INTO media_watch_source_item_revisions(source_item_id,crawl_run_id,title,published_at,source_text,deduplication_hash) VALUES(${created.id},${run.id},${article.title},${article.publishedAt},${article.sourceText},${deduplicationHash})`;
            return created;
          });
          if (!inserted) { skippedCount += 1; return; }
          newCount += 1;
        } catch (error) {
          errorCount += 1;
          errors.push(`${source.name}: ${candidate.url} — ${error instanceof Error ? error.message : "onbekende fout"}`);
        }
      });
    } catch (error) {
      errorCount += 1;
      errors.push(`${source.name}: ${error instanceof Error ? error.message : "onbekende fout"}`);
    }
  }

  const status: CrawlResult["status"] = successfulSources === 0 ? "failed" : errorCount ? "partial" : "succeeded";
  if (!dryRun) await sql`UPDATE media_watch_crawl_runs SET status=${status},found_count=${foundCount},new_count=${newCount},skipped_count=${skippedCount},changed_count=${changedCount},error_count=${errorCount},error_message=${errors.length ? errors.slice(0, 20).join("\n") : null},finished_at=now() WHERE id=${run.id}`;
  return { runId: String(run.id), status, foundCount, newCount, skippedCount, changedCount, errorCount };
};
