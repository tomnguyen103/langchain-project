import type { Job } from "bullmq";

import { getConnector, hasConnector } from "@/lib/platforms/registry";
import { seedGroupPosts } from "@/lib/platforms/seeding";
import type { SeedingJobData } from "@/lib/queue/jobs";
import { getSocialAccount } from "@/lib/repos/accounts";
import { logger } from "../logger";

const SEED_WINDOW_MS = 60 * 60_000; // consider group posts from the last hour
const MAX_SEED_INTERACTIONS = 3; // conservative per-run cap (anti-spam)

/**
 * Polaris's per-account seeding tick: for a seeding-capable account that has a
 * configured interaction (metadata.seedComment), fetch recent group posts and
 * interact within a hard rate cap. Non-capable platforms / unconfigured accounts
 * are cleanly skipped — no errors.
 */
export async function seedingProcessor(job: Job): Promise<void> {
  const { socialAccountId } = job.data as SeedingJobData;

  const account = await getSocialAccount(socialAccountId);
  if (!account || account.status !== "active") return;
  if (!hasConnector(account.platform)) return;

  const connector = getConnector(account.platform);
  if (!connector.capabilities.supportsSeeding) return;

  // Only interact when the user has configured what to say — keeps seeding
  // opt-in and avoids posting anything generic/spammy by default.
  const meta = (account.metadata ?? {}) as { seedComment?: unknown };
  const comment =
    typeof meta.seedComment === "string" ? meta.seedComment.trim() : "";
  if (!comment) return;

  const count = await seedGroupPosts(connector, account, {
    since: new Date(Date.now() - SEED_WINDOW_MS),
    maxInteractions: MAX_SEED_INTERACTIONS,
    comment,
  });

  if (count > 0) {
    logger.info("seeding: interacted", {
      socialAccountId,
      platform: account.platform,
      count,
    });
  }
}
