import type { Platform, ReportData } from "@/db/schema";
import type { PlanSlot } from "@/db/schema/content-plans";

export type MensaInput = {
  /** Platforms to include in the plan (from connected accounts). */
  platforms: Platform[];
  /** How many calendar days to cover. Defaults to 14. */
  days?: number;
  /** Maximum slots to generate (tier cap enforced by caller). */
  maxSlots?: number;
  /** Start of the planning window (defaults to "now" if not provided). */
  periodStartIso?: string;
};

export type MensaDeps = {
  getLatestReport: (clerkUserId: string) => Promise<{ data: ReportData } | null>;
  getLearnedMemory: (clerkUserId: string) => Promise<Record<string, unknown> | null>;
};

export type MensaOutput = {
  slots: PlanSlot[];
  periodStart: string;
  periodEnd: string;
  topicsSource: "report" | "fallback";
};

const FALLBACK_TOPICS = [
  "Industry trends and what they mean for our audience",
  "Behind-the-scenes look at our process",
  "Tips and best practices from our experience",
  "Common mistakes and how to avoid them",
  "Success stories and lessons learned",
];

/** UTC hour at which to propose posts (9am is a safe cross-timezone default). */
const PROPOSED_HOUR_UTC = 9;

/** Days between posts (sustainable cadence: every 2 days per platform). */
const CADENCE_DAYS = 2;

/**
 * Mensa — Cadence Architect. Pure function: reads report data + learned
 * memory to produce a time-distributed content plan with no LLM calls.
 * The LLM work happens later, per-slot, in the Lyra→Castor→Atlas pipeline.
 */
export function createMensa(deps: MensaDeps) {
  return {
    async generatePlan(
      clerkUserId: string,
      input: MensaInput,
    ): Promise<MensaOutput> {
      const {
        platforms,
        days = 14,
        maxSlots = 14,
        periodStartIso,
      } = input;

      if (platforms.length === 0) {
        throw new Error("At least one platform is required to generate a plan.");
      }

      const periodStart = periodStartIso ? new Date(periodStartIso) : new Date();
      // Snap to next 9am UTC so the first slot is never in the past.
      periodStart.setUTCHours(PROPOSED_HOUR_UTC, 0, 0, 0);
      if (periodStart < new Date()) {
        periodStart.setUTCDate(periodStart.getUTCDate() + 1);
      }

      const periodEnd = new Date(periodStart);
      periodEnd.setUTCDate(periodEnd.getUTCDate() + days);

      // Source topics from the last report's top performers, else fallbacks.
      const report = await deps.getLatestReport(clerkUserId);
      const learnedRaw = await deps.getLearnedMemory(clerkUserId);
      const learnedTopics =
        Array.isArray((learnedRaw as Record<string, unknown> | null)?.topTopics)
          ? ((learnedRaw as { topTopics: Array<{ topic: string }> }).topTopics.map((t) => t.topic))
          : [];

      const reportTopics = (report?.data.topTopics ?? [])
        .filter((t) => t.engagement > 0)
        .map((t) => t.topic);

      const topics =
        reportTopics.length >= 2
          ? reportTopics
          : learnedTopics.length >= 2
          ? learnedTopics
          : FALLBACK_TOPICS;

      const topicsSource: MensaOutput["topicsSource"] =
        reportTopics.length >= 2 || learnedTopics.length >= 2
          ? "report"
          : "fallback";

      // Distribute slots: iterate days, assign a platform + topic round-robin.
      const slots: PlanSlot[] = [];
      let dayOffset = 0;
      let topicIdx = 0;
      let platformIdx = 0;

      while (
        slots.length < maxSlots &&
        dayOffset < days
      ) {
        const proposedAt = new Date(periodStart);
        proposedAt.setUTCDate(proposedAt.getUTCDate() + dayOffset);

        slots.push({
          topic: topics[topicIdx % topics.length],
          platform: platforms[platformIdx % platforms.length],
          proposedAt: proposedAt.toISOString(),
        });

        topicIdx += 1;
        platformIdx += 1;
        dayOffset += CADENCE_DAYS;
      }

      return {
        slots,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        topicsSource,
      };
    },
  };
}
