import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  attributionLinks,
  type AttributionLink,
  type NewAttributionLink,
} from "@/db/schema";

export async function createAttributionLink(
  data: NewAttributionLink,
): Promise<AttributionLink> {
  const [row] = await db.insert(attributionLinks).values(data).returning();
  return row;
}

export async function listAttributionLinks(
  clerkUserId: string,
  campaignId: string,
): Promise<AttributionLink[]> {
  return db
    .select()
    .from(attributionLinks)
    .where(
      and(
        eq(attributionLinks.clerkUserId, clerkUserId),
        eq(attributionLinks.campaignId, campaignId),
      ),
    )
    .orderBy(desc(attributionLinks.createdAt));
}
