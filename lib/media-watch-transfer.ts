import { createHash } from "node:crypto";
import { db } from "./motm-db";
import { relevantMediaWatchSourceText } from "./media-watch-source-context";

export const MEDIA_WATCH_EXPORT_VERSION = "media-watch-export-v1" as const;
export const MEDIA_WATCH_IMPORT_VERSION = "media-watch-import-v1" as const;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const claimTypes = new Set(["fact", "opinion", "expectation"]);
const entityRoles = new Set(["primary", "mentioned"]);
const MAX_IMPORT_SOURCES = 500;
const MAX_CLAIMS_PER_SOURCE = 100;
const MAX_CLAIM_LENGTH = 4_000;
const MAX_EVIDENCE_LENGTH = 8_000;
const MAX_ENTITY_NAME_LENGTH = 300;

export type MediaWatchRevisionRecord = {
  revisionId: string;
  sourceItemId: string;
  journalistId: string;
  journalistName: string;
  title: string;
  url: string;
  publishedAt: string | Date;
  observedAt: string | Date;
  originalMedium: string | null;
  discoveredVia: string | null;
  sourceKind: "primary" | "secondary";
  sourceFormat: "article" | "x_post";
  sourceText: string;
  contentHash: string;
};

export type MediaWatchEntityRecord = {
  id: string;
  canonicalName: string;
  aliases: string[];
  ajaxPlayerId: string | null;
};

export type MediaWatchExportDocument = {
  schema_version: typeof MEDIA_WATCH_EXPORT_VERSION;
  generated_at: string;
  source_count: number;
  sources: Array<{
    source_item_id: string;
    revision_id: string;
    published_at: string;
    observed_at: string;
    journalist: string;
    original_medium: string | null;
    discovered_via: string | null;
    source_url: string;
    title: string;
    source_kind: "primary" | "secondary";
    source_format: "article" | "x_post";
    source_passage: string;
    content_hash: string;
  }>;
  existing_entities: Array<{
    entity_id: string;
    canonical_name: string;
    aliases: string[];
  }>;
};

type ImportEntity = { entity_id: string | null; canonical_name: string; role: "primary" | "mentioned" };
type ImportClaim = { claim: string; claim_type: "fact" | "opinion" | "expectation"; evidence_quote: string; entities: ImportEntity[] };
type ImportSource = { source_item_id: string; revision_id: string; decision: "accepted" | "rejected"; reason?: string; claims: ImportClaim[] };
type ImportDocument = { schema_version: typeof MEDIA_WATCH_IMPORT_VERSION; sources: ImportSource[] };
type ResolvedEntity = ImportEntity & { existingEntityId: string | null; normalizedName: string };
type PlannedClaim = Omit<ImportClaim, "entities"> & { entities: ResolvedEntity[] };

export type PlannedMediaWatchSource = Omit<ImportSource, "claims"> & {
  claims: PlannedClaim[];
  revision: MediaWatchRevisionRecord;
  status: "ready" | "skipped";
};

export type MediaWatchImportPreview = {
  valid: boolean;
  errors: string[];
  totalSources: number;
  readySources: number;
  skippedSources: number;
  acceptedSources: number;
  rejectedSources: number;
  claimCount: number;
  existingEntitiesUsed: number;
  newEntityNames: string[];
  sources: PlannedMediaWatchSource[];
  document: ImportDocument | null;
};

export type MediaWatchImportResult = {
  importedSources: number;
  skippedSources: number;
  acceptedSources: number;
  rejectedSources: number;
  claimCount: number;
  createdEntities: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const checkKeys = (value: Record<string, unknown>, allowed: readonly string[], path: string, errors: string[]) => {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${path}: onverwacht veld '${key}'.`);
  }
};

const requiredText = (value: unknown, path: string, errors: string[], maxLength: number) => {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${path}: niet-lege tekst vereist.`);
    return "";
  }
  if (value.length > maxLength) errors.push(`${path}: maximaal ${maxLength} tekens toegestaan.`);
  return value.trim();
};

const requiredUuid = (value: unknown, path: string, errors: string[]) => {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    errors.push(`${path}: geldige UUID vereist.`);
    return "";
  }
  return value;
};

const nullableUuid = (value: unknown, path: string, errors: string[]) => {
  if (value === null) return null;
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    errors.push(`${path}: UUID of null vereist.`);
    return null;
  }
  return value;
};

