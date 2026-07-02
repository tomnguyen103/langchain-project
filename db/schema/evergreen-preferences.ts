import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { evergreenFrequencyEnum, type Platform } from "./enums";
import { timestamps } from "./_helpers";

export const evergreenPreferences = pgTable(
  "evergreen_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    enabled: boolean("enabled").notNull().default(false),
    frequency: evergreenFrequencyEnum("frequency").notNull().default("monthly"),
    platforms: jsonb("platforms").$type<Platform[]>().notNull().default([]),
    minEngagement: integer("min_engagement").notNull().default(1),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastSourceTargetId: uuid("last_source_target_id"),
    ...timestamps,
  },
  (t) => [index("evergreen_preferences_due_idx").on(t.enabled, t.nextRunAt)],
);

export type EvergreenPreference = typeof evergreenPreferences.$inferSelect;
export type NewEvergreenPreference = typeof evergreenPreferences.$inferInsert;
