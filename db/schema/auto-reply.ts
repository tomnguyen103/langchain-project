import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
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
    // Enforce throttle bounds at the DB level so non-UI writers can't store
    // values that would silently break cooldown / daily-cap logic.
    check("auto_reply_rules_cooldown_nonneg", sql`${t.cooldownSec} >= 0`),
    check(
      "auto_reply_rules_max_per_day_pos",
      sql`${t.maxPerDay} IS NULL OR ${t.maxPerDay} > 0`,
    ),
  ],
);

export type AutoReplyRule = typeof autoReplyRules.$inferSelect;
export type NewAutoReplyRule = typeof autoReplyRules.$inferInsert;

/**
 * Per-rule rate-limit ledger (one row per rule) that makes cooldown + daily-cap
 * enforcement atomic. `grantReplySlot` does a single conditional upsert against
 * this row, so two concurrent reply jobs for the same rule are serialized by the
 * row lock — only one can take the last slot. Decoupled from `comment_events`
 * (which only flips `replied` after a confirmed post, too late to gate a race).
 *
 * - `periodStart`: the UTC day `usedCount` belongs to; a newer day resets it.
 * - `usedCount`: replies granted in the current period (rolled back on failure).
 * - `lastReplyAt`: last grant time, drives the cooldown window across periods.
 */
export const autoReplySlots = pgTable("auto_reply_slots", {
  ruleId: uuid("rule_id")
    .primaryKey()
    .references(() => autoReplyRules.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  usedCount: integer("used_count").notNull().default(0),
  lastReplyAt: timestamp("last_reply_at", { withTimezone: true }),
  ...timestamps,
});

export type AutoReplySlot = typeof autoReplySlots.$inferSelect;
