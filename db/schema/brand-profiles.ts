import { boolean, jsonb, pgTable, real, text, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./_helpers";

/**
 * brand_profiles — one row per tenant (keyed by clerkUserId). Holds the
 * brand-safety SETTINGS the Castor gate reads (voice, banned terms, the
 * auto-publish toggle + threshold) plus a `learnedMemory` blob that Rigel writes
 * and Lyra reads later (T11). `autoPublishEnabled` defaults OFF so nothing
 * auto-publishes until a tenant opts in with a calibrated threshold.
 */
export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  clerkOrgId: text("clerk_org_id"),
  voice: text("voice"),
  bannedTerms: jsonb("banned_terms").$type<string[]>().notNull().default([]),
  autoPublishEnabled: boolean("auto_publish_enabled").notNull().default(false),
  autoPublishThreshold: real("auto_publish_threshold").notNull().default(0.8),
  learnedMemory: jsonb("learned_memory").$type<Record<string, unknown>>(),
  ...timestamps,
});

export type BrandProfile = typeof brandProfiles.$inferSelect;
export type NewBrandProfile = typeof brandProfiles.$inferInsert;
