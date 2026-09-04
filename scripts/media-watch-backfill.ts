import { runMediaWatchBackfill, MEDIA_WATCH_BACKFILL_FROM } from "../lib/media-watch-pipeline";
import { runMediaWatchSourceOnly } from "../lib/media-watch-crawl";

const args = process.argv.slice(2);
const sourceOnly = args.includes("--source-only");
const execute = args.includes("--execute");

const main = async () => {
  if (sourceOnly) {
    const result = await runMediaWatchSourceOnly({ from: MEDIA_WATCH_BACKFILL_FROM });
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "succeeded") process.exitCode = 1;
    return;
  }
  const result = await runMediaWatchBackfill({ dryRun: !execute });
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", ...result }, null, 2));
  if (result.crawl.status === "failed" || result.crawl.errorCount > 0) {
    process.exitCode = 1;
  }
};

main().catch(error => {
  console.error("Media Watch-backfill mislukt", error);
  process.exitCode = 1;
});
