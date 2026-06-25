import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  jsonb,
  pgTable,
  real,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { timestamps } from "./_helpers";

/**
 * Per-tenant AI-content disclosure policy (Aletheia). When `labelAiContent` is
 * on, the agent's autopublish path appends `disclosureText` (within each
 * platform's limit) and records a disclosure_ledger row. `jurisdiction` is a
 * free-text audit tag (e.g. "EU", "US-CA").
 */
export type DisclosurePolicy = {
  labelAiContent: boolean;
  disclosureText: string | null;
  jurisdiction: string | null;
};

/** A snapshot entry in the voice history — saved each time voice is updated. */
export type VoiceHistoryEntry = {
  voice: string;
  savedAt: string; // ISO timestamp
};

/**
 * brand_profiles — one row per tenant (keyed by clerkUserId). Holds the
 * brand-safety SETTINGS the Castor gate reads (voice, banned terms, the
 * auto-publish toggle + threshold) plus a `learnedMemory` blob that Rigel writes
 * and Lyra reads later (T11). `autoPublishEnabled` defaults OFF so nothing
 * auto-publishes until a tenant opts in with a calibrated threshold.
 */
export const brandProfiles = pgTable(
  "brand_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    clerkOrgId: text("clerk_org_id"),
    voice: text("voice"),
    bannedTerms: jsonb("banned_terms").$type<string[]>().notNull().default([]),
    autoPublishEnabled: boolean("auto_publish_enabled").notNull().default(false),
    autoPublishThreshold: real("auto_publish_threshold").notNull().default(0.8),
    learnedMemory: jsonb("learned_memory").$type<Record<string, unknown>>(),
    /** AI-content disclosure policy (Aletheia); null = disclosure off. */
    disclosurePolicy: jsonb("disclosure_policy").$type<DisclosurePolicy>(),
    /** Per-org custom Praxis policy rules (literal warn/block phrases); null = none. */
    policyRules: jsonb("policy_rules").$type<
      Array<{ term: string; level: "warn" | "block" }>
    >(),
    /** Mnemosyne voice history — previous voice snapshots, newest first, capped at 10. */
    voiceHistory: jsonb("voice_history").$type<VoiceHistoryEntry[]>(),
    ...timestamps,
  },
  (t) => [
    // Defense in depth: keep the threshold in [0,1] even if a non-UI path writes.
    check(
      "brand_profiles_threshold_range",
      sql`${t.autoPublishThreshold} >= 0 AND ${t.autoPublishThreshold} <= 1`,
    ),
  ],
);

export type BrandProfile = typeof brandProfiles.$inferSelect;
export type NewBrandProfile = typeof brandProfiles.$inferInsert;
