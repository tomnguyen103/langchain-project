import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { brands, type Brand, type NewBrand } from "@/db/schema";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type CreateBrandInput = Pick<NewBrand, "clerkUserId" | "clerkOrgId" | "name" | "description" | "logoUrl"> & { slug?: string };

export async function createBrand(input: CreateBrandInput): Promise<Brand> {
  const slug = (input.slug ?? toSlug(input.name)) || randomUUID();
  const [row] = await db
    .insert(brands)
    .values({ ...input, slug })
    .returning();
  return row;
}

export async function listBrandsForUser(clerkUserId: string): Promise<Brand[]> {
  return db
    .select()
    .from(brands)
    .where(eq(brands.clerkUserId, clerkUserId))
    .orderBy(brands.name);
}

export async function getBrand(id: string, clerkUserId: string): Promise<Brand | undefined> {
  const [row] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.id, id), eq(brands.clerkUserId, clerkUserId)))
    .limit(1);
  return row;
}

export async function updateBrand(
  id: string,
  clerkUserId: string,
  data: Partial<Pick<NewBrand, "name" | "slug" | "description" | "logoUrl">>,
): Promise<Brand | undefined> {
  const [row] = await db
    .update(brands)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(brands.id, id), eq(brands.clerkUserId, clerkUserId)))
    .returning();
  return row;
}

export async function deleteBrand(id: string, clerkUserId: string): Promise<void> {
  await db
    .delete(brands)
    .where(and(eq(brands.id, id), eq(brands.clerkUserId, clerkUserId)));
}
