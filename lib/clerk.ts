import { auth } from "@clerk/nextjs/server";

/** The authenticated Clerk user id, or throws if unauthenticated. */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

/** The active Clerk organization id, if any. */
export async function getOrgId(): Promise<string | null> {
  const { orgId } = await auth();
  return orgId ?? null;
}
