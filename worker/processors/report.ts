import type { Job } from "bullmq";

import { getAgent } from "@/lib/agents/registry";
import { listReportUserIds } from "@/lib/agents/rigel/queries";
import { AgentName } from "@/lib/agents/types";
import { logger } from "../logger";

const REPORT_PERIOD = "7d";
const PERIOD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Scheduled reporting: compile a Rigel report for every user with pipeline
 * activity in the window. Rigel is run directly (not via the agent-step queue —
 * a report isn't part of a content run). One failing user never blocks others.
 */
export async function reportProcessor(_job: Job): Promise<void> {
  const since = new Date(Date.now() - PERIOD_DAYS * DAY_MS);
  const userIds = await listReportUserIds(since);
  if (userIds.length === 0) return;

  const rigel = getAgent(AgentName.Rigel);
  let ok = 0;
  for (const clerkUserId of userIds) {
    try {
      await rigel.run(
        { period: REPORT_PERIOD },
        { clerkUserId, runId: `report_${clerkUserId}` },
      );
      ok += 1;
    } catch (error) {
      logger.error("report: failed for user", {
        clerkUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  logger.info("report: compiled", { users: userIds.length, ok });
}
