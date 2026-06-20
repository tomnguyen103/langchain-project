import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { usage } from "@/db/schema";

export async function getUsageCount(
  clerkUserId: string,
  metric: string,
  periodStart: string,
): Promise<number> {
  const [row] = await db
    .select({ count: usage.count })
    .from(usage)
    .where(
      and(
        eq(usage.clerkUserId, clerkUserId),
        eq(usage.metric, metric),
        eq(usage.periodStart, periodStart),
      ),
    )
    .limit(1);
  return row?.count ?? 0;
}

/** Atomically increment a usage counter for the period. */
export async function incrementUsage(
  clerkUserId: string,
  metric: string,
  periodStart: string,
  by = 1,
): Promise<void> {
  await db
    .insert(usage)
    .values({ clerkUserId, metric, periodStart, count: by })
    .onConflictDoUpdate({
      target: [usage.clerkUserId, usage.metric, usage.periodStart],
      set: { count: sql`${usage.count} + ${by}`, updatedAt: new Date() },
    });
}
