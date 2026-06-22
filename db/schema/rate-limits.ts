import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { timestamps } from "./_helpers";

/**
 * Fixed-window rate-limit counters. One row per (bucket, window); the limiter
 * does an atomic conditional upsert (increment while count < limit), mirroring
 * the usage-quota pattern — no extra infra (reuses the Postgres the app already
 * talks to, serverless-safe).
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bucket: text("bucket").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
    ...timestamps,
  },
  (t) => [unique("rate_limits_bucket_window_uq").on(t.bucket, t.windowStart)],
);

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
