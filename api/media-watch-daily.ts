import { runDailyMediaWatch } from "../lib/media-watch-pipeline";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=UTF-8",
    "Cache-Control": "private, no-store",
  },
});

export const isMediaWatchCronAuthorized = (request: Request, secret = process.env.CRON_SECRET?.trim()) =>
  Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);

export async function GET(request: Request) {
  if (!isMediaWatchCronAuthorized(request)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }
  try {
    const result = await runDailyMediaWatch();
    const ok = result.crawl.status !== "failed";
    return json({ ok, ...result }, ok ? 200 : 503);
  } catch (error) {
    console.error("Dagelijkse Media Watch-run mislukt", error);
    return json({ ok: false, error: "Media Watch-run mislukt" }, 503);
  }
}
