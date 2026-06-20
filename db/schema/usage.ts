import { date, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./_helpers";

/** Per-user, per-metric, per-period usage counters for plan quota enforcement. */
export const usage = pgTable(
  "usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    metric: text("metric").notNull(), // posts_scheduled | ai_generations
    periodStart: date("period_start").notNull(), // YYYY-MM-DD (day or month start)
    count: integer("count").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique("usage_user_metric_period_uq").on(
      t.clerkUserId,
      t.metric,
      t.periodStart,
    ),
  ],
);

export type Usage = typeof usage.$inferSelect;
