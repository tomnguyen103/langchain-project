import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasBlockingFinding, lintPolicy } from "./policy-linter";

describe("lintPolicy", () => {
  it("passes a clean caption with no findings", () => {
    const findings = lintPolicy("instagram", "Behind the scenes of today's shoot.");
    assert.deepEqual(findings, []);
  });

  it("blocks absolute guarantees", () => {
    const findings = lintPolicy("x", "Results guaranteed or your money back!");
    const f = findings.find((x) => x.rule === "absolute_claim");
    assert.ok(f);
    assert.equal(f.level, "block");
    assert.ok(hasBlockingFinding(findings));
  });

  it("blocks medical cure claims", () => {
    const findings = lintPolicy("facebook", "This serum cures acne overnight.");
    assert.ok(findings.some((f) => f.rule === "health_claim" && f.level === "block"));
  });

  it("blocks get-rich financial claims", () => {
    const findings = lintPolicy("linkedin", "Double your investment in 30 days.");
    assert.ok(findings.some((f) => f.rule === "financial_claim" && f.level === "block"));
  });

  it("warns on engagement bait without blocking", () => {
    const findings = lintPolicy("instagram", "Like and share to enter!");
    const f = findings.find((x) => x.rule === "engagement_bait");
    assert.ok(f);
    assert.equal(f.level, "warn");
    assert.equal(hasBlockingFinding(findings), false);
  });

  it("warns about outbound links on link-averse platforms (LinkedIn)", () => {
    const findings = lintPolicy("linkedin", "Read more at https://example.com/post");
    assert.ok(findings.some((f) => f.rule === "outbound_link" && f.level === "warn"));
  });

  it("does NOT flag outbound links on platforms where they're fine (Facebook)", () => {
    const findings = lintPolicy("facebook", "Read more at https://example.com/post");
    assert.ok(!findings.some((f) => f.rule === "outbound_link"));
  });

  it("skips platform-scoped rules when platform is unknown", () => {
    const findings = lintPolicy(null, "Read more at https://example.com/post");
    assert.ok(!findings.some((f) => f.rule === "outbound_link"));
  });

  it("still applies platform-agnostic rules when platform is unknown", () => {
    const findings = lintPolicy(null, "100% effective, risk-free!");
    assert.ok(findings.some((f) => f.rule === "absolute_claim"));
  });

  it("is case-insensitive", () => {
    const findings = lintPolicy("x", "GUARANTEED winner");
    assert.ok(findings.some((f) => f.rule === "absolute_claim"));
  });
});
