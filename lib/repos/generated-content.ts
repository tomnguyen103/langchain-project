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

/** Atomically replace a topic's ideas (delete + insert in one transaction). */
export async function replaceIdeasForTopic(
  researchTopicId: string,
  rows: NewGeneratedContent[],
): Promise<void> {
  const deleteExisting = db
    .delete(generatedContent)
    .where(
      and(
        eq(generatedContent.researchTopicId, researchTopicId),
        eq(generatedContent.kind, "idea"),
      ),
    );
  if (rows.length === 0) {
    await deleteExisting;
    return;
  }
  await db.batch([deleteExisting, db.insert(generatedContent).values(rows)]);
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
