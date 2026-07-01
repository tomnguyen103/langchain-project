import { auth, clerkClient } from "@clerk/nextjs/server";

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

const MEMBERSHIP_PAGE_SIZE = 100;
const MEMBERSHIP_PAGE_LIMIT = 20; // caps the search at 2,000 members

/**
 * Whether `userId` is an actual member of the Clerk organization `orgId`.
 * Used before granting an app-level workspace role so an admin can't insert
 * a role row for an arbitrary, non-member Clerk user id. Fails closed: a
 * lookup error or an org larger than the page cap returns `false` rather than
 * silently trusting the caller-supplied id.
 */
export async function isOrganizationMember(
  orgId: string,
  userId: string,
): Promise<boolean> {
  const client = await clerkClient();
  for (let page = 0; page < MEMBERSHIP_PAGE_LIMIT; page++) {
    const { data } = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: MEMBERSHIP_PAGE_SIZE,
      offset: page * MEMBERSHIP_PAGE_SIZE,
    });
    if (data.some((membership) => membership.publicUserData?.userId === userId)) {
      return true;
    }
    if (data.length < MEMBERSHIP_PAGE_SIZE) return false;
  }
  return false;
}
