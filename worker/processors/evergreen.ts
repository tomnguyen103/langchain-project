import type { Job } from "bullmq";

import { AgentName } from "@/lib/agents/types";
import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import {
  buildRunBudget,
  estimateAgentRunCostUsd,
} from "@/lib/billing/agent-budget";
import {
  nextEvergreenRunAt,
  selectEvergreenSource,
} from "@/lib/evergreen/automation";
import { env } from "@/lib/env";
import { PLATFORM_META } from "@/lib/platforms/constants";
import {
  listDueEvergreenPreferences,
  updateEvergreenPreference,
} from "@/lib/repos/evergreen";
import { listRecyclableWinners } from "@/lib/repos/posts";
import { logger } from "../logger";

export async function evergreenProcessor(job: Job): Promise<void> {
  const now = new Date();
  const due = await listDueEvergreenPreferences(now);
  let started = 0;
  let skipped = 0;
  let failed = 0;

  for (const pref of due) {
    const winners = await listRecyclableWinners(pref.clerkUserId, 10);
    const source = selectEvergreenSource(winners, {
      minEngagement: pref.minEngagement,
      platforms: pref.platforms,
      lastSourceTargetId: pref.lastSourceTargetId,
    });
    const nextRunAt = nextEvergreenRunAt(pref.frequency, now);

    if (!source) {
      await updateEvergreenPreference(pref.clerkUserId, { nextRunAt });
      skipped += 1;
      continue;
    }

    const estimate = estimateAgentRunCostUsd({
      platformCount: 1,
      provider: env.LLM_PROVIDER,
    });
    const platformLabel = PLATFORM_META[source.platform]?.label ?? source.platform;
    const topic = `Re-angle and refresh for ${platformLabel}. Do not duplicate - find a new hook or angle. Original post:\n\n${source.body}`;

    try {
      await orchestrator.startRun({
        clerkUserId: pref.clerkUserId,
        plan: {
          niche: topic,
          platforms: [source.platform],
          recycledFromTargetId: source.targetId,
          evergreenPreferenceId: pref.id,
          budget: buildRunBudget({ estimate }),
        },
        firstStep: {
          agent: AgentName.Lyra,
          payload: {
            topic,
            platforms: [source.platform],
            derivedFromTargetId: source.targetId,
          },
        },
      });
      await updateEvergreenPreference(pref.clerkUserId, {
        lastRunAt: now,
        nextRunAt,
        lastSourceTargetId: source.targetId,
      });
      started += 1;
    } catch (error) {
      failed += 1;
      logger.error("evergreen: failed to start refresh run", {
        preferenceId: pref.id,
        clerkUserId: pref.clerkUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("evergreen: sweep complete", {
    jobId: job.id,
    due: due.length,
    started,
    skipped,
    failed,
  });

  if (failed > 0) {
    throw new Error(`Failed to start ${failed} evergreen refresh run(s).`);
  }
}
