import { and, count, eq, gte } from "drizzle-orm";

import { db } from "@/db";
import { agentRuns, generatedContent, postTargets, posts } from "@/db/schema";

import type { PublishedTargetRow, RunRow } from "./aggregate";

/**
 * Read-only aggregation queries over the existing tables. The aggregation/
 * shaping logic lives in ./aggregate (pure + unit-tested); these are the thin DB
 * reads that feed it. All are parameterized by clerkUserId + a `since` cutoff.
 */

/** Published targets in the window, with their source topic + engagement metrics. */
export async function fetchPublishedTargets(
  clerkUserId: string,
  since: Date,
): Promise<PublishedTargetRow[]> {
  return db
    .select({ topic: generatedContent.topic, metrics: postTargets.metrics })
    .from(postTargets)
    .innerJoin(posts, eq(postTargets.postId, posts.id))
    .leftJoin(generatedContent, eq(posts.sourceContentId, generatedContent.id))
    .where(
      and(
        eq(posts.clerkUserId, clerkUserId),
        eq(postTargets.status, "published"),
        gte(postTargets.publishedAt, since),
      ),
    );
}

/** Pipeline-run outcomes in the window (for the success-rate signal). */
export async function fetchRunOutcomes(
  clerkUserId: string,
  since: Date,
): Promise<RunRow[]> {
  return db
    .select({ status: agentRuns.status })
    .from(agentRuns)
    .where(
      and(eq(agentRuns.clerkUserId, clerkUserId), gte(agentRuns.createdAt, since)),
    );
}

/** Count of failed publish targets in the window. */
export async function countFailedPublishes(
  clerkUserId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(postTargets)
    .innerJoin(posts, eq(postTargets.postId, posts.id))
    .where(
      and(
        eq(posts.clerkUserId, clerkUserId),
        eq(postTargets.status, "failed"),
        gte(postTargets.updatedAt, since),
      ),
    );
  return row?.n ?? 0;
}

/** Users with pipeline activity in the window — who to compile a report for. */
export async function listReportUserIds(since: Date): Promise<string[]> {
  const rows = await db
    .selectDistinct({ clerkUserId: agentRuns.clerkUserId })
    .from(agentRuns)
    .where(gte(agentRuns.createdAt, since));
  return rows.map((r) => r.clerkUserId);
}
