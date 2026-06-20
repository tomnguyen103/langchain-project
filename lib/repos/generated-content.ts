import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  generatedContent,
  type GeneratedContent,
  type NewGeneratedContent,
} from "@/db/schema";

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
