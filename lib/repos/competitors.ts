import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  competitorWatches,
  type CompetitorWatch,
  type NewCompetitorWatch,
} from "@/db/schema";

export async function listCompetitorWatches(
  clerkUserId: string,
): Promise<CompetitorWatch[]> {
  return db
    .select()
    .from(competitorWatches)
    .where(eq(competitorWatches.clerkUserId, clerkUserId))
    .orderBy(desc(competitorWatches.createdAt));
}

export async function createCompetitorWatch(
  data: NewCompetitorWatch,
): Promise<CompetitorWatch> {
  const [row] = await db.insert(competitorWatches).values(data).returning();
  return row;
}
