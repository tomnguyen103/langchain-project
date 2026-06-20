"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/clerk";
import { unregisterCommentPoll } from "@/lib/queue/jobs";
import {
  deleteSocialAccount,
  getUserSocialAccount,
} from "@/lib/repos/accounts";

export async function disconnectAccount(formData: FormData) {
  const userId = await requireUserId();
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return;

  // Authorize ownership BEFORE touching any account-scoped resource, so a
  // caller can't disable another user's polling with a guessed id.
  const account = await getUserSocialAccount(id, userId);
  if (!account) return;

  // Stop polling before the row (and its rules/comments) are removed.
  // Best-effort: a queue hiccup must not block disconnect.
  await unregisterCommentPoll(id).catch(() => {});
  await deleteSocialAccount(id, userId);
  revalidatePath("/accounts");
}
