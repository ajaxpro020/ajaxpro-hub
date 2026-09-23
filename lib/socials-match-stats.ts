import { resolveFotMobMatch } from "./fotmob-match-resolver";
import { fetchFotMobAjaxMatch, type FotMobSocialsMatch } from "./fotmob-socials-parser";
import { loadSocialMatchdayFixtures, type SocialMatchdayFixture } from "./socials-match-context";

export type SocialsMatchStatsPayload = FotMobSocialsMatch & { fixtureKey: string };

type LoaderOptions = {
  fixtureLoader?: () => Promise<SocialMatchdayFixture[]>;
  resolver?: typeof resolveFotMobMatch;
  parser?: typeof fetchFotMobAjaxMatch;
};

export class SocialsMatchStatsError extends Error {
  constructor(message: string, readonly status: number, options?: ErrorOptions) {
    super(message, options);
  }
}

const cardStatKeys = ["xg", "possession", "shots", "shotsOnTarget", "bigChances"] as const;
export const hasUsableMatchStats = (match: FotMobSocialsMatch) =>
  cardStatKeys.some(key => match.teamStats[key] !== null) &&
  cardStatKeys.some(key => match.opponentTeamStats[key] !== null);

export const loadSocialsMatchStats = async (
  fixtureKey: string,
  options: LoaderOptions = {},
): Promise<SocialsMatchStatsPayload> => {
  const normalizedKey = fixtureKey.trim();
  if (!normalizedKey || normalizedKey.length > 300) {
    throw new SocialsMatchStatsError("Ongeldige wedstrijd.", 400);
  }

  const fixtures = await (options.fixtureLoader ?? loadSocialMatchdayFixtures)();
  const fixture = fixtures.find(candidate => candidate.fixture_key === normalizedKey);
  if (!fixture) throw new SocialsMatchStatsError("Wedstrijd niet gevonden.", 404);

  const kickoff = new Date(fixture.kickoff_at);
  if (Number.isNaN(kickoff.getTime())) throw new SocialsMatchStatsError("Fout bij ophalen.", 502);
  if (kickoff.getTime() > Date.now()) {
    throw new SocialsMatchStatsError("Nog geen wedstrijdstats beschikbaar.", 409);
  }

  try {
    const resolved = await (options.resolver ?? resolveFotMobMatch)({
      date: kickoff.toISOString().slice(0, 10),
      homeTeam: fixture.home_team,
      awayTeam: fixture.away_team,
    });
    if (!resolved) throw new SocialsMatchStatsError("Wedstrijd niet gevonden.", 404);
    const parsed = await (options.parser ?? fetchFotMobAjaxMatch)(resolved.url);
    if (!hasUsableMatchStats(parsed)) {
      throw new SocialsMatchStatsError("Nog geen wedstrijdstats beschikbaar.", 409);
    }
    return { fixtureKey: normalizedKey, ...parsed };
  } catch (error) {
    if (error instanceof SocialsMatchStatsError) throw error;
    throw new SocialsMatchStatsError("Fout bij ophalen.", 502, { cause: error });
  }
};
