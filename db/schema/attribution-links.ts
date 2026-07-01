import { index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";
import { timestamps } from "./_helpers";

export const attributionLinks = pgTable(
  "attribution_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    label: text("label").notNull(),
    destinationUrl: text("destination_url").notNull(),
    utmParams: jsonb("utm_params").$type<Record<string, string>>().notNull(),
    trackedUrl: text("tracked_url").notNull(),
    clicks: integer("clicks").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    revenueCents: integer("revenue_cents").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("attribution_links_user_idx").on(t.clerkUserId, t.createdAt)],
);

export type AttributionLink = typeof attributionLinks.$inferSelect;
export type NewAttributionLink = typeof attributionLinks.$inferInsert;
