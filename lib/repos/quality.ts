import { and, avg, count, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { generatedContent } from "@/db/schema";

export type QualityReport = {
  verdictCounts: { pass: number; review: number; block: number; pending: number };
  statusCounts: { pending: number; held: number; approved: number; rejected: number };
  avgScore: number | null;
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

  const [
    passRows,
    reviewRows,
    blockRows,
    pendingVerdictRows,
    pendingStatusRows,
    heldRows,
    approvedRows,
    rejectedRows,
    avgRows,
    flagged,
  ] = await Promise.all([
    // Verdict counts
    db
      .select({ n: count() })
      .from(generatedContent)
      .where(and(userWhere, eq(generatedContent.reviewVerdict, "pass"))),
    db
      .select({ n: count() })
      .from(generatedContent)
      .where(and(userWhere, eq(generatedContent.reviewVerdict, "review"))),
    db
      .select({ n: count() })
      .from(generatedContent)
      .where(and(userWhere, eq(generatedContent.reviewVerdict, "block"))),
    db
      .select({ n: count() })
      .from(generatedContent)
      .where(and(userWhere, isNull(generatedContent.reviewVerdict))),

    // Status counts
    db
      .select({ n: count() })
      .from(generatedContent)
      .where(and(userWhere, eq(generatedContent.reviewStatus, "pending"))),
    db
      .select({ n: count() })
      .from(generatedContent)
      .where(and(userWhere, eq(generatedContent.reviewStatus, "held"))),
    db
      .select({ n: count() })
      .from(generatedContent)
      .where(and(userWhere, eq(generatedContent.reviewStatus, "approved"))),
    db
      .select({ n: count() })
      .from(generatedContent)
      .where(and(userWhere, eq(generatedContent.reviewStatus, "rejected"))),

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
  ]);

  const rawAvg = avgRows[0]?.avg;
  const avgScore = rawAvg != null ? Number(rawAvg) : null;

  return {
    verdictCounts: {
      pass: passRows[0]?.n ?? 0,
      review: reviewRows[0]?.n ?? 0,
      block: blockRows[0]?.n ?? 0,
      pending: pendingVerdictRows[0]?.n ?? 0,
    },
    statusCounts: {
      pending: pendingStatusRows[0]?.n ?? 0,
      held: heldRows[0]?.n ?? 0,
      approved: approvedRows[0]?.n ?? 0,
      rejected: rejectedRows[0]?.n ?? 0,
    },
    avgScore,
    flagged,
  };
}
