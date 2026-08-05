import postgres from "postgres";
import { rankResults, type VoteResult } from "./motm-rules";

const connectionString = () => process.env.DATABASE_URL?.trim();
let client: ReturnType<typeof postgres> | undefined;
export const db = () => {
  const url = connectionString();
  if (!url) throw new Error("DATABASE_URL ontbreekt");
  return client ??= postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10, prepare: false });
};

export const resultsFor = async (matchId: string) => {
  const rows = await db()`SELECT m.id match_id,m.kickoff_at,p.player_id,p.name_snapshot,p.image_url_snapshot,count(v.player_id)::int AS votes
    FROM motm_matches target JOIN motm_matches m ON m.season_key=target.season_key AND m.status='closed' AND m.deleted_at IS NULL AND (m.kickoff_at<target.kickoff_at OR m.id=target.id)
    JOIN motm_match_players p ON p.match_id=m.id LEFT JOIN motm_votes v ON v.match_id=p.match_id AND v.player_id=p.player_id
    WHERE target.id=${matchId} GROUP BY m.id,m.kickoff_at,p.player_id,p.name_snapshot,p.image_url_snapshot ORDER BY m.kickoff_at,m.id,p.name_snapshot`;
  const rounds=new Map<string,VoteResult[]>();
  for(const row of rows){const list=rounds.get(String(row.match_id))??[];list.push({...row,votes:Number(row.votes)} as VoteResult);rounds.set(String(row.match_id),list)}
  const wins=new Map<string,number>();let target:ReturnType<typeof rankResults>=[];
  for(const [id,players] of rounds){const results=rankResults(players,wins),winner=results.find(row=>row.rank===1);if(winner)wins.set(winner.player_id,(wins.get(winner.player_id)??0)+1);if(id===matchId)target=results}
  return target;
};
