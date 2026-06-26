import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyFailure,
  classifyPublishTargetFailure,
  decidePublishTargetRecovery,
  decideRecovery,
} from "./recovery";

describe("classifyFailure", () => {
  it("classifies token/permission errors as account (no retry)", () => {
    assert.equal(classifyFailure(new Error("401 Unauthorized")), "account");
    assert.equal(classifyFailure(new Error("token expired, reconnect")), "account");
    assert.equal(
      classifyFailure(new Error("Account inactive — reconnect it to publish.")),
      "account",
    );
  });

  it("classifies network/rate-limit blips as transient", () => {
    assert.equal(classifyFailure(new Error("ETIMEDOUT")), "transient");
    assert.equal(classifyFailure(new Error("fetch failed")), "transient");
    assert.equal(classifyFailure(new Error("503 Service Unavailable")), "transient");
    assert.equal(classifyFailure(new Error("rate limit exceeded")), "transient");
    assert.equal(classifyFailure("Redis connection lost"), "transient");
  });

  it("classifies unknown errors as fatal (fail fast, don't optimistically retry)", () => {
    assert.equal(classifyFailure(new Error("invalid job payload")), "fatal");
    assert.equal(classifyFailure(new Error("cannot read property x of undefined")), "fatal");
    assert.equal(classifyFailure(undefined), "fatal");
  });
});

describe("decideRecovery", () => {
  it("retries a transient failure while attempts remain", () => {
    const d = decideRecovery({
      error: new Error("ETIMEDOUT"),
      attempt: 1,
      maxAttempts: 3,
    });
    assert.equal(d.action, "retry");
    assert.equal(d.failureClass, "transient");
  });

  it("fails fast on an account error even on the first attempt", () => {
    const d = decideRecovery({
      error: new Error("401 unauthorized"),
      attempt: 1,
      maxAttempts: 3,
    });
    assert.equal(d.action, "fail");
    assert.equal(d.failureClass, "account");
  });

  it("fails fast on a fatal error", () => {
    const d = decideRecovery({
      error: new Error("bad payload"),
      attempt: 1,
      maxAttempts: 3,
    });
    assert.equal(d.action, "fail");
    assert.equal(d.failureClass, "fatal");
  });

  it("fails a transient error once the budget is exhausted", () => {
    const d = decideRecovery({
      error: new Error("ETIMEDOUT"),
      attempt: 3,
      maxAttempts: 3,
    });
    assert.equal(d.action, "fail");
    assert.equal(d.failureClass, "transient");
    assert.match(d.reason, /exhausted/);
  });
});

describe("classifyPublishTargetFailure", () => {
  it("classifies inactive account state as account even without an error message", () => {
    assert.equal(
      classifyPublishTargetFailure({
        error: "publish failed",
        accountStatus: "expired",
      }),
      "account",
    );
  });

  it("classifies media and platform constraint messages", () => {
    assert.equal(
      classifyPublishTargetFailure({
        error: new Error("Instagram requires an image to publish."),
      }),
      "media_constraint",
    );
    assert.equal(
      classifyPublishTargetFailure({
        error: new Error("Caption is too long for X (max 280 chars)."),
      }),
      "media_constraint",
    );
  });

  it("classifies policy or app-review restrictions separately from transient failures", () => {
    assert.equal(
      classifyPublishTargetFailure({
        error: new Error("TikTok app review required before public publishing"),
      }),
      "policy_platform",
    );
  });

  it("keeps rate limits and network errors retryable", () => {
    assert.equal(
      classifyPublishTargetFailure({
        error: new Error("429 rate limit exceeded"),
      }),
      "transient",
    );
  });
});

describe("decidePublishTargetRecovery", () => {
  it("allows retry only for failed transient targets under the manual retry cap", () => {
    const decision = decidePublishTargetRecovery({
      error: new Error("503 Service Unavailable"),
      status: "failed",
      attemptCount: 4,
    });
    assert.equal(decision.action, "retry");
    assert.equal(decision.canRetry, true);
  });

  it("does not retry account, media, policy, or unknown failures", () => {
    for (const error of [
      "401 unauthorized",
      "YouTube requires a video to publish.",
      "platform rejected due to policy",
      "unexpected invariant failure",
    ]) {
      const decision = decidePublishTargetRecovery({
        error,
        status: "failed",
        attemptCount: 1,
      });
      assert.equal(decision.canRetry, false, error);
    }
  });

  it("does not retry a transient target past the manual retry cap", () => {
    const decision = decidePublishTargetRecovery({
      error: "timeout",
      status: "failed",
      attemptCount: 8,
    });
    assert.equal(decision.failureClass, "transient");
    assert.equal(decision.canRetry, false);
    assert.match(decision.reason, /manual retry limit/);
  });
});
