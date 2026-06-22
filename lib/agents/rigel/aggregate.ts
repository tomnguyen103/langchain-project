import type { ReportData, ReportTopic } from "@/db/schema";

/** A published target as Rigel reads it (topic from its source content + metrics). */
export type PublishedTargetRow = {
  topic: string | null;
  metrics: Record<string, number> | null;
};

/** A run outcome as Rigel reads it. */
export type RunRow = { status: string };

/** Total engagement for a target = the sum of its numeric metric values. */
function sumMetrics(metrics: Record<string, number> | null): number {
  if (!metrics) return 0;
  return Object.values(metrics).reduce(
    (sum, n) => sum + (typeof n === "number" && Number.isFinite(n) ? n : 0),
    0,
  );
}

/** Topics ranked by published count, then engagement (pure — unit-tested). */
export function topTopics(
  rows: PublishedTargetRow[],
  limit = 5,
): ReportTopic[] {
  const byTopic = new Map<string, { published: number; engagement: number }>();
  for (const row of rows) {
    const topic = row.topic?.trim() || "(untitled)";
    const entry = byTopic.get(topic) ?? { published: 0, engagement: 0 };
    entry.published += 1;
    entry.engagement += sumMetrics(row.metrics);
    byTopic.set(topic, entry);
  }
  return [...byTopic.entries()]
    .map(([topic, v]) => ({ topic, ...v }))
    .sort((a, b) => b.published - a.published || b.engagement - a.engagement)
    .slice(0, limit);
}

/** Fraction of runs that completed successfully (0 when there are none). */
export function runSuccessRate(runs: RunRow[]): number {
  if (runs.length === 0) return 0;
  const completed = runs.filter((r) => r.status === "completed").length;
  return completed / runs.length;
}

/** Assemble the full report from its already-fetched parts (pure). */
export function buildReport(params: {
  period: string;
  publishedTargets: PublishedTargetRow[];
  runs: RunRow[];
  failedPublishCount: number;
}): ReportData {
  return {
    period: params.period,
    totalPublished: params.publishedTargets.length,
    topTopics: topTopics(params.publishedTargets),
    runSuccessRate: runSuccessRate(params.runs),
    failedPublishCount: params.failedPublishCount,
  };
}
