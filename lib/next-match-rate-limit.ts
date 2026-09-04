import { createHmac } from "node:crypto";
import { db } from "./motm-db";

export const NEXT_MATCH_RATE_LIMIT_MAX = 60;
export const NEXT_MATCH_RATE_LIMIT_WINDOW_SECONDS = 60;

type Sql = ReturnType<typeof db>;

const requestSource = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
};

export const nextMatchSourceHash = (request: Request, secret: string) =>
  createHmac("sha256", secret).update(requestSource(request)).digest("hex");

export const consumeNextMatchRateLimit = async (
  request: Request,
  sql: Sql = db(),
  secret = process.env.SESSION_SECRET?.trim() || "ajaxpro-next-match-rate-limit",
) => {
  const sourceHash = nextMatchSourceHash(request, secret);
  const [result] = await sql`
    INSERT INTO matchday_request_rate_limits(source_hash, window_started_at, request_count)
    VALUES(${sourceHash}, clock_timestamp(), 1)
    ON CONFLICT(source_hash) DO UPDATE SET
      window_started_at = CASE
        WHEN matchday_request_rate_limits.window_started_at <= clock_timestamp() - (${NEXT_MATCH_RATE_LIMIT_WINDOW_SECONDS} * interval '1 second')
          THEN clock_timestamp()
        ELSE matchday_request_rate_limits.window_started_at
      END,
      request_count = CASE
        WHEN matchday_request_rate_limits.window_started_at <= clock_timestamp() - (${NEXT_MATCH_RATE_LIMIT_WINDOW_SECONDS} * interval '1 second')
          THEN 1
        ELSE matchday_request_rate_limits.request_count + 1
      END
    RETURNING request_count,
      GREATEST(0, CEIL(EXTRACT(EPOCH FROM (window_started_at + (${NEXT_MATCH_RATE_LIMIT_WINDOW_SECONDS} * interval '1 second') - clock_timestamp()))))::int AS retry_after
  `;
  return {
    allowed: Number(result?.request_count) <= NEXT_MATCH_RATE_LIMIT_MAX,
    retryAfter: Math.max(1, Number(result?.retry_after) || NEXT_MATCH_RATE_LIMIT_WINDOW_SECONDS),
  };
};

