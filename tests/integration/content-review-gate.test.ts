/**
 * Integration test for the human-review gate in lib/repos/content-reviews.ts
 * (acceptHeldDraft, rejectHeldDraft, setReviewDecision) — the highest-stakes
 * write path in the app: a bug here either double-schedules a draft the
 * agent already got a decision on, or silently drops a rejection. Unlike
 * memberships/approval-links, these mutators were never TOCTOU-vulnerable —
 * each is a single UPDATE with the guard (`clerkUserId` + `reviewStatus =
 * 'held'`, per-item also `agentRunId` + `id`) built directly into the WHERE
 * clause. This test proves that guard actually holds: cross-tenant reads
 * can't leak or mutate another tenant's draft, an already-decided draft
 * can't be re-decided, and concurrent decisions on the same draft don't
 * double-apply.
 *
 * Needs a real Postgres, like the other tests/integration/*.test.ts files.
 *
 *   DATABASE_URL=postgres://user:pass@host/db DB_DRIVER=node-postgres npm run test:integration
 *
 * Writes and cleans up rows under a unique synthetic clerk user id, so it
 * never touches real tenant data.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

const HAS_DB =
  Boolean(process.env.DATABASE_URL) &&
  process.env.DB_DRIVER === "node-postgres";
const skip: boolean | string = HAS_DB
  ? false
  : "set DATABASE_URL and DB_DRIVER=node-postgres to run (needs a throwaway Postgres)";

describe("content-reviews: human-review-gate scoping", { skip }, () => {
  let reviewsRepo: typeof import("@/lib/repos/content-reviews");
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let orm: typeof import("drizzle-orm");

  const ownerA = `__review_test_userA_${randomUUID()}__`;
  const ownerB = `__review_test_userB_${randomUUID()}__`;
  const agentRunId = `__review_test_run_${randomUUID()}__`;

  before(async () => {
    reviewsRepo = await import("@/lib/repos/content-reviews");
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    orm = await import("drizzle-orm");
  });

  async function createHeldDraft(clerkUserId: string): Promise<string> {
    const [row] = await db
      .insert(schema.generatedContent)
      .values({
        clerkUserId,
        content: "Draft body under review.",
        reviewStatus: "held",
        agentRunId,
      })
      .returning({ id: schema.generatedContent.id });
    return row.id;
  }

  after(async () => {
    await db
      .delete(schema.generatedContent)
      .where(
        orm.inArray(schema.generatedContent.clerkUserId, [ownerA, ownerB]),
      );
  });

  it("acceptHeldDraft: a different tenant cannot accept another tenant's held draft", async () => {
    const id = await createHeldDraft(ownerA);

    const changed = await reviewsRepo.acceptHeldDraft(id, agentRunId, ownerB);
    assert.deepEqual(changed, []);

    const [row] = await db
      .select({ reviewStatus: schema.generatedContent.reviewStatus })
      .from(schema.generatedContent)
      .where(orm.eq(schema.generatedContent.id, id));
    assert.equal(row.reviewStatus, "held", "draft must remain untouched");
  });

  it("acceptHeldDraft: cannot re-accept an already-decided draft", async () => {
    const id = await createHeldDraft(ownerA);

    const first = await reviewsRepo.acceptHeldDraft(id, agentRunId, ownerA);
    assert.deepEqual(first, [id]);

    const second = await reviewsRepo.acceptHeldDraft(id, agentRunId, ownerA);
    assert.deepEqual(second, [], "an already-approved draft must not re-accept");
  });

  it("rejectHeldDraft: cannot reject an already-approved draft", async () => {
    const id = await createHeldDraft(ownerA);
    await reviewsRepo.acceptHeldDraft(id, agentRunId, ownerA);

    const rejected = await reviewsRepo.rejectHeldDraft(id, agentRunId, ownerA);
    assert.deepEqual(
      rejected,
      [],
      "accept and reject must be mutually exclusive terminal states",
    );
  });

  it("the race: concurrent accepts on the same held draft, exactly one wins", async () => {
    const TRIALS = 8;
    const CONCURRENCY = 5;
    for (let trial = 0; trial < TRIALS; trial++) {
      const id = await createHeldDraft(ownerA);

      const results = await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          reviewsRepo.acceptHeldDraft(id, agentRunId, ownerA),
        ),
      );

      const wins = results.filter((r) => r.length > 0).length;
      assert.equal(
        wins,
        1,
        `trial ${trial}: expected exactly one accept to win, got ${wins} ` +
          `(results=${JSON.stringify(results)})`,
      );
    }
  });

  it("setReviewDecision: only touches this tenant's held ids, ignores already-decided ones", async () => {
    const heldA = await createHeldDraft(ownerA);
    const heldB = await createHeldDraft(ownerB);
    const alreadyApproved = await createHeldDraft(ownerA);
    await reviewsRepo.acceptHeldDraft(alreadyApproved, agentRunId, ownerA);

    const changed = await reviewsRepo.setReviewDecision(
      [heldA, heldB, alreadyApproved],
      ownerA,
      "approved",
      ownerA,
    );

    assert.deepEqual(
      changed,
      [heldA],
      "must approve only the caller's own still-held draft",
    );
  });
});
