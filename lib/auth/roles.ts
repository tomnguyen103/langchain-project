/**
 * Workspace roles (Praetor), ordered most → least privileged. Keep the values in
 * sync with `workspaceRoleEnum` in db/schema/enums.ts.
 */
export const ROLES = [
  "owner",
  "admin",
  "approver",
  "creator",
  "viewer",
] as const;
export type Role = (typeof ROLES)[number];

/** Default role when a user has no explicit membership (solo/first user). */
export const DEFAULT_ROLE: Role = "owner";
export const DEFAULT_ORG_ROLE: Role = "viewer";

const RANK: Record<Role, number> = {
  owner: 4,
  admin: 3,
  approver: 2,
  creator: 1,
  viewer: 0,
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Whether `role` meets or exceeds `required` in the hierarchy. */
export function hasRole(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

/** Approve / reject / accept content in the review queue. */
export function canApprove(role: Role): boolean {
  return hasRole(role, "approver");
}

/** Assign roles and manage the team. */
export function canManageTeam(role: Role): boolean {
  return hasRole(role, "admin");
}

/** Create or edit content and start runs (everyone except viewers). */
export function canCreate(role: Role): boolean {
  return hasRole(role, "creator");
}

export function roleForMissingMembership(
  clerkOrgRole: string | null | undefined,
): Role {
  if (!clerkOrgRole) return DEFAULT_ORG_ROLE;
  const normalized = clerkOrgRole.startsWith("org:")
    ? clerkOrgRole.slice(4)
    : clerkOrgRole;
  if (isRole(normalized)) return normalized;
  if (normalized === "member") return DEFAULT_ORG_ROLE;
  return DEFAULT_ORG_ROLE;
}
