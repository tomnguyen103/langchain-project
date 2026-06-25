import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  contentPlans,
  type ContentPlan,
  type NewContentPlan,
  type PlanSlot,
} from "@/db/schema";

export async function createContentPlan(
  data: NewContentPlan,
): Promise<ContentPlan> {
  const [row] = await db.insert(contentPlans).values(data).returning();
  return row;
}

export async function getContentPlan(
  id: string,
  clerkUserId: string,
): Promise<ContentPlan | undefined> {
  const [row] = await db
    .select()
    .from(contentPlans)
    .where(and(eq(contentPlans.id, id), eq(contentPlans.clerkUserId, clerkUserId)))
    .limit(1);
  return row;
}

export async function listContentPlans(
  clerkUserId: string,
  limit = 10,
): Promise<ContentPlan[]> {
  return db
    .select()
    .from(contentPlans)
    .where(eq(contentPlans.clerkUserId, clerkUserId))
    .orderBy(desc(contentPlans.createdAt))
    .limit(limit);
}

export async function approveContentPlan(
  id: string,
  clerkUserId: string,
  slotsWithRunIds: PlanSlot[],
): Promise<void> {
  await db
    .update(contentPlans)
    .set({ status: "approved", slots: slotsWithRunIds, updatedAt: new Date() })
    .where(and(eq(contentPlans.id, id), eq(contentPlans.clerkUserId, clerkUserId)));
}

export async function cancelContentPlan(
  id: string,
  clerkUserId: string,
): Promise<void> {
  await db
    .update(contentPlans)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(contentPlans.id, id), eq(contentPlans.clerkUserId, clerkUserId)));
}
