import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./_helpers";

/**
 * brands — Atrium multi-brand workspace support. One user can own multiple
 * brands (e.g. a social media agency managing several clients). Each brand is
 * an independent content namespace; social_accounts, posts, generated_content,
 * and agent_runs carry a nullable brandId so data can be scoped per brand.
 * brandId=null means "no brand / personal workspace" and is valid forever.
 */
export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    clerkOrgId: text("clerk_org_id"),
    name: text("name").notNull(),
    /** URL-safe identifier, unique per user. Generated from name if not supplied. */
    slug: text("slug").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    ...timestamps,
  },
  (t) => [
    unique("brands_user_slug_uq").on(t.clerkUserId, t.slug),
    index("brands_user_idx").on(t.clerkUserId),
  ],
);

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
