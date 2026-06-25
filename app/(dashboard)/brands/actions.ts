"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/clerk";
import { createBrand, deleteBrand, updateBrand } from "@/lib/repos/brands";

/** Set the active brand for the current session (stored in cookie). */
export async function switchBrandAction(brandId: string | null): Promise<void> {
  const jar = await cookies();
  if (brandId) {
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
}): Promise<void> {
  const userId = await requireUserId();
  await createBrand({ clerkUserId: userId, ...data });
  revalidatePath("/brands");
}

export async function updateBrandAction(
  id: string,
  data: { name?: string; description?: string; logoUrl?: string },
): Promise<void> {
  const userId = await requireUserId();
  await updateBrand(id, userId, data);
  revalidatePath("/brands");
}

export async function deleteBrandAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await deleteBrand(id, userId);
  revalidatePath("/brands");
}
