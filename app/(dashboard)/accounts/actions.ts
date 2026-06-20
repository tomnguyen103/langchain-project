"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/clerk";
import { deleteSocialAccount } from "@/lib/repos/accounts";

export async function disconnectAccount(formData: FormData) {
  const userId = await requireUserId();
  const id = formData.get("id");
  if (typeof id === "string" && id.length > 0) {
    await deleteSocialAccount(id, userId);
    revalidatePath("/accounts");
  }
}
