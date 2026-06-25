import type { Job } from "bullmq";

import type { Platform } from "@/db/schema";
import { scoreWindows, type PostSample } from "@/lib/scheduling/best-time";
import type { PostingWindowsRefreshJobData } from "@/lib/queue/jobs";
import { listSocialAccounts } from "@/lib/repos/accounts";
import { listPublishedTargetsWithMetrics } from "@/lib/repos/posts";
import { upsertPostingWindows } from "@/lib/repos/posting-windows";
import { logger } from "../logger";

/**
 * Chronos — posting-window refresh processor. Reads a tenant's published
 * post_targets (with metrics) per platform, scores (dayOfWeek, hourOfDay) slots
 * by average engagement, and upserts the results into posting_windows for use
 * by the composer "Recommend a time" affordance and Atlas auto-scheduling.
 */
export async function postingWindowsRefreshProcessor(job: Job): Promise<void> {
  const { clerkUserId } = job.data as PostingWindowsRefreshJobData;

  const accounts = await listSocialAccounts(clerkUserId);
  const platforms = [...new Set(accounts.map((a) => a.platform))] as Platform[];

  let totalSlotsRefreshed = 0;

  for (const platform of platforms) {
    try {
      const targets = await listPublishedTargetsWithMetrics(clerkUserId, platform);

      const samples: PostSample[] = targets
        .filter((t) => t.publishedAt !== null)
        .map((t) => {
          const engagementSum = t.metrics
            ? Object.values(t.metrics).reduce(
                (acc, v) => acc + (typeof v === "number" && isFinite(v) ? v : 0),
                0,
              )
            : 0;
          return { publishedAt: t.publishedAt as Date, engagement: engagementSum };
        });

      const windows = scoreWindows(samples);
      await upsertPostingWindows(clerkUserId, platform, windows);
      totalSlotsRefreshed += windows.length;
    } catch (error) {
      logger.warn("posting-windows: refresh failed for platform", {
        clerkUserId,
        platform,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("posting-windows: refresh complete", {
    clerkUserId,
    platforms: platforms.length,
    totalSlotsRefreshed,
  });
}
