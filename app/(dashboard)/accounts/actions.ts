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

  // Delete first (the authorized, destructive op); only then stop polling. If
  // delete fails we keep polling a still-connected account; if unregister fails
  // it's best-effort (the next poll no-ops on the missing account).
  await deleteSocialAccount(id, userId);
  await unregisterCommentPoll(id).catch(() => {});
  revalidatePath("/accounts");
}
