export type MatchStatus = "draft" | "open" | "closed";

export type SchedulableMatch = {
  status: MatchStatus;
  scheduled_open_at: string | Date | null;
  scheduled_close_at: string | Date | null;
};

export const statusAt = (match: SchedulableMatch, now = new Date()): MatchStatus => {
  if (match.status === "closed") return "closed";
  const openAt = match.scheduled_open_at ? new Date(match.scheduled_open_at) : null;
  const closeAt = match.scheduled_close_at ? new Date(match.scheduled_close_at) : null;
  if (closeAt && now >= closeAt && (match.status === "open" || (openAt && now >= openAt))) return "closed";
  if (match.status === "draft" && openAt && now >= openAt) return "open";
  return match.status;
};

export const canVoteAt = (match: SchedulableMatch, now = new Date()) => {
  const closeAt = match.scheduled_close_at ? new Date(match.scheduled_close_at) : null;
  return statusAt(match, now) === "open" && (!closeAt || now < closeAt);
};

export type VoteResult = { player_id: string; name_snapshot: string; image_url_snapshot: string; votes: number };
export type RankedResult = VoteResult & { rank: number; percentage: number; total: number };

export const rankResults = (rows: VoteResult[]): RankedResult[] => {
  const positive = rows.filter(row => row.votes > 0).sort((a, b) => b.votes - a.votes);
  const total = positive.reduce((sum, row) => sum + row.votes, 0);
  let rank = 0;
  let previousVotes: number | null = null;
  return positive.map(row => {
    if (row.votes !== previousVotes) rank += 1;
    previousVotes = row.votes;
    return { ...row, rank, total, percentage: total ? Math.round(row.votes * 100 / total) : 0 };
  }).filter(row => row.rank <= 3);
};

export const voteLabel = (count: number) => `${count} ${count === 1 ? "stem" : "stemmen"}`;
export const winnerLabel = (count: number) => count === 1 ? "1 winnaar" : "gedeelde winnaars";
export const statusLabel = (status: MatchStatus) => ({ draft: "Concept", open: "Open", closed: "Gesloten" })[status];

const amsterdamParts = (date: Date) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]),
);

export const amsterdamInputToUtc = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const wanted = Date.UTC(+year, +month - 1, +day, +hour, +minute);
  let candidate = new Date(wanted);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = amsterdamParts(candidate);
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    candidate = new Date(candidate.getTime() + wanted - represented);
  }
  const parts = amsterdamParts(candidate);
  return parts.year === year && parts.month === month && parts.day === day && parts.hour === hour && parts.minute === minute ? candidate : null;
};

export const toAmsterdamInput = (value: string | Date) => {
  const parts = amsterdamParts(new Date(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export const defaultSchedule = (kickoffAt: Date) => {
  const openAt = new Date(kickoffAt.getTime() + 2 * 60 * 60 * 1000);
  return { openAt, closeAt: new Date(openAt.getTime() + 24 * 60 * 60 * 1000) };
};
