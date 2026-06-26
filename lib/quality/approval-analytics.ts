export type ApprovalAnalyticsRow = {
  reviewStatus: string;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewViolations:
    | Array<{ rule: string; detail: string; level?: "warn" | "block" }>
    | null;
};

export type ReviewerSlaSummary = {
  reviewer: string;
  reviewed: number;
  avgHours: number | null;
  withinSla: number;
  breached: number;
};

export type ApprovalAnalytics = {
  slaHours: number;
  reviewed: number;
  avgReviewHours: number | null;
  withinSla: number;
  breached: number;
  openBreaches: number;
  reviewers: ReviewerSlaSummary[];
  topFindings: Array<{ rule: string; count: number }>;
};

const HOUR_MS = 60 * 60_000;

export function summarizeApprovalAnalytics(
  rows: ApprovalAnalyticsRow[],
  now = new Date(),
  slaHours = 24,
): ApprovalAnalytics {
  const slaMs = slaHours * HOUR_MS;
  const reviewerStats = new Map<
    string,
    { durations: number[]; withinSla: number; breached: number }
  >();
  const findingCounts = new Map<string, number>();
  const durations: number[] = [];
  let withinSla = 0;
  let breached = 0;
  let openBreaches = 0;

  for (const row of rows) {
    for (const finding of row.reviewViolations ?? []) {
      findingCounts.set(finding.rule, (findingCounts.get(finding.rule) ?? 0) + 1);
    }

    if (!row.reviewedAt) {
      if (
        row.reviewStatus === "held" &&
        now.getTime() - row.createdAt.getTime() > slaMs
      ) {
        openBreaches += 1;
      }
      continue;
    }

    const duration = Math.max(0, row.reviewedAt.getTime() - row.createdAt.getTime());
    durations.push(duration);
    const reviewer = row.reviewedBy?.trim() || "unassigned";
    const stat = reviewerStats.get(reviewer) ?? {
      durations: [],
      withinSla: 0,
      breached: 0,
    };
    stat.durations.push(duration);
    if (duration <= slaMs) {
      withinSla += 1;
      stat.withinSla += 1;
    } else {
      breached += 1;
      stat.breached += 1;
    }
    reviewerStats.set(reviewer, stat);
  }

  return {
    slaHours,
    reviewed: durations.length,
    avgReviewHours: averageHours(durations),
    withinSla,
    breached,
    openBreaches,
    reviewers: [...reviewerStats.entries()]
      .map(([reviewer, stat]) => ({
        reviewer,
        reviewed: stat.durations.length,
        avgHours: averageHours(stat.durations),
        withinSla: stat.withinSla,
        breached: stat.breached,
      }))
      .sort((a, b) => b.reviewed - a.reviewed || a.reviewer.localeCompare(b.reviewer)),
    topFindings: [...findingCounts.entries()]
      .map(([rule, count]) => ({ rule, count }))
      .sort((a, b) => b.count - a.count || a.rule.localeCompare(b.rule))
      .slice(0, 8),
  };
}

function averageHours(durationsMs: number[]): number | null {
  if (durationsMs.length === 0) return null;
  const avgMs =
    durationsMs.reduce((sum, duration) => sum + duration, 0) / durationsMs.length;
  return Number((avgMs / HOUR_MS).toFixed(1));
}
