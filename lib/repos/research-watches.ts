import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  researchWatches,
  type NewResearchWatch,
  type ResearchWatch,
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
