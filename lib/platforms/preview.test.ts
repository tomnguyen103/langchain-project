import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzePreview } from "./preview";

describe("analyzePreview", () => {
  it("counts characters and reports headroom within the limit", () => {
    const a = analyzePreview("x", "hello");
    assert.equal(a.charCount, 5);
    assert.equal(a.maxLength, 280);
    assert.equal(a.overBy, 0);
    assert.equal(a.warnings.length, 0);
  });

  it("flags an over-limit body and reports the overflow", () => {
    const a = analyzePreview("x", "a".repeat(300));
    assert.equal(a.overBy, 20);
    const err = a.warnings.find((w) => w.level === "error");
    assert.ok(err);
    assert.match(err.message, /20 characters over the 280 limit/);
  });

  it("suggests a thread split for long X posts (ceil of length/280)", () => {
    const a = analyzePreview("x", "a".repeat(300));
    assert.equal(a.threadParts, 2);
    assert.ok(a.warnings.some((w) => /2-tweet thread/.test(w.message)));
  });

  it("does not suggest a thread when within one tweet", () => {
    const a = analyzePreview("x", "a".repeat(200));
    assert.equal(a.threadParts, null);
  });

  it("computes the in-feed fold for Instagram (125 chars)", () => {
    const a = analyzePreview("instagram", "x".repeat(200), 1);
    assert.equal(a.foldAt, 125);
    assert.equal(a.hiddenByFold, 75);
    assert.ok(a.warnings.some((w) => /75 characters hidden behind/.test(w.message)));
  });

  it("requires media for media-first platforms", () => {
    const a = analyzePreview("instagram", "nice caption", 0);
    assert.ok(
      a.warnings.some(
        (w) => w.level === "error" && /requires at least one image/.test(w.message),
      ),
    );
  });

  it("does not warn about media when media is attached", () => {
    const a = analyzePreview("instagram", "nice caption", 2);
    assert.ok(!a.warnings.some((w) => /requires at least one image/.test(w.message)));
  });

  it("does not double-warn fold when already over the hard limit", () => {
    // Pinterest: max 500, fold 60. A 600-char body is over-limit; the fold hint
    // is suppressed so the user sees the actionable error, not both.
    const a = analyzePreview("pinterest", "x".repeat(600), 1);
    assert.ok(a.overBy > 0);
    assert.ok(!a.warnings.some((w) => /hidden behind/.test(w.message)));
  });

  it("has no fold for platforms that don't truncate (Discord)", () => {
    const a = analyzePreview("discord", "x".repeat(1500));
    assert.equal(a.foldAt, null);
    assert.equal(a.hiddenByFold, 0);
  });

  it("singularizes the over-by message for exactly one character", () => {
    const a = analyzePreview("x", "a".repeat(281));
    const err = a.warnings.find((w) => w.level === "error");
    assert.ok(err);
    assert.match(err.message, /1 character over/);
  });
});
