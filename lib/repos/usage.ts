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

/**
 * Atomically consume one unit of quota. Increments only when still under
 * `limit`, in a single statement — so concurrent requests can't both pass.
 * Returns false when already at/over the limit.
 */
export async function consumeUsage(
  clerkUserId: string,
  metric: string,
  periodStart: string,
  limit: number,
): Promise<boolean> {
  if (limit <= 0) return false;
  const rows = await db
    .insert(usage)
    .values({ clerkUserId, metric, periodStart, count: 1 })
    .onConflictDoUpdate({
      target: [usage.clerkUserId, usage.metric, usage.periodStart],
      set: { count: sql`${usage.count} + 1`, updatedAt: new Date() },
      setWhere: sql`${usage.count} < ${limit}`,
    })
    .returning({ count: usage.count });
  return rows.length > 0;
}
