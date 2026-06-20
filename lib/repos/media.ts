import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { mediaAssets, type MediaAsset, type NewMediaAsset } from "@/db/schema";

export async function createMediaAsset(
  data: NewMediaAsset,
): Promise<MediaAsset> {
  const [row] = await db.insert(mediaAssets).values(data).returning();
  return row;
}

export async function getMediaAssets(ids: string[]): Promise<MediaAsset[]> {
  if (!ids.length) return [];
  return db.select().from(mediaAssets).where(inArray(mediaAssets.id, ids));
}

export async function getMediaAsset(
  id: string,
): Promise<MediaAsset | undefined> {
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1);
  return row;
}

/** Resolve media ids in the original order they were attached. */
export async function resolveMediaAssets(ids: string[]): Promise<MediaAsset[]> {
  const rows = await getMediaAssets(ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is MediaAsset => Boolean(r));
}

export async function listUserMedia(
  clerkUserId: string,
): Promise<MediaAsset[]> {
  return db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.clerkUserId, clerkUserId))
    .orderBy(desc(mediaAssets.createdAt));
}
