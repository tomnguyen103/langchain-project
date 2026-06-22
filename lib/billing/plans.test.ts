import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PLAN_LIMITS } from "./plans";

describe("PLAN_LIMITS", () => {
  it("numeric limits never decrease across free → pro → premium", () => {
    const numeric = ["postsPerDay", "aiPerMonth", "accounts"] as const;
    for (const key of numeric) {
      assert.ok(
        PLAN_LIMITS.free[key] <= PLAN_LIMITS.pro[key],
        `${key}: free (${PLAN_LIMITS.free[key]}) must be <= pro (${PLAN_LIMITS.pro[key]})`,
      );
      assert.ok(
        PLAN_LIMITS.pro[key] <= PLAN_LIMITS.premium[key],
        `${key}: pro (${PLAN_LIMITS.pro[key]}) must be <= premium (${PLAN_LIMITS.premium[key]})`,
      );
    }
  });

  it("paid plans unlock research + auto-reply; free does not", () => {
    assert.equal(PLAN_LIMITS.free.research, false);
    assert.equal(PLAN_LIMITS.free.autoReply, false);
    assert.equal(PLAN_LIMITS.pro.research, true);
    assert.equal(PLAN_LIMITS.pro.autoReply, true);
    assert.equal(PLAN_LIMITS.premium.research, true);
    assert.equal(PLAN_LIMITS.premium.autoReply, true);
  });
});
