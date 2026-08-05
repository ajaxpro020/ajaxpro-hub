export const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
export const API_FOOTBALL_AJAX_TEAM_ID = 194;
export const MATCHDAY_DAILY_LIMIT = 100;

export const LIVE_STATUSES = new Set(["1H", "2H", "ET", "P", "BT", "LIVE", "INT"]);
export const BREAK_STATUSES = new Set(["HT"]);
export const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "CANC", "ABD", "AWD", "WO"]);

export type MatchdayMode = "countdown" | "live" | "hidden";

export type MatchdayState = {
  kickoff: Date | string;
  providerStatus?: string | null;
  finishedAt?: Date | string | null;
};

const partsInAmsterdam = (date: Date) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]),
) as Record<string, string>;

export const amsterdamDateKey = (date = new Date()) => {
  const parts = partsInAmsterdam(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const amsterdamLocalToUtc = (year: number, month: number, day: number, hour: number, minute: number) => {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = wallClock;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = partsInAmsterdam(new Date(candidate));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    candidate -= represented - wallClock;
  }
  return new Date(candidate);
};

export const modeForMatch = (state: MatchdayState, now = new Date()): MatchdayMode => {
  const status = state.providerStatus ?? "NS";
  if (state.finishedAt || FINISHED_STATUSES.has(status)) return "hidden";
  if (LIVE_STATUSES.has(status) || BREAK_STATUSES.has(status) || now.getTime() >= new Date(state.kickoff).getTime()) return "live";
  return "countdown";
};

export const nextProviderDelayMs = ({ status, calls, failed = false }: { status?: string | null; calls: number; failed?: boolean }) => {
  if (calls >= MATCHDAY_DAILY_LIMIT || FINISHED_STATUSES.has(status ?? "")) return null;
  if (failed) return 5 * 60_000;
  if (BREAK_STATUSES.has(status ?? "")) return 16 * 60_000;
  if (calls >= 94) return 5 * 60_000;
  return 60_000;
};

export const countdownParts = (kickoff: Date | string, now = new Date()) => {
  const remaining = Math.max(0, new Date(kickoff).getTime() - now.getTime());
  const totalMinutes = Math.floor(remaining / 60_000);
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    totalMilliseconds: remaining,
  };
};

export const normalizeTeamName = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\b(afc|fc|fk|sc|amsterdam)\b/g, "")
  .replace(/[^a-z0-9]/g, "");

export const selectProviderFixture = <T extends { fixture: { id: number; date: string }; teams: { home: { name: string }; away: { name: string } } }>(
  fixtures: T[],
  expected: { home: string; away: string; kickoff: Date | string },
) => fixtures.find(item => {
  const kickoffDifference = Math.abs(new Date(item.fixture.date).getTime() - new Date(expected.kickoff).getTime());
  return kickoffDifference <= 30 * 60_000
    && normalizeTeamName(item.teams.home.name).includes(normalizeTeamName(expected.home))
    && normalizeTeamName(item.teams.away.name).includes(normalizeTeamName(expected.away));
});
