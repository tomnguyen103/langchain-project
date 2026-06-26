import { and, asc, desc, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  researchWatchRuns,
  researchWatches,
  type NewResearchWatch,
  type NewResearchWatchRun,
  type ResearchWatch,
  type ResearchWatchRun,
} from "@/db/schema";

export async function listResearchWatches(
  clerkUserId: string,
): Promise<ResearchWatch[]> {
  return db
    .select()
    .from(researchWatches)
    .where(eq(researchWatches.clerkUserId, clerkUserId))
    .orderBy(desc(researchWatches.createdAt));
}

export async function getUserResearchWatch(
  id: string,
  clerkUserId: string,
): Promise<ResearchWatch | undefined> {
  const [row] = await db
    .select()
    .from(researchWatches)
    .where(
      and(eq(researchWatches.id, id), eq(researchWatches.clerkUserId, clerkUserId)),
    )
    .limit(1);
  return row;
}

export async function createResearchWatch(
  data: NewResearchWatch,
): Promise<ResearchWatch> {
  const [row] = await db.insert(researchWatches).values(data).returning();
  return row;
}

export async function updateResearchWatch(
  id: string,
  clerkUserId: string,
  data: Partial<NewResearchWatch>,
): Promise<void> {
  await db
    .update(researchWatches)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(eq(researchWatches.id, id), eq(researchWatches.clerkUserId, clerkUserId)),
    );
}

export async function deleteResearchWatch(
  id: string,
  clerkUserId: string,
): Promise<void> {
  await db
    .delete(researchWatches)
    .where(
      and(eq(researchWatches.id, id), eq(researchWatches.clerkUserId, clerkUserId)),
    );
}

/** Worker-only due sweep. User-facing code must use the scoped functions above. */
export async function listDueResearchWatches(
  now = new Date(),
  limit = 100,
): Promise<ResearchWatch[]> {
  return db
    .select()
    .from(researchWatches)
    .where(
      and(
        eq(researchWatches.status, "active"),
        lte(researchWatches.nextRunAt, now),
      ),
    )
    .orderBy(asc(researchWatches.nextRunAt))
    .limit(limit);
}

export async function claimResearchWatchRun(
  data: NewResearchWatchRun,
): Promise<ResearchWatchRun> {
  const [inserted] = await db
    .insert(researchWatchRuns)
    .values(data)
    .onConflictDoNothing({
      target: [researchWatchRuns.researchWatchId, researchWatchRuns.periodKey],
    })
    .returning();
  if (inserted) return inserted;

  const [existing] = await db
    .select()
    .from(researchWatchRuns)
    .where(
      and(
        eq(researchWatchRuns.researchWatchId, data.researchWatchId),
        eq(researchWatchRuns.periodKey, data.periodKey),
      ),
    )
    .limit(1);
  if (!existing) {
    throw new Error("Could not claim research watch run.");
  }
  return existing;
}

export async function updateResearchWatchRun(
  id: string,
  data: Partial<NewResearchWatchRun>,
): Promise<void> {
  await db
    .update(researchWatchRuns)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(researchWatchRuns.id, id));
}
