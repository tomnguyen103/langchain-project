import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runBrandSafety, type BrandJudge } from "./brand-safety";

const okJudge: BrandJudge = async () => ({ score: 0.95 });
const lowJudge: BrandJudge = async () => ({ score: 0.5 });
const throwingJudge: BrandJudge = async () => {
  throw new Error("model down");
};

const outOfRangeJudge: BrandJudge = async () => ({ score: 2 });

describe("runBrandSafety", () => {
  it("hard-blocks a draft containing a banned term", async () => {
    const [r] = await runBrandSafety(
      [{ text: "Buy our CompetitorX killer deal" }],
      { bannedTerms: ["competitorx"] },
      { judge: okJudge },
    );
    assert.equal(r.verdict, "block");
    assert.equal(r.score, 0);
    assert.ok(r.violations.some((v) => v.rule === "banned_term"));
  });

  it("passes a clean on-brand draft above threshold", async () => {
    const [r] = await runBrandSafety(
      [{ text: "Fresh roast, slow mornings." }],
      { voice: "warm, minimal", bannedTerms: [] },
      { judge: okJudge },
    );
    assert.equal(r.verdict, "pass");
    assert.equal(r.violations.length, 0);
    assert.ok(r.score >= 0.8);
  });

  it("holds a low-scoring draft for review", async () => {
    const [r] = await runBrandSafety([{ text: "meh" }], {}, { judge: lowJudge });
    assert.equal(r.verdict, "review");
  });

  it("fails closed to review when the judge throws (never a silent pass)", async () => {
    const [r] = await runBrandSafety(
      [{ text: "anything" }],
      {},
      { judge: throwingJudge },
    );
    assert.equal(r.verdict, "review");
    assert.equal(r.score, 0);
    assert.ok(r.violations.some((v) => v.rule === "policy"));
  });

  it("fails closed to review when the judge returns an out-of-range score", async () => {
    const [r] = await runBrandSafety(
      [{ text: "anything" }],
      {},
      { judge: outOfRangeJudge },
    );
    assert.equal(r.verdict, "review");
    assert.equal(r.score, 0);
    assert.ok(r.violations.some((v) => v.rule === "policy"));
  });

  it("downgrades a high-scoring draft to review when it leaks PII", async () => {
    const [r] = await runBrandSafety(
      [{ text: "DM us at founder@brand.com for a deal" }],
      {},
      { judge: okJudge },
    );
    assert.equal(r.verdict, "review");
    assert.ok(r.violations.some((v) => v.rule === "pii"));
  });

  it("reviews each draft independently and preserves locators", async () => {
    const results = await runBrandSafety(
      [
        { contentId: "a", platform: "instagram", text: "clean caption" },
        { contentId: "b", platform: "x", text: "bad competitorx" },
      ],
      { bannedTerms: ["competitorx"] },
      { judge: okJudge },
    );
    assert.equal(results.length, 2);
    assert.equal(results[0].verdict, "pass");
    assert.equal(results[0].contentId, "a");
    assert.equal(results[1].verdict, "block");
    assert.equal(results[1].platform, "x");
  });

  it("respects an explicit passThreshold override", async () => {
    const [strict] = await runBrandSafety(
      [{ text: "ok" }],
      {},
      { judge: okJudge, passThreshold: 0.99 },
    );
    assert.equal(strict.verdict, "review"); // 0.95 < 0.99
  });
});
