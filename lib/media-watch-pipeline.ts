import { runMediaWatchCrawl, type CrawlResult } from "./media-watch-crawl";

export const MEDIA_WATCH_BACKFILL_FROM = new Date("2026-03-01T00:00:00+01:00");

export type MediaWatchPipelineResult = {
  crawl: CrawlResult;
};

export const runMediaWatchBackfill = async (options: {
  to?: Date;
  dryRun?: boolean;
} = {}): Promise<MediaWatchPipelineResult> => {
  const dryRun = options.dryRun ?? true;
  const crawl = await runMediaWatchCrawl({
    mode: "backfill",
    triggerKind: "manual",
    publishedFrom: MEDIA_WATCH_BACKFILL_FROM,
    publishedTo: options.to ?? new Date(),
    dryRun,
  });
  return { crawl };
};

export const runDailyMediaWatch = async (): Promise<MediaWatchPipelineResult> => {
  const crawl = await runMediaWatchCrawl({ mode: "latest", triggerKind: "scheduled" });
  return { crawl };
};
