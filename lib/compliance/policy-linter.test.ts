import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasBlockingFinding, lintOrgRules, lintPolicy } from "./policy-linter";

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

  it("runs enabled industry packs", () => {
    const findings = lintPolicy(
      "linkedin",
      "This post includes a patient record from the case file.",
      [],
      ["healthcare"],
    );
    assert.ok(
      findings.some(
        (f) => f.rule === "healthcare_patient_privacy" && f.level === "block",
      ),
    );
  });

  it("does not run industry pack rules unless the pack is enabled", () => {
    const findings = lintPolicy(
      "linkedin",
      "This post includes a patient record from the case file.",
    );
    assert.ok(!findings.some((f) => f.rule === "healthcare_patient_privacy"));
  });
});

describe("lintOrgRules (Praxis Live)", () => {
  it("matches literal substrings, including punctuation terms like '#ad'", () => {
    // Word-boundary matching would MISS "#ad"; literal substring catches it.
    const findings = lintOrgRules("Check our #ad disclosure", [
      { term: "#ad", level: "warn" },
    ]);
    assert.ok(
      findings.some((f) => f.rule === "org_policy" && f.level === "warn"),
    );
  });

  it("is case-insensitive and matches multi-word phrases", () => {
    const findings = lintOrgRules("Our FLASH SALE ends today", [
      { term: "flash sale", level: "block" },
    ]);
    assert.ok(findings.some((f) => f.level === "block"));
  });

  it("over-matches substrings by design ('sale' also hits 'wholesale')", () => {
    const findings = lintOrgRules("our wholesale program", [
      { term: "sale", level: "warn" },
    ]);
    assert.ok(findings.some((f) => f.rule === "org_policy"));
  });

  it("flows through lintPolicy alongside the curated pack", () => {
    const findings = lintPolicy("x", "huge sale", [
      { term: "sale", level: "block" },
    ]);
    assert.ok(
      findings.some((f) => f.rule === "org_policy" && f.level === "block"),
    );
  });
});
