import type { Job } from "bullmq";

import { isMetricsRefreshDue, toMetricsRecord } from "@/lib/metrics/poll";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import type { MetricsPollJobData } from "@/lib/queue/jobs";
import { getSocialAccount } from "@/lib/repos/accounts";
import {
  listPublishedTargetsForAccount,
  updatePostTarget,
} from "@/lib/repos/posts";
import { logger } from "../logger";

/**
 * Poll one account's recently-published targets for engagement metrics and
 * persist them to `post_targets.metrics`. The maturity curve (isMetricsRefreshDue)
 * decides which targets are due, so this fixed-cadence scheduler only bounds the
 * *check* frequency — a fresh post refreshes hourly, an old one daily, and a post
 * past the tracking window stops entirely.
 *
 * Mirrors comment-poll's per-account, idempotent, best-effort design: a failed
 * fetch is non-fatal (logged and skipped) and retried on the next poll. Closes
 * the analytics loop the dashboard + Rigel already read from.
 */
export async function metricsPollProcessor(job: Job): Promise<void> {
  const { socialAccountId } = job.data as MetricsPollJobData;

  const account = await getSocialAccount(socialAccountId);
  if (!account || account.status !== "active") return;
  if (!hasConnector(account.platform)) return;

  const connector = getConnector(account.platform);
  if (!connector.capabilities.supportsMetrics) return;

  const targets = await listPublishedTargetsForAccount(account.id);
  const now = new Date();
  let updated = 0;

  for (const target of targets) {
    if (!target.externalPostId) continue;
    if (!isMetricsRefreshDue(target, now)) continue;

    try {
      const metrics = await connector.fetchMetrics(
        account,
        target.externalPostId,
      );
      await updatePostTarget(target.id, {
        metrics: toMetricsRecord(metrics),
        metricsUpdatedAt: new Date(),
      });
      updated += 1;
    } catch (error) {
      logger.warn("metrics-poll: fetch failed", {
        socialAccountId,
        externalPostId: target.externalPostId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Non-fatal: skip this target; the next poll retries it.
    }
  }

  if (updated > 0) {
    logger.info("metrics-poll: processed", {
      socialAccountId,
      platform: account.platform,
      updated,
    });
  }
}
