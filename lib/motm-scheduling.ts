import { db } from "./motm-db";
import { statusAt, type SchedulableMatch } from "./motm-rules";

export const synchronizeMatch = async <T extends SchedulableMatch & { id: string }>(match: T, now = new Date()): Promise<T> => {
  const status = statusAt(match, now);
  if (status === match.status) return match;
  const [updated] = await db()`UPDATE motm_matches SET status=${status},
    opened_at=CASE WHEN ${status}='open' THEN COALESCE(opened_at,${now}) WHEN ${status}='closed' THEN COALESCE(opened_at,scheduled_open_at,${now}) ELSE opened_at END,
    closed_at=CASE WHEN ${status}='closed' THEN COALESCE(closed_at,${now}) ELSE closed_at END
    WHERE id=${match.id} AND status=${match.status} RETURNING *`;
  return (updated ?? { ...match, status }) as T;
};

export const synchronizeAllMatches = async (now = new Date()) => {
  const matches = await db()`SELECT * FROM motm_matches WHERE status <> 'closed' AND
    ((status='draft' AND scheduled_open_at IS NOT NULL AND scheduled_open_at<=${now}) OR
     (scheduled_close_at IS NOT NULL AND scheduled_close_at<=${now}))`;
  for (const match of matches) await synchronizeMatch(match as any, now);
};
