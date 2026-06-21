import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PostTarget } from "@/db/schema";
import { derivePostStatus } from "./status";

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
