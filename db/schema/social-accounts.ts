import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { accountStatusEnum, platformEnum } from "./enums";
import { timestamps } from "./_helpers";

/** A connected social account. OAuth tokens are stored encrypted at rest. */
export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    clerkOrgId: text("clerk_org_id"),
    platform: platformEnum("platform").notNull(),
    // External id: e.g. Facebook Page id, Instagram business account id.
    platformAccountId: text("platform_account_id").notNull(),
    handle: text("handle"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    accessToken: text("access_token").notNull(), // encrypted
    refreshToken: text("refresh_token"), // encrypted
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: text("scopes").array(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    status: accountStatusEnum("status").notNull().default("active"),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("social_accounts_user_platform_account_uq").on(
      t.clerkUserId,
      t.platform,
      t.platformAccountId,
    ),
    index("social_accounts_user_idx").on(t.clerkUserId),
    // Token-refresh scan: status='active' AND tokenExpiresAt < threshold.
    index("social_accounts_refresh_idx").on(t.status, t.tokenExpiresAt),
  ],
);

export type SocialAccount = typeof socialAccounts.$inferSelect;
export type NewSocialAccount = typeof socialAccounts.$inferInsert;
