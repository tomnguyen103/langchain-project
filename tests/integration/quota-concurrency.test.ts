/**
 * Integration tests for the atomic quota / rate-limit race-safety (review
 * finding I-CODE-7, deferred as F-C6).
 *
 * These exercise the conditional-upsert SQL (`onConflictDoUpdate … setWhere`)
 * under GENUINE concurrency — many requests firing the same atomic statement at
 * once — which a pure-logic unit test cannot reproduce. They therefore need a
 * real Postgres and are deliberately NOT part of `npm test` (which collects only
 * the unit tests under lib/). Run them against a throwaway database:
 *
 *   DATABASE_URL=postgres://user:pass@host/db npm run test:integration
 *
 * With no `DATABASE_URL` the whole suite is SKIPPED (not failed), so CI — which
 * has no live DB — stays green. The suite writes and cleans up rows under a
 * unique synthetic `clerkUserId` / bucket, so it never touches real tenant data.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const skip: boolean | string = HAS_DB
  ? false
  : "set DATABASE_URL to run (needs a throwaway Postgres)";

describe("atomic quota / rate-limit race-safety (F-C6)", { skip }, () => {
  // Imported lazily so module load (env + db client) only happens when the suite
  // actually runs — a skipped run never opens a connection.
  let usageRepo: typeof import("@/lib/repos/usage");
  let rateLimitRepo: typeof import("@/lib/repos/rate-limits");
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let orm: typeof import("drizzle-orm");

  const userId = `__fc6_test_${Date.now()}__`;
  const metric = "posts_scheduled";

  before(async () => {
    usageRepo = await import("@/lib/repos/usage");
    rateLimitRepo = await import("@/lib/repos/rate-limits");
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    orm = await import("drizzle-orm");
    await db
      .delete(schema.usage)
      .where(orm.eq(schema.usage.clerkUserId, userId));
  });

  after(async () => {
    await db
      .delete(schema.usage)
      .where(orm.eq(schema.usage.clerkUserId, userId));
  });

  it("consumeUsage: exactly ONE of N concurrent consumes wins at limit=1", async () => {
    const period = "1970-01-01";
    const N = 25;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        usageRepo.consumeUsage(userId, metric, period, 1),
      ),
    );
    assert.equal(
      results.filter(Boolean).length,
      1,
      "the atomic setWhere must let only one consume past limit=1",
    );
    assert.equal(await usageRepo.getUsageCount(userId, metric, period), 1);
  });

  it("consumeUsage: never exceeds the cap under concurrency (limit=5)", async () => {
    const period = "1970-01-02";
    const N = 50;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        usageRepo.consumeUsage(userId, metric, period, 5),
      ),
    );
    assert.equal(results.filter(Boolean).length, 5);
    assert.equal(await usageRepo.getUsageCount(userId, metric, period), 5);
  });

  it("releaseUsage floors the counter at 0 under concurrency", async () => {
    const period = "1970-01-03";
    const seeded = await usageRepo.consumeUsage(userId, metric, period, 5);
    assert.equal(seeded, true, "failed to seed the usage row before releases");
    assert.equal(await usageRepo.getUsageCount(userId, metric, period), 1);
    await Promise.all([
      usageRepo.releaseUsage(userId, metric, period),
      usageRepo.releaseUsage(userId, metric, period),
      usageRepo.releaseUsage(userId, metric, period),
    ]);
    assert.equal(await usageRepo.getUsageCount(userId, metric, period), 0);
  });

  it("takeRateLimit: exactly ONE of N concurrent takes wins at limit=1", async () => {
    const bucket = `__fc6_bucket_${Date.now()}__`;
    const windowStart = new Date(0);
    const N = 25;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        rateLimitRepo.takeRateLimit(bucket, windowStart, 1),
      ),
    );
    assert.equal(results.filter(Boolean).length, 1);
    await db
      .delete(schema.rateLimits)
      .where(orm.eq(schema.rateLimits.bucket, bucket));
  });
});
