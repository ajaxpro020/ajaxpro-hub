export type VoteWriteResult = "saved" | "not_found" | "closed" | "invalid_player" | "rate_limited";

export const MOTM_VOTE_RATE_LIMIT_SECONDS = 5;

type TransactionSql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<any[]>;
};

type DatabaseSql = TransactionSql & {
  begin<T>(callback: (transaction: TransactionSql) => Promise<T>): Promise<T>;
};

export const saveVoteAtomically = (
  sql: DatabaseSql,
  slug: string,
  voterDiscordUserId: string,
  playerId: string,
): Promise<VoteWriteResult> => sql.begin(async transaction => {
  const [match] = await transaction`
    SELECT id
    FROM motm_matches
    WHERE slug = ${slug} AND deleted_at IS NULL
    FOR UPDATE
  `;

  if (!match) return "not_found";

  const [votingWindow] = await transaction`
    SELECT status = 'open' AND scheduled_close_at > clock_timestamp() AS can_vote
    FROM motm_matches
    WHERE id = ${match.id}
  `;
  if (!votingWindow?.can_vote) return "closed";

  const [rateLimit] = await transaction`
    INSERT INTO motm_vote_rate_limits(match_id, voter_discord_user_id, last_attempt_at)
    VALUES(${match.id}, ${voterDiscordUserId}, clock_timestamp())
    ON CONFLICT(match_id, voter_discord_user_id)
    DO UPDATE SET last_attempt_at = clock_timestamp()
      WHERE motm_vote_rate_limits.last_attempt_at <= clock_timestamp() - (${MOTM_VOTE_RATE_LIMIT_SECONDS} * interval '1 second')
    RETURNING 1
  `;
  if (!rateLimit) return "rate_limited";

  const [selectedPlayer] = await transaction`
    SELECT 1
    FROM motm_match_players
    WHERE match_id = ${match.id} AND player_id = ${playerId}
  `;
  if (!selectedPlayer) return "invalid_player";

  await transaction`
    INSERT INTO motm_votes(match_id, voter_discord_user_id, player_id)
    VALUES(${match.id}, ${voterDiscordUserId}, ${playerId})
    ON CONFLICT(match_id, voter_discord_user_id)
    DO UPDATE SET player_id = excluded.player_id, updated_at = now()
  `;
  return "saved";
});
