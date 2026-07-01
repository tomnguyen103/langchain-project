import { and, avg, count, desc, eq, inArray, isNotNull, or } from "drizzle-orm";

import { db } from "@/db";
import { generatedContent } from "@/db/schema";
import {
  summarizeApprovalAnalytics,
  type ApprovalAnalytics,
} from "@/lib/quality/approval-analytics";

export type QualityReport = {
  verdictCounts: { pass: number; review: number; block: number; pending: number };
  statusCounts: { pending: number; held: number; approved: number; rejected: number };
  avgScore: number | null;
  approvalAnalytics: ApprovalAnalytics;
  flagged: Array<{
    id: string;
    topic: string | null;
    platform: string | null;
    brandSafetyScore: number | null;
    reviewVerdict: string | null;
    reviewStatus: string;
    createdAt: Date;
  }>;
};

export async function getQualityReport(clerkUserId: string): Promise<QualityReport> {
  const userWhere = eq(generatedContent.clerkUserId, clerkUserId);

  const [verdictGroups, statusGroups, avgRows, flagged, analyticsRows] = await Promise.all([
    // Verdict counts, one grouped query instead of four (null = not yet judged).
    db
      .select({ reviewVerdict: generatedContent.reviewVerdict, n: count() })
      .from(generatedContent)
      .where(userWhere)
      .groupBy(generatedContent.reviewVerdict),

    // Status counts, one grouped query instead of four.
    db
      .select({ reviewStatus: generatedContent.reviewStatus, n: count() })
      .from(generatedContent)
      .where(userWhere)
      .groupBy(generatedContent.reviewStatus),

    // Average brand safety score
    db
      .select({ avg: avg(generatedContent.brandSafetyScore) })
      .from(generatedContent)
      .where(and(userWhere, isNotNull(generatedContent.brandSafetyScore))),

    // Recent flagged content
    db
      .select({
        id: generatedContent.id,
        topic: generatedContent.topic,
        platform: generatedContent.platform,
        brandSafetyScore: generatedContent.brandSafetyScore,
        reviewVerdict: generatedContent.reviewVerdict,
        reviewStatus: generatedContent.reviewStatus,
        createdAt: generatedContent.createdAt,
      })
      .from(generatedContent)
      .where(
        and(
          userWhere,
          or(
            inArray(generatedContent.reviewVerdict, ["review", "block"]),
            eq(generatedContent.reviewStatus, "held"),
          ),
        ),
      )
      .orderBy(desc(generatedContent.createdAt))
      .limit(20),

    db
      .select({
        reviewStatus: generatedContent.reviewStatus,
        createdAt: generatedContent.createdAt,
        reviewedAt: generatedContent.reviewedAt,
        reviewedBy: generatedContent.reviewedBy,
        reviewViolations: generatedContent.reviewViolations,
      })
      .from(generatedContent)
      .where(
        and(
          userWhere,
          or(
            isNotNull(generatedContent.reviewedAt),
            eq(generatedContent.reviewStatus, "held"),
          ),
        ),
      )
      .orderBy(desc(generatedContent.createdAt))
      .limit(500),
  ]);

  const rawAvg = avgRows[0]?.avg;
  const avgScore = rawAvg != null ? Number(rawAvg) : null;

  const verdictCounts = { pass: 0, review: 0, block: 0, pending: 0 };
  for (const row of verdictGroups) {
    // A null verdict means "not yet judged" — reported as pending, matching
    // the original per-verdict query's isNull(reviewVerdict) branch.
    switch (row.reviewVerdict) {
      case "pass":
        verdictCounts.pass = row.n;
        break;
      case "review":
        verdictCounts.review = row.n;
        break;
      case "block":
        verdictCounts.block = row.n;
        break;
      default:
        verdictCounts.pending += row.n;
    }
  }

  const statusCounts = { pending: 0, held: 0, approved: 0, rejected: 0 };
  for (const row of statusGroups) {
    statusCounts[row.reviewStatus] = row.n;
  }

  return {
    verdictCounts,
    statusCounts,
    avgScore,
    approvalAnalytics: summarizeApprovalAnalytics(analyticsRows),
    flagged,
  };
}
