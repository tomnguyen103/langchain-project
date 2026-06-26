import { and, asc, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  evergreenPreferences,
  type EvergreenPreference,
  type NewEvergreenPreference,
} from "@/db/schema";

export async function getEvergreenPreference(
  clerkUserId: string,
): Promise<EvergreenPreference | undefined> {
  const [row] = await db
    .select()
    .from(evergreenPreferences)
    .where(eq(evergreenPreferences.clerkUserId, clerkUserId))
    .limit(1);
  return row;
}

export async function upsertEvergreenPreference(
  clerkUserId: string,
  data: Omit<NewEvergreenPreference, "clerkUserId">,
): Promise<EvergreenPreference> {
  const [row] = await db
    .insert(evergreenPreferences)
    .values({ clerkUserId, ...data })
    .onConflictDoUpdate({
      target: evergreenPreferences.clerkUserId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function listDueEvergreenPreferences(
  now = new Date(),
  limit = 50,
): Promise<EvergreenPreference[]> {
  return db
    .select()
    .from(evergreenPreferences)
    .where(
      and(
        eq(evergreenPreferences.enabled, true),
        lte(evergreenPreferences.nextRunAt, now),
      ),
    )
    .orderBy(asc(evergreenPreferences.nextRunAt))
    .limit(limit);
}

export async function updateEvergreenPreference(
  clerkUserId: string,
  data: Partial<NewEvergreenPreference>,
): Promise<void> {
  await db
    .update(evergreenPreferences)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(evergreenPreferences.clerkUserId, clerkUserId));
}
