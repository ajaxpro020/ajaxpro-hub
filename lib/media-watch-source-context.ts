const REPORTING_VERB_PATTERN = "schrijft|meldt|stelt|verwacht|verklaart|vertelt|benadrukt|waarschuwt|voegt\\s+toe|laat(?:\\s+(?:(?:op|via)\\s+(?:x|twitter)\\s+)?)?weten|zegt|onthult|verneemt|vindt|denkt|vermoedt|weet(?:\\s+te\\s+vertellen)?|laat\\s+blijken|legt\\s+uit";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sentenceContaining = (text: string, index: number) => {
  const previous = Math.max(text.lastIndexOf(". ", index), text.lastIndexOf("! ", index), text.lastIndexOf("? ", index));
  const startsAt = previous < 0 ? 0 : previous + 2;
  const following = [text.indexOf(". ", index), text.indexOf("! ", index), text.indexOf("? ", index)].filter(position => position >= 0);
  const endsAt = following.length ? Math.min(...following) + 1 : text.length;
  return text.slice(startsAt, endsAt).trim();
};

const quotedPassageAfter = (text: string, startsAt: number) => {
  const colon = text.indexOf(":", startsAt);
  if (colon < 0) return null;
  const prefix = text.slice(startsAt, colon);
  if (!/\b(?:schrijft|meldt|stelt|verwacht|verklaart|vertelt|benadrukt|waarschuwt|voegt\s+toe|laat\s+weten)\b/i.test(prefix)) return null;

  const quoteIndex = text.slice(colon + 1).search(/['"“‘]/);
  if (quoteIndex < 0) return null;
  const opensAt = colon + 1 + quoteIndex;
  const opening = text[opensAt];
  const closing = opening === "“" ? "”" : opening === "‘" ? "’" : opening;
  const closesAt = text.lastIndexOf(closing);
  if (closesAt <= opensAt) return null;
  return text.slice(opensAt + 1, closesAt).trim();
};

const sentencesFor = (text: string) => text
  .split(/(?<=[.!?])\s+/)
  .map(sentence => sentence.trim())
  .filter(Boolean);

/**
 * Detects a secondary source explicitly reporting that the named journalist
 * published information on X/Twitter. A surname is allowed only when the
 * full journalist name is already present in the same source passage.
 */
const hasExplicitXPublicationAttribution = (text: string, journalistName: string, journalistAlreadyConfirmed: boolean) => {
  const name = journalistName.trim();
  const surname = name.split(/\s+/).at(-1);
  if (!name || !surname) return null;

  const escapedName = escapeRegExp(name);
  const escapedSurname = escapeRegExp(surname);
  const medium = "(?:x|twitter)";
  const journalist = journalistAlreadyConfirmed ? `(?:${escapedName}|${escapedSurname})` : escapedName;
  const patterns = [
    new RegExp(`\\b${journalist}\\b\\s+(?:schrijft|meldt)\\b[^.!?]{0,100}\\b(?:op|via)\\s+${medium}\\b`, "i"),
    new RegExp(`\\b${journalist}\\b\\s+laat\\s+(?:op|via)\\s+${medium}\\s+weten\\b`, "i"),
    new RegExp(`\\b(?:(?:zo|dat)\\s+)?(?:schrijft|meldt)\\s+${journalist}\\b[^.!?]{0,100}\\b(?:op|via)\\s+${medium}\\b`, "i"),
    new RegExp(`\\blaat\\s+${journalist}\\b\\s+(?:op|via)\\s+${medium}\\s+weten\\b`, "i"),
    new RegExp(`\\b(?:aldus|volgens)\\s+${journalist}\\b[^.!?]{0,100}\\b(?:op|via)\\s+${medium}\\b`, "i"),
  ];
  return patterns.some(pattern => pattern.test(text));
};

export const originalMediumForSecondaryJournalistAttribution = (sourceText: string, journalistName: string) => {
  const name = journalistName.trim();
  if (!name) return null;
  const namePattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");

  for (const paragraph of sourceText.split(/\n+/).map(value => value.trim()).filter(Boolean)) {
    if (!namePattern.test(paragraph)) continue;
    if (hasExplicitXPublicationAttribution(paragraph, name, true)) return "X";
  }
  return null;
};

/**
 * Keeps secondary-source context fail-closed: only passages explicitly tied to
 * the named journalist are returned. Generic outlet attribution is ignored.
 */
export const explicitlyAttributedTextForJournalist = (sourceText: string, journalistName: string) => {
  const name = journalistName.trim();
  if (!name) return "";
  const namePattern = new RegExp(escapeRegExp(name), "i");
  const passages: string[] = [];

  for (const paragraph of sourceText.split(/\n+/).map(value => value.trim()).filter(Boolean)) {
    const match = namePattern.exec(paragraph);
    if (!match) continue;
    const directQuote = quotedPassageAfter(paragraph, match.index + match[0].length);
    if (directQuote) {
      passages.push(directQuote);
      continue;
    }

    const sentence = sentenceContaining(paragraph, match.index);
    const explicitAccordingTo = new RegExp(`\\b(?:volgens|aldus)\\s+${escapeRegExp(name)}\\b`, "i").test(sentence);
    const explicitReportingVerb = new RegExp(`${escapeRegExp(name)}\\s+(?:${REPORTING_VERB_PATTERN})\\b`, "i").test(sentence);
    const explicitVerbBeforeName = new RegExp(`\\b(?:(?:zo|dat)\\s+)?(?:${REPORTING_VERB_PATTERN})\\s+(?:(?:De\\s+Telegraaf-)?(?:journalist|verslaggever|columnist|Ajax-?watcher|Ajax-?volger)\\s+)?${escapeRegExp(name)}\\b`, "i").test(sentence);
    const explicitAnaphoricAttribution = new RegExp(`${escapeRegExp(name)}[^.!?]{0,160}\\bzo\\s+laat\\s+hij\\s+blijken\\b`, "i").test(sentence);
    if (explicitAccordingTo || explicitReportingVerb || explicitVerbBeforeName || explicitAnaphoricAttribution) passages.push(sentence);

    if (originalMediumForSecondaryJournalistAttribution(paragraph, name) === "X") {
      const xSentence = sentencesFor(paragraph).find(value => hasExplicitXPublicationAttribution(value, name, true));
      if (xSentence) passages.push(xSentence);
    }
  }

  return [...new Set(passages)].join("\n\n");
};

export const relevantMediaWatchSourceText = (sourceText: string, sourceKind: string, journalistName: string) =>
  sourceKind === "secondary" ? explicitlyAttributedTextForJournalist(sourceText, journalistName) : sourceText;

export const boundedMediaWatchSourcePassage = (sourceText: string, evidenceQuote: string, radius = 420) => {
  const quoteAt = sourceText.indexOf(evidenceQuote);
  if (quoteAt < 0) return "";
  const boundedRadius = Math.max(120, Math.min(1_000, Math.trunc(radius)));
  const startsAt = Math.max(0, quoteAt - boundedRadius);
  const endsAt = Math.min(sourceText.length, quoteAt + evidenceQuote.length + boundedRadius);
  const passage = sourceText.slice(startsAt, endsAt).trim();
  return `${startsAt > 0 ? "…" : ""}${passage}${endsAt < sourceText.length ? "…" : ""}`;
};
