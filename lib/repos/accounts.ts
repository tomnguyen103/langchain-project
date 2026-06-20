import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  socialAccounts,
  type NewSocialAccount,
  type SocialAccount,
} from "@/db/schema";

/** Insert or refresh a connected account (keyed by user + platform + external id). */
export async function upsertSocialAccount(
  data: NewSocialAccount,
): Promise<SocialAccount> {
  const [row] = await db
    .insert(socialAccounts)
    .values(data)
    .onConflictDoUpdate({
      target: [
        socialAccounts.clerkUserId,
        socialAccounts.platform,
        socialAccounts.platformAccountId,
      ],
      set: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
        handle: data.handle,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        metadata: data.metadata,
        status: "active",
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function listSocialAccounts(
  clerkUserId: string,
): Promise<SocialAccount[]> {
  return db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.clerkUserId, clerkUserId));
}

export async function getSocialAccount(
  id: string,
): Promise<SocialAccount | undefined> {
  const [row] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, id))
    .limit(1);
  return row;
}

export async function getUserSocialAccount(
  id: string,
  clerkUserId: string,
): Promise<SocialAccount | undefined> {
  const [row] = await db
    .select()
    .from(socialAccounts)
    .where(
      and(eq(socialAccounts.id, id), eq(socialAccounts.clerkUserId, clerkUserId)),
    )
    .limit(1);
  return row;
}

export async function updateAccountTokens(
  id: string,
  data: {
    accessToken: string;
    refreshToken?: string | null;
    tokenExpiresAt?: Date | null;
  },
): Promise<void> {
  await db
    .update(socialAccounts)
    .set({
      ...data,
      status: "active",
      lastValidatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(socialAccounts.id, id));
}

export async function setAccountStatus(
  id: string,
  status: "active" | "expired" | "revoked",
): Promise<void> {
  await db
    .update(socialAccounts)
    .set({ status, updatedAt: new Date() })
    .where(eq(socialAccounts.id, id));
}

export async function deleteSocialAccount(
  id: string,
  clerkUserId: string,
): Promise<void> {
  await db
    .delete(socialAccounts)
    .where(
      and(eq(socialAccounts.id, id), eq(socialAccounts.clerkUserId, clerkUserId)),
    );
}
