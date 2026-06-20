import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { matchTypeEnum, platformEnum } from "./enums";
import { socialAccounts } from "./social-accounts";
import { timestamps } from "./_helpers";

/**
 * A keyword-triggered auto-reply rule. When a comment on one of the user's
 * published posts matches `keywords` under `matchType`, the reply worker posts
 * `replyTemplate` (with {{author}} substituted) — or an AI-composed reply when
 * `useAi` is set. A null `socialAccountId` applies the rule to every account of
 * `platform` for the user.
 */
export const autoReplyRules = pgTable(
  "auto_reply_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    clerkOrgId: text("clerk_org_id"),
    platform: platformEnum("platform").notNull(),
    // Null ⇒ applies to every account of `platform` for this user.
    socialAccountId: uuid("social_account_id").references(
      () => socialAccounts.id,
      { onDelete: "cascade" },
    ),
    keywords: text("keywords")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    matchType: matchTypeEnum("match_type").notNull().default("any"),
    replyTemplate: text("reply_template").notNull().default(""),
    useAi: boolean("use_ai").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    cooldownSec: integer("cooldown_sec").notNull().default(0),
    // Null ⇒ no daily cap.
    maxPerDay: integer("max_per_day"),
    ...timestamps,
  },
  (t) => [
    index("auto_reply_rules_user_idx").on(t.clerkUserId),
    index("auto_reply_rules_platform_enabled_idx").on(t.platform, t.enabled),
    index("auto_reply_rules_account_idx").on(t.socialAccountId),
  ],
);

export type AutoReplyRule = typeof autoReplyRules.$inferSelect;
export type NewAutoReplyRule = typeof autoReplyRules.$inferInsert;
