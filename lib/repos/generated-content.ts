import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { db, runAtomicWrite } from "@/db";
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

/**
 * Atomically replace a topic's ideas (delete + insert in one transaction) and
 * return the inserted rows, so callers (e.g. the Vega agent) can capture the new
 * generated_content ids for a handoff. Idempotent on retry.
 */
export async function replaceIdeasForTopic(
  researchTopicId: string,
  rows: NewGeneratedContent[],
): Promise<GeneratedContent[]> {
  const whereIdeas = and(
    eq(generatedContent.researchTopicId, researchTopicId),
    eq(generatedContent.kind, "idea"),
  );
  if (rows.length === 0) {
    await db.delete(generatedContent).where(whereIdeas);
    return [];
  }
  const [, inserted] = await runAtomicWrite((tx) => [
    tx.delete(generatedContent).where(whereIdeas),
    tx.insert(generatedContent).values(rows).returning(),
  ]);
  return inserted;
}

export async function saveGeneratedContent(
  rows: NewGeneratedContent[],
): Promise<GeneratedContent[]> {
  if (rows.length === 0) return [];
  return db.insert(generatedContent).values(rows).returning();
}

/** Fetch generated rows by id (e.g. the Atlas agent turning drafts into posts). */
export async function getGeneratedContentByIds(
  ids: string[],
): Promise<GeneratedContent[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(generatedContent)
    .where(inArray(generatedContent.id, ids));
}

/** Mark generated rows as accepted (autonomous runs auto-accept their drafts). */
export async function markGeneratedContentAccepted(
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(generatedContent)
    .set({ accepted: true })
    .where(inArray(generatedContent.id, ids));
}

/** Attach a LangSmith run id to generated rows (for trace deep-links). */
export async function setGeneratedContentRunId(
  ids: string[],
  langsmithRunId: string,
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(generatedContent)
    .set({ langsmithRunId })
    .where(inArray(generatedContent.id, ids));
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
