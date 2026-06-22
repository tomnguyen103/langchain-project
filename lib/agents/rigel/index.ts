import type { ReportData } from "@/db/schema";

import { AgentName, type AgentDefinition } from "../types";
import {
  buildReport,
  type PublishedTargetRow,
  type RunRow,
} from "./aggregate";

export type RigelInput = { period?: string };

/** Rigel's reads/writes, injected so the wrapper unit-tests without a db/env. */
export type RigelDeps = {
  fetchPublishedTargets: (
    clerkUserId: string,
    since: Date,
  ) => Promise<PublishedTargetRow[]>;
  fetchRunOutcomes: (clerkUserId: string, since: Date) => Promise<RunRow[]>;
  countFailedPublishes: (clerkUserId: string, since: Date) => Promise<number>;
  saveReport: (
    clerkUserId: string,
    period: string,
    data: ReportData,
  ) => Promise<unknown>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a period like "7d" / "30d" into a day count (default 7). */
function periodDays(period: string): number {
  const match = /^(\d+)d$/.exec(period.trim());
  return match ? Math.max(1, Number(match[1])) : 7;
}

/**
 * Rigel — reporting / insights. Compiles a structured report (top topics by
 * published count + engagement, run success rate, failed-publish count) from the
 * existing tables and persists it for the dashboard + Orion's feed-forward.
 * Read-only over the source tables; terminal (no handoff).
 */
export function createRigel(deps: RigelDeps): AgentDefinition<RigelInput> {
  return {
    name: AgentName.Rigel,
    async run(input, ctx) {
      // Normalize the period to its parsed window so the persisted metadata
      // always matches the range actually used (a malformed value → 7 days).
      const days = periodDays(input.period ?? "7d");
      const period = `${days}d`;
      const since = new Date(Date.now() - days * DAY_MS);

      const [publishedTargets, runs, failedPublishCount] = await Promise.all([
        deps.fetchPublishedTargets(ctx.clerkUserId, since),
        deps.fetchRunOutcomes(ctx.clerkUserId, since),
        deps.countFailedPublishes(ctx.clerkUserId, since),
      ]);

      const report = buildReport({
        period,
        publishedTargets,
        runs,
        failedPublishCount,
      });
      await deps.saveReport(ctx.clerkUserId, period, report);

      return {
        summary: {
          totalPublished: report.totalPublished,
          runSuccessRate: report.runSuccessRate,
          failedPublishCount: report.failedPublishCount,
          topTopics: report.topTopics.length,
        },
      };
    },
  };
}
