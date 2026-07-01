import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import {
  integrationAuditResultEnum,
  integrationTokenKindEnum,
  integrationTokenStatusEnum,
} from "./enums";
import { timestamps } from "./_helpers";

export const integrationTokens = pgTable(
  "integration_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    kind: integrationTokenKindEnum("kind").notNull(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
    status: integrationTokenStatusEnum("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("integration_tokens_hash_uq").on(t.tokenHash),
    index("integration_tokens_user_kind_idx").on(t.clerkUserId, t.kind),
  ],
);

export const integrationAuditLogs = pgTable(
  "integration_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    tokenId: uuid("token_id").references(() => integrationTokens.id, {
      onDelete: "set null",
    }),
    surface: text("surface").notNull(),
    action: text("action").notNull(),
    result: integrationAuditResultEnum("result").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [index("integration_audit_user_idx").on(t.clerkUserId, t.createdAt)],
);

export type IntegrationToken = typeof integrationTokens.$inferSelect;
export type NewIntegrationToken = typeof integrationTokens.$inferInsert;
export type IntegrationAuditLog = typeof integrationAuditLogs.$inferSelect;
export type NewIntegrationAuditLog = typeof integrationAuditLogs.$inferInsert;
