import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PostTarget } from "@/db/schema";
import { derivePostStatus, hasLiveTarget, LIVE_TARGET_STATUSES } from "./status";

const t = (status: PostTarget["status"]): Pick<PostTarget, "status"> => ({
  status,
});

describe("derivePostStatus", () => {
  it("is draft with no targets", () => {
    assert.equal(derivePostStatus([]), "draft");
  });

  it("is published when every target is published", () => {
    assert.equal(
      derivePostStatus([t("published"), t("published")]),
      "published",
    );
  });

  it("is failed when every target failed", () => {
    assert.equal(derivePostStatus([t("failed"), t("failed")]), "failed");
  });

  it("is partially_published when published + failed cover all (some published)", () => {
    assert.equal(
      derivePostStatus([t("published"), t("failed")]),
      "partially_published",
    );
  });

  it("is publishing when a target is mid-publish", () => {
    assert.equal(
      derivePostStatus([t("publishing"), t("queued")]),
      "publishing",
    );
  });

  it("is publishing when some are published but others still pending", () => {
    assert.equal(derivePostStatus([t("published"), t("queued")]), "publishing");
  });

  it("is scheduled when all targets are still queued/pending", () => {
    assert.equal(derivePostStatus([t("queued"), t("pending")]), "scheduled");
  });
});

describe("hasLiveTarget (posts_scheduled refund signal)", () => {
  it("is true when any target is queued, publishing, or published", () => {
    assert.equal(hasLiveTarget([t("queued")]), true);
    assert.equal(hasLiveTarget([t("publishing")]), true);
    assert.equal(hasLiveTarget([t("published")]), true);
  });

  it("keeps the unit held while one target is still scheduled", () => {
    // A multi-target post where one target was cancelled (→pending) but another
    // is still queued must NOT refund — it's not fully retracted.
    assert.equal(hasLiveTarget([t("pending"), t("queued")]), true);
  });

  it("is false when the post is fully retracted to pending/failed", () => {
    assert.equal(hasLiveTarget([t("pending"), t("pending")]), false);
    assert.equal(hasLiveTarget([t("pending"), t("failed")]), false);
    assert.equal(hasLiveTarget([t("failed")]), false);
  });

  it("is false for an empty target set", () => {
    assert.equal(hasLiveTarget([]), false);
  });

  it("pins LIVE_TARGET_STATUSES — the set the atomic SQL refund claim relies on", () => {
    assert.deepEqual(LIVE_TARGET_STATUSES, [
      "queued",
      "publishing",
      "published",
    ]);
  });
});
