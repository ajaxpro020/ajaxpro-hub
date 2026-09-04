import { db } from "./motm-db";
import { boundedMediaWatchSourcePassage } from "./media-watch-source-context";

export type MediaWatchStatementType = "fact" | "opinion" | "expectation";

export type MediaWatchPersonReference = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
};

export type MediaWatchArchiveRow = {
  claim_id: string;
  claim_type: MediaWatchStatementType;
  structured_text: string;
  evidence_quote: string;
  claim_created_at: string | Date;
  source_item_id: string;
  source_revision_id: string | null;
  source_title: string;
  published_at: string | Date;
  source_text: string | null;
  source_url: string;
  original_medium: string | null;
  discovered_via: string | null;
  journalist_name: string;
  persons: MediaWatchPersonReference[];
};

export type MediaWatchStatement = {
  id: string;
  type: MediaWatchStatementType;
  text: string;
  evidenceQuote: string;
  sourcePassage: string;
  persons: MediaWatchPersonReference[];
};

export type MediaWatchSourceMoment = {
  id: string;
  sourceItemId: string;
  sourceRevisionId: string | null;
  title: string;
  publishedAt: string | Date;
  sourceUrl: string;
  originalMedium: string | null;
  discoveredVia: string | null;
  journalistName: string;
  statements: MediaWatchStatement[];
  people: MediaWatchPersonReference[];
  searchText: string;
  gapDays: number;
  gapSpace: number;
};

export type MediaWatchPersonOption = MediaWatchPersonReference & { statementCount: number };

export type MediaWatchLibrary = {
  moments: MediaWatchSourceMoment[];
  people: MediaWatchPersonOption[];
  search: string;
  matchingMomentCount: number;
  matchingPerson: MediaWatchPersonOption | null;
  statementCount: number;
  firstPublishedAt: string | Date | null;
  lastPublishedAt: string | Date | null;
};

export type MediaWatchPersonTimeline = {
  person: MediaWatchPersonOption;
  moments: MediaWatchSourceMoment[];
  statementCount: number;
  returnSearch: string;
};

export type MediaWatchPageData = {
  library: MediaWatchLibrary;
  timeline: MediaWatchPersonTimeline | null;
};

const momentTimestamp = (value: string | Date) => new Date(value).getTime();

export const normalizeMediaWatchSearch = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase("nl-NL");

export const mediaWatchTemporalGap = (days: number) => {
  if (days <= 0) return 48;
  return Math.min(168, Math.round(54 + Math.sqrt(days) * 5.5));
};

const relevantPassageFor = (row: MediaWatchArchiveRow) => row.source_text
  ? boundedMediaWatchSourcePassage(row.source_text, row.evidence_quote)
  : "";

const availablePeopleFor = (rows: readonly MediaWatchArchiveRow[]) => {
  const byId = new Map<string, MediaWatchPersonOption>();
  for (const row of rows) {
    for (const person of row.persons) {
      const current = byId.get(person.id);
      if (current) current.statementCount += 1;
      else byId.set(person.id, { ...person, statementCount: 1 });
    }
  }
  return [...byId.values()].sort((left, right) =>
    right.statementCount - left.statementCount || left.name.localeCompare(right.name, "nl-NL"));
};

const buildMoments = (rows: readonly MediaWatchArchiveRow[]) => {
  const sorted = [...rows].sort((left, right) =>
    momentTimestamp(left.published_at) - momentTimestamp(right.published_at)
    || momentTimestamp(left.claim_created_at) - momentTimestamp(right.claim_created_at)
    || left.claim_id.localeCompare(right.claim_id));
  const moments: MediaWatchSourceMoment[] = [];
  const byMoment = new Map<string, MediaWatchSourceMoment>();

  for (const row of sorted) {
    const momentId = `${row.source_item_id}:${row.source_revision_id ?? "base"}`;
    let moment = byMoment.get(momentId);
    if (!moment) {
      const previous = moments.at(-1);
      const gapDays = previous
        ? Math.max(0, Math.round((momentTimestamp(row.published_at) - momentTimestamp(previous.publishedAt)) / 86_400_000))
        : 0;
      moment = {
        id: momentId,
        sourceItemId: row.source_item_id,
        sourceRevisionId: row.source_revision_id,
        title: row.source_title,
        publishedAt: row.published_at,
        sourceUrl: row.source_url,
        originalMedium: row.original_medium,
        discoveredVia: row.discovered_via,
        journalistName: row.journalist_name,
        statements: [],
        people: [],
        searchText: "",
        gapDays,
        gapSpace: mediaWatchTemporalGap(gapDays),
      };
      byMoment.set(momentId, moment);
      moments.push(moment);
    }
    moment.statements.push({
      id: row.claim_id,
      type: row.claim_type,
      text: row.structured_text,
      evidenceQuote: row.evidence_quote,
      sourcePassage: relevantPassageFor(row),
      persons: row.persons,
    });
    for (const person of row.persons) if (!moment.people.some(candidate => candidate.id === person.id)) moment.people.push(person);
  }

  for (const moment of moments) {
    moment.searchText = normalizeMediaWatchSearch([
      moment.title,
      ...moment.statements.map(statement => statement.text),
      ...moment.people.flatMap(person => [person.name, ...person.aliases]),
    ].join(" "));
  }
  return moments;
};