export const normalizeMediaWatchEntityName = (value: string) => value
  .normalize("NFKC")
  .replace(/[‘’‛`´]/g, "'")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase("nl-NL");

export const buildMediaWatchExportDocument = (
  revisions: readonly MediaWatchRevisionRecord[],
  entities: readonly MediaWatchEntityRecord[],
  generatedAt = new Date(),
): MediaWatchExportDocument => {
  const sources = revisions.map(revision => ({
    source_item_id: revision.sourceItemId,
    revision_id: revision.revisionId,
    published_at: new Date(revision.publishedAt).toISOString(),
    observed_at: new Date(revision.observedAt).toISOString(),
    journalist: revision.journalistName,
    original_medium: revision.originalMedium,
    discovered_via: revision.discoveredVia,
    source_url: revision.url,
    title: revision.title,
    source_kind: revision.sourceKind,
    source_format: revision.sourceFormat,
    source_passage: relevantMediaWatchSourceText(revision.sourceText, revision.sourceKind, revision.journalistName),
    content_hash: revision.contentHash,
  }));
  return {
    schema_version: MEDIA_WATCH_EXPORT_VERSION,
    generated_at: generatedAt.toISOString(),
    source_count: sources.length,
    sources,
    existing_entities: entities.map(entity => ({
      entity_id: entity.id,
      canonical_name: entity.canonicalName,
      aliases: entity.aliases,
    })),
  };
};

const parseImportDocument = (payload: unknown, errors: string[]): ImportDocument | null => {
  if (!isRecord(payload)) {
    errors.push("Bestand: JSON-object vereist.");
    return null;
  }
  checkKeys(payload, ["schema_version", "sources"], "Bestand", errors);
  if (payload.schema_version !== MEDIA_WATCH_IMPORT_VERSION) {
    errors.push(`Bestand.schema_version: '${MEDIA_WATCH_IMPORT_VERSION}' vereist.`);
  }
  if (!Array.isArray(payload.sources)) {
    errors.push("Bestand.sources: array vereist.");
    return null;
  }
  if (payload.sources.length > MAX_IMPORT_SOURCES) {
    errors.push(`Bestand.sources: maximaal ${MAX_IMPORT_SOURCES} bronnen toegestaan.`);
  }

  const sources: ImportSource[] = [];
  payload.sources.slice(0, MAX_IMPORT_SOURCES).forEach((candidate, sourceIndex) => {
    const path = `sources[${sourceIndex}]`;
    if (!isRecord(candidate)) {
      errors.push(`${path}: object vereist.`);
      return;
    }
    checkKeys(candidate, ["source_item_id", "revision_id", "decision", "reason", "claims"], path, errors);
    const sourceItemId = requiredUuid(candidate.source_item_id, `${path}.source_item_id`, errors);
    const revisionId = requiredUuid(candidate.revision_id, `${path}.revision_id`, errors);
    const decision = candidate.decision;
    if (decision !== "accepted" && decision !== "rejected") {
      errors.push(`${path}.decision: 'accepted' of 'rejected' vereist.`);
    }
    if (!Array.isArray(candidate.claims)) {
      errors.push(`${path}.claims: array vereist.`);
      return;
    }
    if (candidate.claims.length > MAX_CLAIMS_PER_SOURCE) {
      errors.push(`${path}.claims: maximaal ${MAX_CLAIMS_PER_SOURCE} claims toegestaan.`);
    }

    const claims: ImportClaim[] = [];
    candidate.claims.slice(0, MAX_CLAIMS_PER_SOURCE).forEach((claimCandidate, claimIndex) => {
      const claimPath = `${path}.claims[${claimIndex}]`;
      if (!isRecord(claimCandidate)) {
        errors.push(`${claimPath}: object vereist.`);
        return;
      }
      checkKeys(claimCandidate, ["claim", "claim_type", "evidence_quote", "entities"], claimPath, errors);
      const claim = requiredText(claimCandidate.claim, `${claimPath}.claim`, errors, MAX_CLAIM_LENGTH);
      const evidenceQuote = requiredText(claimCandidate.evidence_quote, `${claimPath}.evidence_quote`, errors, MAX_EVIDENCE_LENGTH);
      const claimType = claimCandidate.claim_type;
      if (typeof claimType !== "string" || !claimTypes.has(claimType)) {
        errors.push(`${claimPath}.claim_type: fact, opinion of expectation vereist.`);
      }
      if (!Array.isArray(claimCandidate.entities)) {
        errors.push(`${claimPath}.entities: array vereist.`);
        return;
      }
      const claimEntities: ImportEntity[] = [];
      claimCandidate.entities.forEach((entityCandidate, entityIndex) => {
        const entityPath = `${claimPath}.entities[${entityIndex}]`;
        if (!isRecord(entityCandidate)) {
          errors.push(`${entityPath}: object vereist.`);
          return;
        }
        checkKeys(entityCandidate, ["entity_id", "canonical_name", "role"], entityPath, errors);
        const entityId = nullableUuid(entityCandidate.entity_id, `${entityPath}.entity_id`, errors);
        const canonicalName = requiredText(entityCandidate.canonical_name, `${entityPath}.canonical_name`, errors, MAX_ENTITY_NAME_LENGTH);
        const role = entityCandidate.role;
        if (typeof role !== "string" || !entityRoles.has(role)) {
          errors.push(`${entityPath}.role: primary of mentioned vereist.`);
        }
        claimEntities.push({
          entity_id: entityId,
          canonical_name: canonicalName,
          role: role === "primary" ? "primary" : "mentioned",
        });
      });
      claims.push({
        claim,
        claim_type: claimTypes.has(String(claimType)) ? claimType as ImportClaim["claim_type"] : "fact",
        evidence_quote: evidenceQuote,
        entities: claimEntities,
      });
    });

    const reason = candidate.reason === undefined
      ? undefined
      : requiredText(candidate.reason, `${path}.reason`, errors, MAX_CLAIM_LENGTH);
    if (decision === "accepted") {
      if (!claims.length) errors.push(`${path}: accepted vereist minimaal één claim.`);
      if (candidate.reason !== undefined) errors.push(`${path}.reason: niet toegestaan bij accepted.`);
    }
    if (decision === "rejected") {
      if (!reason) errors.push(`${path}.reason: verplicht bij rejected.`);
      if (claims.length) errors.push(`${path}.claims: moet leeg zijn bij rejected.`);
    }
    sources.push({
      source_item_id: sourceItemId,
      revision_id: revisionId,
      decision: decision === "rejected" ? "rejected" : "accepted",
      ...(reason ? { reason } : {}),
      claims,
    });
  });
  return { schema_version: MEDIA_WATCH_IMPORT_VERSION, sources };
};

const createEntityLookup = (entities: readonly MediaWatchEntityRecord[]) => {
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  const byName = new Map<string, MediaWatchEntityRecord[]>();
  for (const entity of entities) {
    const names = new Set([entity.canonicalName, ...entity.aliases]
      .map(normalizeMediaWatchEntityName)
      .filter(Boolean));
    for (const name of names) byName.set(name, [...(byName.get(name) ?? []), entity]);
  }
  return { byId, byName };
};

export const validateMediaWatchImport = (
  payload: unknown,
  revisions: readonly MediaWatchRevisionRecord[],
  entities: readonly MediaWatchEntityRecord[],
  processedRevisionIds: ReadonlySet<string>,
): MediaWatchImportPreview => {
  const errors: string[] = [];
  const document = parseImportDocument(payload, errors);
  const revisionsById = new Map(revisions.map(revision => [revision.revisionId, revision]));
  const { byId, byName } = createEntityLookup(entities);
  const seenRevisionIds = new Set<string>();
  const newNames = new Map<string, string>();
  const existingIdsUsed = new Set<string>();
  const plannedSources: PlannedMediaWatchSource[] = [];

  for (const [sourceIndex, source] of (document?.sources ?? []).entries()) {
    const path = `sources[${sourceIndex}]`;
    if (seenRevisionIds.has(source.revision_id)) {
      errors.push(`${path}.revision_id: revision staat meer dan één keer in het bestand.`);
    }
    seenRevisionIds.add(source.revision_id);
    const revision = revisionsById.get(source.revision_id);
    if (!revision) {
      errors.push(`${path}.revision_id: geen bevestigde Mike Verweij-revision.`);
      continue;
    }
    if (revision.sourceItemId !== source.source_item_id) {
      errors.push(`${path}: revision_id hoort niet bij source_item_id.`);
      continue;
    }
    const sourcePassage = relevantMediaWatchSourceText(revision.sourceText, revision.sourceKind, revision.journalistName);
    const plannedClaims: PlannedClaim[] = source.claims.map((claim, claimIndex) => {
      if (!revision.sourceText.includes(claim.evidence_quote) || !sourcePassage.includes(claim.evidence_quote)) {
        errors.push(`${path}.claims[${claimIndex}].evidence_quote: quote komt niet letterlijk voor in de geëxporteerde bronpassage.`);
      }
      const seenClaimEntities = new Set<string>();
      const resolvedEntities = claim.entities.map((entity, entityIndex): ResolvedEntity => {
        const entityPath = `${path}.claims[${claimIndex}].entities[${entityIndex}]`;
        const normalizedName = normalizeMediaWatchEntityName(entity.canonical_name);
        let existingEntityId: string | null = null;
        if (entity.entity_id) {
          const existing = byId.get(entity.entity_id);
          if (!existing) {
            errors.push(`${entityPath}.entity_id: entity bestaat niet.`);
          } else {
            const exactNames = [existing.canonicalName, ...existing.aliases].map(normalizeMediaWatchEntityName);
            if (!exactNames.includes(normalizedName)) {
              errors.push(`${entityPath}: entity_id en canonical_name horen niet bij elkaar.`);
            }
            existingEntityId = existing.id;
            existingIdsUsed.add(existing.id);
          }
        } else {
          const exact = byName.get(normalizedName) ?? [];
          if (exact.length > 1) {
            errors.push(`${entityPath}.canonical_name: naam is ambigu in bestaande entities.`);
          } else if (exact.length === 1) {
            existingEntityId = exact[0].id;
            existingIdsUsed.add(exact[0].id);
          } else {
            const previousSpelling = newNames.get(normalizedName);
            if (previousSpelling && previousSpelling !== entity.canonical_name) {
              errors.push(`${entityPath}.canonical_name: conflicterende spelling voor dezelfde nieuwe entity.`);
            }
            newNames.set(normalizedName, entity.canonical_name);
          }
        }
        const duplicateKey = existingEntityId ?? `new:${normalizedName}`;
        if (seenClaimEntities.has(duplicateKey)) errors.push(`${entityPath}: dezelfde entity staat dubbel in één claim.`);
        seenClaimEntities.add(duplicateKey);
        return { ...entity, existingEntityId, normalizedName };
      });
      return { ...claim, entities: resolvedEntities };
    });
    plannedSources.push({
      ...source,
      claims: plannedClaims,
      revision,
      status: processedRevisionIds.has(source.revision_id) ? "skipped" : "ready",
    });
  }

  const readySources = plannedSources.filter(source => source.status === "ready");
  return {
    valid: errors.length === 0 && document !== null,
    errors,
    totalSources: plannedSources.length,
    readySources: readySources.length,
    skippedSources: plannedSources.length - readySources.length,
    acceptedSources: readySources.filter(source => source.decision === "accepted").length,
    rejectedSources: readySources.filter(source => source.decision === "rejected").length,
    claimCount: readySources.reduce((total, source) => total + source.claims.length, 0),
    existingEntitiesUsed: existingIdsUsed.size,
    newEntityNames: [...newNames.values()],
    sources: plannedSources,
    document,
  };
};

const mapRevision = (row: any): MediaWatchRevisionRecord => ({
  revisionId: String(row.revision_id),
  sourceItemId: String(row.source_item_id),
  journalistId: String(row.journalist_id),
  journalistName: String(row.journalist_name),
  title: String(row.title),
  url: String(row.url),
  publishedAt: row.published_at,
  observedAt: row.observed_at,
  originalMedium: row.original_medium === null ? null : String(row.original_medium),
  discoveredVia: row.discovered_via === null ? null : String(row.discovered_via),
  sourceKind: row.source_kind,
  sourceFormat: row.source_format,
  sourceText: String(row.source_text),
  contentHash: String(row.content_hash),
});

const mapEntity = (row: any): MediaWatchEntityRecord => ({
  id: String(row.id),
  canonicalName: String(row.canonical_name),
  aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : [],
  ajaxPlayerId: row.ajax_player_id === null ? null : String(row.ajax_player_id),
});

const allMikeRevisions = (sql: any) => sql`
  SELECT r.id AS revision_id,r.source_item_id,s.journalist_id,j.name AS journalist_name,
    r.title,s.url,r.published_at,r.observed_at,s.original_medium,s.discovered_via,
    s.source_kind,s.source_format,r.source_text,r.deduplication_hash AS content_hash
  FROM media_watch_source_item_revisions r
  JOIN media_watch_source_items s ON s.id=r.source_item_id
  JOIN media_watch_journalists j ON j.id=s.journalist_id
  WHERE j.slug='mike-verweij'
  ORDER BY r.published_at ASC,r.observed_at ASC,r.id ASC`;

const allEntities = (sql: any) => sql`
  SELECT id,canonical_name,aliases,ajax_player_id
  FROM media_watch_entities ORDER BY canonical_name ASC,id ASC`;

export const getMediaWatchExport = async (): Promise<MediaWatchExportDocument> => {
  const sql = db();
  const revisionRows = await sql`
    SELECT r.id AS revision_id,r.source_item_id,s.journalist_id,j.name AS journalist_name,
      r.title,s.url,r.published_at,r.observed_at,s.original_medium,s.discovered_via,
      s.source_kind,s.source_format,r.source_text,r.deduplication_hash AS content_hash
    FROM media_watch_source_item_revisions r
    JOIN media_watch_source_items s ON s.id=r.source_item_id
    JOIN media_watch_journalists j ON j.id=s.journalist_id
    LEFT JOIN media_watch_processed_revisions p ON p.revision_id=r.id
    WHERE j.slug='mike-verweij' AND p.revision_id IS NULL
    ORDER BY r.published_at ASC,r.observed_at ASC,r.id ASC`;
  const entityRows = await allEntities(sql);
  return buildMediaWatchExportDocument(revisionRows.map(mapRevision), entityRows.map(mapEntity));
};

export const countUnprocessedMediaWatchRevisions = async () => {
  const [row] = await db()`
    SELECT count(*)::INTEGER AS count
    FROM media_watch_source_item_revisions r
    JOIN media_watch_source_items s ON s.id=r.source_item_id
    JOIN media_watch_journalists j ON j.id=s.journalist_id
    LEFT JOIN media_watch_processed_revisions p ON p.revision_id=r.id
    WHERE j.slug='mike-verweij' AND p.revision_id IS NULL`;
  return Number(row?.count ?? 0);
};

const decodeJson = (raw: string) => {
  try {
    return { payload: JSON.parse(raw) as unknown, parseError: null };
  } catch {
    return { payload: null, parseError: "Bestand bevat geen geldige JSON." };
  }
};

const previewWithSql = async (sql: any, raw: string, lockProcessed = false) => {
  const decoded = decodeJson(raw);
  const revisionRows = await allMikeRevisions(sql);
  const entityRows = await allEntities(sql);
  const processedRows = lockProcessed
    ? await sql`SELECT revision_id FROM media_watch_processed_revisions FOR UPDATE`
    : await sql`SELECT revision_id FROM media_watch_processed_revisions`;
  const preview = validateMediaWatchImport(
    decoded.payload,
    revisionRows.map(mapRevision),
    entityRows.map(mapEntity),
    new Set(processedRows.map((row: any) => String(row.revision_id))),
  );
  if (decoded.parseError) preview.errors.unshift(decoded.parseError);
  preview.valid = preview.errors.length === 0 && decoded.parseError === null;
  return preview;
};

export const previewMediaWatchImport = (raw: string) => previewWithSql(db(), raw);

const uniqueSlug = (name: string, occupied: Set<string>) => {
  const base = name.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "entity";
  let slug = base;
  if (occupied.has(slug)) {
    const suffix = createHash("sha256").update(normalizeMediaWatchEntityName(name)).digest("hex").slice(0, 12);
    slug = `${base.slice(0, 57)}-${suffix}`;
  }
  let counter = 2;
  while (occupied.has(slug)) slug = `${base.slice(0, 75)}-${counter++}`;
  occupied.add(slug);
  return slug;
};

export const confirmMediaWatchImport = async (
  raw: string,
): Promise<MediaWatchImportResult | MediaWatchImportPreview> => db().begin(async transaction => {
  await transaction`LOCK TABLE media_watch_entities IN SHARE ROW EXCLUSIVE MODE`;
  const preview = await previewWithSql(transaction, raw, true);
  if (!preview.valid) return preview;

  const readySources = preview.sources.filter(source => source.status === "ready");
  const currentEntities = (await allEntities(transaction)).map(mapEntity);
  const names = createEntityLookup(currentEntities).byName;
  const occupiedSlugs = new Set((await transaction`SELECT slug FROM media_watch_entities`).map((row: any) => String(row.slug)));
  const createdByName = new Map<string, string>();
  let createdEntities = 0;

  for (const source of readySources) {
    for (const claim of source.claims) {
      for (const entity of claim.entities) {
        if (entity.existingEntityId || createdByName.has(entity.normalizedName)) continue;
        const exact = names.get(entity.normalizedName) ?? [];
        if (exact.length === 1) {
          createdByName.set(entity.normalizedName, exact[0].id);
          continue;
        }
        if (exact.length > 1) throw new Error("Ambigue entity tijdens import");
        const [created] = await transaction`
          INSERT INTO media_watch_entities(slug,canonical_name,aliases,ajax_player_id)
          VALUES(${uniqueSlug(entity.canonical_name, occupiedSlugs)},${entity.canonical_name},${[]},NULL)
          RETURNING id`;
        const createdId = String(created.id);
        createdByName.set(entity.normalizedName, createdId);
        names.set(entity.normalizedName, [{ id: createdId, canonicalName: entity.canonical_name, aliases: [], ajaxPlayerId: null }]);
        createdEntities += 1;
      }
    }
  }

  let claimCount = 0;
  for (const source of readySources) {
    for (const claim of source.claims) {
      const extractionHash = createHash("sha256")
        .update(JSON.stringify({ revisionId: source.revision_id, claim }))
        .digest("hex");
      const attributedParties = claim.entities.map(entity => entity.canonical_name);
      const [inserted] = await transaction`
        INSERT INTO media_watch_claims(
          source_item_id,source_revision_id,journalist_id,dossier_id,claim_type,
          structured_text,evidence_quote,certainty,attributed_parties,subject,attribution,extraction_hash
        ) VALUES(
          ${source.source_item_id},${source.revision_id},${source.revision.journalistId},NULL,
          ${claim.claim_type},${claim.claim},${claim.evidence_quote},NULL,${attributedParties},NULL,NULL,${extractionHash}
        )
        ON CONFLICT (source_item_id,extraction_hash) WHERE extraction_hash IS NOT NULL
        DO NOTHING RETURNING id`;
      const claimId = inserted?.id ?? (await transaction`
        SELECT id FROM media_watch_claims
        WHERE source_item_id=${source.source_item_id} AND extraction_hash=${extractionHash}
        LIMIT 1`)[0]?.id;
      if (!claimId) throw new Error("Claim kon niet betrouwbaar worden opgeslagen");

      for (const entity of claim.entities) {
        const entityId = entity.existingEntityId ?? createdByName.get(entity.normalizedName);
        if (!entityId) throw new Error("Entity kon niet betrouwbaar worden gekoppeld");
        await transaction`
          INSERT INTO media_watch_claim_entities(claim_id,entity_id,role)
          VALUES(${claimId},${entityId},${entity.role})
          ON CONFLICT (claim_id,entity_id) DO UPDATE SET role=EXCLUDED.role`;
      }
      claimCount += 1;
    }

    const importHash = createHash("sha256").update(JSON.stringify({
      source_item_id: source.source_item_id,
      revision_id: source.revision_id,
      decision: source.decision,
      reason: source.reason,
      claims: source.claims,
    })).digest("hex");
    await transaction`
      INSERT INTO media_watch_processed_revisions(revision_id,source_item_id,result,import_hash,claim_count)
      VALUES(${source.revision_id},${source.source_item_id},${source.decision},${importHash},${source.claims.length})`;
    await transaction`
      UPDATE media_watch_source_items SET processing_status='processed',updated_at=now()
      WHERE id=${source.source_item_id} AND deduplication_hash=${source.revision.contentHash}`;
  }

  return {
    importedSources: readySources.length,
    skippedSources: preview.skippedSources,
    acceptedSources: preview.acceptedSources,
    rejectedSources: preview.rejectedSources,
    claimCount,
    createdEntities,
  };
});
