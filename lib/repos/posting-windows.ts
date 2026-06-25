import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { postingWindows, type Platform, type PostingWindow } from "@/db/schema";
import { type WindowScore } from "@/lib/scheduling/best-time";

/** Upsert all computed windows for one tenant+platform in one batch. */
export async function upsertPostingWindows(
  clerkUserId: string,
  platform: Platform,
  windows: WindowScore[],
): Promise<void> {
  if (windows.length === 0) return;
  const now = new Date();
  await db
    .insert(postingWindows)
    .values(
      windows.map((w) => ({
        clerkUserId,
        platform,
        dayOfWeek: w.dayOfWeek,
        hourOfDay: w.hourOfDay,
        score: w.score,
        postCount: w.postCount,
        refreshedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [
        postingWindows.clerkUserId,
        postingWindows.platform,
        postingWindows.dayOfWeek,
        postingWindows.hourOfDay,
      ],
      set: {
        score: sql`excluded.score`,
        postCount: sql`excluded.post_count`,
        refreshedAt: sql`excluded.refreshed_at`,
      },
    });
}

/** Fetch windows for a user+platform sorted by score descending. */
export async function getPostingWindows(
  clerkUserId: string,
  platform: Platform,
): Promise<PostingWindow[]> {
  return db
    .select()
    .from(postingWindows)
    .where(
      and(
        eq(postingWindows.clerkUserId, clerkUserId),
        eq(postingWindows.platform, platform),
      ),
    )
    .orderBy(desc(postingWindows.score));
}
