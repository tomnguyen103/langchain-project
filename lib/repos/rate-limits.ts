import { sql } from "drizzle-orm";

import { db } from "@/db";
import { rateLimits } from "@/db/schema";

/**
 * Atomically take one slot in a fixed window. Returns true if within `limit`,
 * false if the window is exhausted. The conditional upsert (`setWhere count <
 * limit`) serializes concurrent requests for the same bucket so two can't both
 * take the last slot — same technique as consumeUsage.
 */
export async function takeRateLimit(
  bucket: string,
  windowStart: Date,
  limit: number,
): Promise<boolean> {
  const rows = await db
    .insert(rateLimits)
    .values({ bucket, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.bucket, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1`, updatedAt: new Date() },
      setWhere: sql`${rateLimits.count} < ${limit}`,
    })
    .returning({ count: rateLimits.count });
  return rows.length > 0;
}
