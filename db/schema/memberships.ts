import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { workspaceRoleEnum } from "./enums";
import { timestamps } from "./_helpers";

/**
 * Team membership + role within a workspace (Clerk org), Praetor. One row per
 * (org, user); the role gates sensitive actions — e.g. only an approver+ can
 * clear the review queue. A user with no membership row falls back to the
 * app-layer DEFAULT_ROLE (see lib/auth/roles.ts), so solo users keep full access.
 */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkOrgId: text("clerk_org_id").notNull(),
    clerkUserId: text("clerk_user_id").notNull(),
    role: workspaceRoleEnum("role").notNull().default("viewer"),
    ...timestamps,
  },
  (t) => [
    unique("memberships_org_user_uq").on(t.clerkOrgId, t.clerkUserId),
    index("memberships_org_idx").on(t.clerkOrgId),
  ],
);

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
