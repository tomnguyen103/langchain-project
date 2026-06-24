import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveReviewDecision } from "./resolve";

describe("resolveReviewDecision", () => {
  it("stays paused while any draft is still held", () => {
    assert.equal(
      resolveReviewDecision({ heldCount: 2, acceptedCount: 1 }),
      "stay",
    );
    assert.equal(
      resolveReviewDecision({ heldCount: 1, acceptedCount: 0 }),
      "stay",
    );
  });

  it("resumes to publish once held clears with at least one accepted", () => {
    assert.equal(
      resolveReviewDecision({ heldCount: 0, acceptedCount: 3 }),
      "resume",
    );
    assert.equal(
      resolveReviewDecision({ heldCount: 0, acceptedCount: 1 }),
      "resume",
    );
  });

  it("rejects the run once held clears with nothing accepted", () => {
    assert.equal(
      resolveReviewDecision({ heldCount: 0, acceptedCount: 0 }),
      "reject",
    );
  });
});
