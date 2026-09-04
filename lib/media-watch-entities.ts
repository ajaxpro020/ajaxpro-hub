export type MediaWatchEntity = {
  id: string;
  canonicalName: string;
  aliases: string[];
};

export type MediaWatchEntityClaim = {
  structuredText: string;
  evidenceQuote: string;
  subject: string | null;
};

export type MediaWatchEntityMatch = {
  entityId: string;
  role: "primary" | "mentioned";
};

const normalizeLiteral = (value: string) => value
  .normalize("NFKC")
  .replace(/[‘’‛`´]/g, "'")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase("nl-NL");

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const explicitNamePattern = (literal: string) => new RegExp(
  `(?:^|[^\\p{L}\\p{N}])${escapeRegExp(literal)}(?=$|[^\\p{L}\\p{N}])`,
  "iu",
);

const startsWithName = (text: string, literal: string) => new RegExp(
  `^[\\s\"'“”‘’]*(?:${escapeRegExp(literal)})(?=$|[^\\p{L}\\p{N}])`,
  "iu",
).test(text);

/**
 * Matches only configured canonical names and aliases. A literal shared by more
 * than one entity is deliberately ignored, so surname aliases fail closed.
 */
export const matchMediaWatchClaimEntities = (
  claim: MediaWatchEntityClaim,
  entities: readonly MediaWatchEntity[],
): MediaWatchEntityMatch[] => {
  const termOwners = new Map<string, Set<string>>();
  const termsByEntity = new Map<string, string[]>();

  for (const entity of entities) {
    const terms = [...new Set([entity.canonicalName, ...entity.aliases].map(normalizeLiteral).filter(Boolean))];
    termsByEntity.set(entity.id, terms);
    for (const term of terms) {
      const owners = termOwners.get(term) ?? new Set<string>();
      owners.add(entity.id);
      termOwners.set(term, owners);
    }
  }

  const claimText = normalizeLiteral(claim.structuredText);
  const evidenceText = normalizeLiteral(claim.evidenceQuote);
  const subject = claim.subject ? normalizeLiteral(claim.subject) : null;
  const matches: MediaWatchEntityMatch[] = [];

  for (const entity of entities) {
    const unambiguousTerms = (termsByEntity.get(entity.id) ?? [])
      .filter(term => termOwners.get(term)?.size === 1);
    const explicitTerms = unambiguousTerms.filter(term =>
      explicitNamePattern(term).test(claimText) || explicitNamePattern(term).test(evidenceText));
    if (!explicitTerms.length) continue;

    const primary = Boolean(
      (subject && explicitTerms.includes(subject))
      || explicitTerms.some(term => startsWithName(claimText, term)),
    );
    matches.push({ entityId: entity.id, role: primary ? "primary" : "mentioned" });
  }

  return matches;
};
