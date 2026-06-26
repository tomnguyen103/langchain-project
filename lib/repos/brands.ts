import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { brands, type Brand, type NewBrand } from "@/db/schema";

export class BrandSlugConflictError extends Error {
  constructor() {
    super("A brand with this name already exists.");
    this.name = "BrandSlugConflictError";
  }
}

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
  try {
    const [row] = await db
      .insert(brands)
      .values({ ...input, slug })
      .returning();
    return row;
  } catch (err) {
    if (
      err != null &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: unknown }).code === "23505"
    ) {
      throw new BrandSlugConflictError();
    }
    throw err;
  }
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

export async function deleteBrand(id: string, clerkUserId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(brands)
    .where(and(eq(brands.id, id), eq(brands.clerkUserId, clerkUserId)))
    .returning({ id: brands.id });
  return deleted != null;
}
