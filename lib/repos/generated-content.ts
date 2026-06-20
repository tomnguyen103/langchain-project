import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import {
  generatedContent,
  type GeneratedContent,
  type NewGeneratedContent,
} from "@/db/schema";

/** Research-backed ideas (kind=idea with a research topic). */
export async function listIdeas(
  clerkUserId: string,
): Promise<GeneratedContent[]> {
  return db
    .select()
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.clerkUserId, clerkUserId),
        eq(generatedContent.kind, "idea"),
        isNotNull(generatedContent.researchTopicId),
      ),
    )
    .orderBy(desc(generatedContent.createdAt));
}

export async function deleteIdeasForTopic(
  researchTopicId: string,
): Promise<void> {
  await db
    .delete(generatedContent)
    .where(
      and(
        eq(generatedContent.researchTopicId, researchTopicId),
        eq(generatedContent.kind, "idea"),
      ),
    );
}

export async function saveGeneratedContent(
  rows: NewGeneratedContent[],
): Promise<GeneratedContent[]> {
  if (rows.length === 0) return [];
  return db.insert(generatedContent).values(rows).returning();
}

export async function listGeneratedContent(
  clerkUserId: string,
): Promise<GeneratedContent[]> {
  return db
    .select()
    .from(generatedContent)
    .where(eq(generatedContent.clerkUserId, clerkUserId))
    .orderBy(desc(generatedContent.createdAt));
}
