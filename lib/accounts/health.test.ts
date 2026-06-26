import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateAccountHealth } from "./health";

const now = new Date("2026-06-26T12:00:00.000Z");

describe("evaluateAccountHealth", () => {
  it("marks inactive accounts as critical", () => {
    const health = evaluateAccountHealth(
      { platform: "instagram", status: "expired" },
      now,
    );
    assert.equal(health.status, "critical");
    assert.equal(health.issues[0]?.code, "account_inactive");
  });

  it("marks expired tokens as critical", () => {
    const health = evaluateAccountHealth(
      {
        platform: "youtube",
        status: "active",
        refreshToken: "refresh",
        tokenExpiresAt: new Date("2026-06-26T11:59:00.000Z"),
      },
      now,
    );
    assert.equal(health.status, "critical");
    assert.ok(health.issues.some((issue) => issue.code === "token_expired"));
  });

  it("warns about soon-expiring tokens", () => {
    const health = evaluateAccountHealth(
      {
        platform: "linkedin",
        status: "active",
        tokenExpiresAt: new Date("2026-06-27T12:00:00.000Z"),
      },
      now,
    );
    assert.equal(health.status, "warning");
    assert.equal(health.issues[0]?.code, "token_expires_soon");
  });

  it("flags missing refresh tokens only for refreshable providers", () => {
    const youtube = evaluateAccountHealth(
      {
        platform: "youtube",
        status: "active",
        tokenExpiresAt: new Date("2026-07-26T12:00:00.000Z"),
      },
      now,
    );
    assert.ok(youtube.issues.some((issue) => issue.code === "missing_refresh_token"));

    const linkedin = evaluateAccountHealth(
      {
        platform: "linkedin",
        status: "active",
        tokenExpiresAt: new Date("2026-07-26T12:00:00.000Z"),
      },
      now,
    );
    assert.ok(!linkedin.issues.some((issue) => issue.code === "missing_refresh_token"));
  });

  it("flags missing required scopes when scopes are known", () => {
    const health = evaluateAccountHealth(
      {
        platform: "tiktok",
        status: "active",
        scopes: ["user.info.basic"],
      },
      now,
    );
    assert.equal(health.status, "critical");
    assert.ok(health.issues.some((issue) => issue.code === "missing_scope"));
  });

  it("returns healthy when local state has no findings", () => {
    const health = evaluateAccountHealth(
      {
        platform: "facebook",
        status: "active",
        scopes: ["pages_manage_posts"],
      },
      now,
    );
    assert.equal(health.status, "healthy");
    assert.deepEqual(health.issues, []);
  });
});
