"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/current-role";
import { requireUserId } from "@/lib/clerk";
import { BrandSlugConflictError, createBrand, deleteBrand, getBrand, updateBrand } from "@/lib/repos/brands";

/** Set the active brand for the current session (stored in cookie). */
export async function switchBrandAction(brandId: string | null): Promise<void> {
  const userId = await requireUserId();
  const jar = await cookies();
  if (brandId) {
    const brand = await getBrand(brandId, userId);
    if (!brand) return;
    jar.set("current_brand_id", brandId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  } else {
    jar.delete("current_brand_id");
  }
  revalidatePath("/", "layout");
}

export async function createBrandAction(data: {
  name: string;
  description?: string;
  logoUrl?: string;
}): Promise<{ error?: string }> {
  const userId = await requireUserId();
  await requireRole("creator");
  const name = data.name.trim();
  if (!name) return {};
  try {
    await createBrand({ clerkUserId: userId, ...data, name });
  } catch (err) {
    if (err instanceof BrandSlugConflictError) {
      return { error: err.message };
    }
    throw err;
  }
  revalidatePath("/workspace");
  return {};
}

export async function updateBrandAction(
  id: string,
  data: { name?: string; description?: string; logoUrl?: string },
): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const trimmed = { ...data };
  if (trimmed.name !== undefined) trimmed.name = trimmed.name.trim();
  const updated = await updateBrand(id, userId, trimmed);
  if (!updated) return;
  revalidatePath("/workspace");
}

export async function deleteBrandAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const deleted = await deleteBrand(id, userId);
  if (!deleted) return;
  revalidatePath("/workspace");
}
