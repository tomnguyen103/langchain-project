import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyFailure, decideRecovery } from "./recovery";

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
