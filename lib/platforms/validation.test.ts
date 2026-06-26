import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Platform } from "@/db/schema";
import {
  PLATFORM_PUBLISH_RULES,
  dedupeValidationIssues,
  firstBlockingIssue,
  hasBlockingIssues,
  validatePlatformDraft,
  validatePublishRequest,
} from "./validation";

const media = (type: "image" | "video" | "gif") => ({ type });

describe("PLATFORM_PUBLISH_RULES", () => {
  it("stays aligned with registered connector publish capabilities", async () => {
    process.env.SKIP_ENV_VALIDATION = "true";
    process.env.ENCRYPTION_KEY =
      "test-encryption-key-with-at-least-32-chars";
    const { getConnector, registeredPlatforms } = await import("./registry");

    for (const platform of registeredPlatforms()) {
      const rule = PLATFORM_PUBLISH_RULES[platform];
      const caps = getConnector(platform).capabilities;
      assert.equal(rule.maxBodyLength, caps.maxBodyLength, platform);
      assert.deepEqual(rule.media, caps.media, platform);
      assert.equal(rule.supportsComments, caps.supportsComments, platform);
      assert.equal(Boolean(rule.supportsMetrics), Boolean(caps.supportsMetrics), platform);
    }
  });
});

describe("validatePlatformDraft", () => {
  it("requires images for image-only media platforms", () => {
    const issues = validatePlatformDraft({
      platform: "instagram",
      body: "caption",
      media: [],
    });
    assert.equal(firstBlockingIssue(issues)?.code, "image_required");
  });

  it("requires videos for TikTok and YouTube", () => {
    for (const platform of ["tiktok", "youtube"] satisfies Platform[]) {
      const issues = validatePlatformDraft({
        platform,
        body: "caption",
        media: [media("image")],
      });
      assert.ok(issues.some((issue) => issue.code === "video_required"), platform);
      assert.ok(issues.some((issue) => issue.code === "unsupported_media"), platform);
    }
  });

  it("blocks over-limit captions with the same issue code for every caller", () => {
    const issues = validatePlatformDraft({
      platform: "x",
      body: "x".repeat(281),
      media: [],
    });
    assert.equal(firstBlockingIssue(issues)?.code, "body_too_long");
    assert.match(firstBlockingIssue(issues)?.message ?? "", /max 280 chars/);
  });

  it("blocks media-only posts for text-only connectors", () => {
    const issues = validatePlatformDraft({
      platform: "linkedin",
      body: "",
      media: [media("image")],
    });
    assert.ok(issues.some((issue) => issue.code === "body_required"));
    assert.ok(issues.some((issue) => issue.code === "unsupported_media"));
  });

  it("warns about connector capability gaps without blocking scheduling", () => {
    const issues = validatePlatformDraft({
      platform: "linkedin",
      body: "A short post",
      media: [],
    });
    assert.equal(hasBlockingIssues(issues), false);
    assert.ok(issues.some((issue) => issue.code === "comments_unsupported"));
    assert.ok(issues.some((issue) => issue.code === "metrics_unsupported"));
  });

  it("blocks inactive accounts before a worker can fail later", () => {
    const issues = validatePlatformDraft({
      platform: "facebook",
      body: "A short post",
      media: [],
      accountStatus: "expired",
    });
    assert.equal(firstBlockingIssue(issues)?.code, "account_inactive");
  });
});

describe("validatePublishRequest", () => {
  it("uses the same issue object shape for server and composer validation", () => {
    const issues = validatePublishRequest({
      accounts: [{ platform: "x", status: "active" }],
      bodyByPlatform: { x: "x".repeat(281) },
      media: [],
    });
    assert.equal(firstBlockingIssue(issues)?.code, "body_too_long");
  });

  it("dedupes repeated platform issues from multiple selected accounts", () => {
    const issues = dedupeValidationIssues(
      validatePublishRequest({
        accounts: [
          { platform: "x", status: "active" },
          { platform: "x", status: "active" },
        ],
        bodyByPlatform: { x: "x".repeat(281) },
        media: [],
      }),
    );
    assert.equal(
      issues.filter((issue) => issue.code === "body_too_long").length,
      1,
    );
  });
});
