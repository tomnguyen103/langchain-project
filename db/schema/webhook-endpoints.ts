import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { webhookDeliveryStatusEnum } from "./enums";
import { timestamps } from "./_helpers";

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    secretHash: text("secret_hash").notNull(),
    secretCiphertext: text("secret_ciphertext").notNull(),
    eventTypes: text("event_types").array().notNull().default(sql`'{}'::text[]`),
    enabled: boolean("enabled").notNull().default(true),
    lastDeliveredAt: timestamp("last_delivered_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("webhook_endpoints_user_idx").on(t.clerkUserId)],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: webhookDeliveryStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [
    index("webhook_deliveries_due_idx").on(t.status, t.nextAttemptAt),
    index("webhook_deliveries_user_idx").on(t.clerkUserId, t.createdAt),
  ],
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
