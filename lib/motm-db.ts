import postgres from "postgres";

const connectionString = () => process.env.DATABASE_URL?.trim();
let client: ReturnType<typeof postgres> | undefined;
export const db = () => {
  const url = connectionString();
  if (!url) throw new Error("DATABASE_URL ontbreekt");
  return client ??= postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10, prepare: false });
};

export const resultsFor = async (matchId: string) => {
  const rows = await db()`SELECT p.player_id, p.name_snapshot, p.image_url_snapshot, count(v.player_id)::int AS votes
    FROM motm_match_players p LEFT JOIN motm_votes v ON v.match_id=p.match_id AND v.player_id=p.player_id
    WHERE p.match_id=${matchId} GROUP BY p.player_id,p.name_snapshot,p.image_url_snapshot ORDER BY votes DESC,p.name_snapshot`;
  const total = rows.reduce((sum, row) => sum + Number(row.votes), 0);
  return rows.map(row => ({ ...row, votes: Number(row.votes), percentage: total ? Math.round(Number(row.votes) * 100 / total) : 0, total })) as Array<{ player_id: string; name_snapshot: string; image_url_snapshot: string; votes: number; percentage: number; total: number }>;
};
