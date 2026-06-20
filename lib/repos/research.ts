import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  researchTopics,
  type NewResearchTopic,
  type ResearchTopic,
} from "@/db/schema";

export async function createResearchTopic(
  data: NewResearchTopic,
): Promise<ResearchTopic> {
  const [row] = await db.insert(researchTopics).values(data).returning();
  return row;
}

export async function getResearchTopic(
  id: string,
): Promise<ResearchTopic | undefined> {
  const [row] = await db
    .select()
    .from(researchTopics)
    .where(eq(researchTopics.id, id))
    .limit(1);
  return row;
}

export async function updateResearchTopic(
  id: string,
  data: Partial<NewResearchTopic>,
): Promise<void> {
  await db
    .update(researchTopics)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(researchTopics.id, id));
}

export async function listResearchTopics(
  clerkUserId: string,
): Promise<ResearchTopic[]> {
  return db
    .select()
    .from(researchTopics)
    .where(eq(researchTopics.clerkUserId, clerkUserId))
    .orderBy(desc(researchTopics.createdAt));
}
