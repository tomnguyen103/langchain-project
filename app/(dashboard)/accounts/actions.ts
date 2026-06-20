"use server";

import { revalidatePath } from "next/cache";

import { getPlanLimits } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { unregisterCommentPoll } from "@/lib/queue/jobs";
import {
  deleteSocialAccount,
  getUserSocialAccount,
  listSocialAccounts,
  upsertSocialAccount,
} from "@/lib/repos/accounts";
import { encrypt } from "@/lib/utils/crypto";

// Anchored to Discord domains so the server-side verify fetch can't be aimed at
// an arbitrary host (SSRF). Allows subdomains and an optional /vNN/ API version.
const DISCORD_WEBHOOK_RE =
  /^https:\/\/(?:[\w-]+\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/(\d+)\/[\w-]+$/;

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

/** Connect a Discord channel via a pasted incoming-webhook URL (no OAuth). */
export async function connectDiscordWebhook(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const url = (formData.get("webhookUrl") ?? "").toString().trim();
  const match = DISCORD_WEBHOOK_RE.exec(url);
  if (!match) {
    throw new Error("Enter a valid Discord webhook URL.");
  }
  const webhookId = match[1];

  // Enforce the connected-account limit (matches the OAuth start gate).
  const limits = await getPlanLimits();
  const existing = await listSocialAccounts(userId);
  const already = existing.some(
    (a) => a.platform === "discord" && a.platformAccountId === webhookId,
  );
  if (!already && existing.length >= limits.accounts) {
    throw new Error("You've reached your plan's connected-account limit.");
  }

  // Verify the webhook is real and read its name (best-effort for display).
  let name = "Discord webhook";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const hook = (await res.json()) as { name?: string };
    if (hook.name) name = hook.name;
  } catch {
    throw new Error("Couldn't verify that webhook — double-check the URL.");
  }

  await upsertSocialAccount({
    clerkUserId: userId,
    platform: "discord",
    platformAccountId: webhookId,
    handle: name,
    displayName: name,
    accessToken: encrypt(url),
    status: "active",
    lastValidatedAt: new Date(),
  });
  revalidatePath("/accounts");
}
