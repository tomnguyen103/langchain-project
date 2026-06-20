"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/clerk";
import { unregisterCommentPoll } from "@/lib/queue/jobs";
import { deleteSocialAccount } from "@/lib/repos/accounts";

export async function disconnectAccount(formData: FormData) {
  const userId = await requireUserId();
  const id = formData.get("id");
  if (typeof id === "string" && id.length > 0) {
    // Stop polling before the row (and its rules/comments) are removed.
    // Best-effort: a queue hiccup must not block disconnect.
    await unregisterCommentPoll(id).catch(() => {});
    await deleteSocialAccount(id, userId);
    revalidatePath("/accounts");
  }
}