const exactPersonMatch = (people: readonly MediaWatchPersonOption[], search: string) => {
  const normalized = normalizeMediaWatchSearch(search);
  if (!normalized) return null;
  const matches = people.filter(person => [person.name, ...person.aliases]
    .some(name => normalizeMediaWatchSearch(name) === normalized));
  return matches.length === 1 ? matches[0] : null;
};

export const buildMediaWatchPageData = (
  rows: readonly MediaWatchArchiveRow[],
  input: { search?: string; entity?: string } = {},
): MediaWatchPageData => {
  const search = String(input.search ?? "").trim().slice(0, 160);
  const normalizedSearch = normalizeMediaWatchSearch(search);
  const moments = buildMoments(rows);
  const people = availablePeopleFor(rows);
  const timestamps = moments.map(moment => momentTimestamp(moment.publishedAt));
  const person = people.find(candidate => candidate.slug === input.entity) ?? null;
  const timelineRows = person
    ? rows.filter(row => row.persons.some(candidate => candidate.id === person.id))
    : [];
  return {
    library: {
      moments,
      people,
      search,
      matchingMomentCount: normalizedSearch
        ? moments.filter(moment => moment.searchText.includes(normalizedSearch)).length
        : moments.length,
      matchingPerson: exactPersonMatch(people, search),
      statementCount: rows.length,
      firstPublishedAt: timestamps.length ? new Date(Math.min(...timestamps)) : null,
      lastPublishedAt: timestamps.length ? new Date(Math.max(...timestamps)) : null,
    },
    timeline: person ? {
      person,
      moments: buildMoments(timelineRows),
      statementCount: timelineRows.length,
      returnSearch: search,
    } : null,
  };
};

const mapPersonReferences = (value: unknown): MediaWatchPersonReference[] => Array.isArray(value)
  ? value.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    if (![candidate.id, candidate.slug, candidate.name].every(item => typeof item === "string" && item.trim())) return [];
    return [{
      id: String(candidate.id),
      slug: String(candidate.slug),
      name: String(candidate.name),
      aliases: Array.isArray(candidate.aliases) ? candidate.aliases.filter((alias): alias is string => typeof alias === "string") : [],
    }];
  })
  : [];

const mapArchiveRow = (row: any): MediaWatchArchiveRow => ({
  claim_id: String(row.claim_id),
  claim_type: row.claim_type,
  structured_text: String(row.structured_text),
  evidence_quote: String(row.evidence_quote),
  claim_created_at: row.claim_created_at,
  source_item_id: String(row.source_item_id),
  source_revision_id: row.source_revision_id === null ? null : String(row.source_revision_id),
  source_title: String(row.source_title),
  published_at: row.published_at,
  source_text: row.source_text === null ? null : String(row.source_text),
  source_url: String(row.source_url),
  original_medium: row.original_medium === null ? null : String(row.original_medium),
  discovered_via: row.discovered_via === null ? null : String(row.discovered_via),
  journalist_name: String(row.journalist_name),
  persons: mapPersonReferences(row.persons),
});

export const getMediaWatchPageData = async (input: { search?: string; entity?: string } = {}) => {
  const rows = await db()`
    SELECT c.id AS claim_id,c.claim_type,c.structured_text,c.evidence_quote,
      c.created_at AS claim_created_at,s.id AS source_item_id,c.source_revision_id,
      COALESCE(r.title,s.title) AS source_title,
      COALESCE(r.published_at,s.published_at) AS published_at,
      COALESCE(r.source_text,s.source_text) AS source_text,
      s.url AS source_url,s.original_medium,s.discovered_via,j.name AS journalist_name,
      COALESCE(person_refs.persons,'[]'::jsonb) AS persons
    FROM media_watch_claims c
    JOIN media_watch_source_items s ON s.id=c.source_item_id
    JOIN media_watch_journalists j ON j.id=c.journalist_id
    LEFT JOIN media_watch_source_item_revisions r ON r.id=c.source_revision_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'id',e.id,
        'slug',e.slug,
        'name',e.canonical_name,
        'aliases',e.aliases
      ) ORDER BY e.canonical_name,e.id) AS persons
      FROM media_watch_claim_entities ce
      JOIN media_watch_entities e ON e.id=ce.entity_id
      WHERE ce.claim_id=c.id
    ) person_refs ON true
    WHERE j.slug='mike-verweij'
    ORDER BY COALESCE(r.published_at,s.published_at) ASC,c.created_at ASC,c.id ASC`;
  return buildMediaWatchPageData(rows.map(mapArchiveRow), input);
};
