import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { auditVariantConsistency } from "./consistency";

const draft = (id: string, platform: string, content: string) => ({
  id,
  platform,
  content,
});

function rulesFor(id: string, drafts: ReturnType<typeof draft>[]) {
  return (auditVariantConsistency(drafts).get(id) ?? []).map((f) => f.rule);
}

describe("auditVariantConsistency", () => {
  it("blocks price drift across platform variants", () => {
    const drafts = [
      draft("ig", "instagram", "Launch price is $99 today."),
      draft("x", "x", "Launch price is $79 today."),
    ];

    assert.ok(rulesFor("ig", drafts).includes("consistency_price_drift"));
    assert.ok(rulesFor("x", drafts).includes("consistency_price_drift"));
    assert.equal(
      auditVariantConsistency(drafts).get("ig")?.[0]?.level,
      "block",
    );
  });

  it("blocks date drift across platform variants", () => {
    const drafts = [
      draft("li", "linkedin", "Webinar starts on June 30."),
      draft("fb", "facebook", "Webinar starts on July 1."),
    ];

    assert.ok(rulesFor("li", drafts).includes("consistency_date_drift"));
  });

  it("warns on link drift without blocking", () => {
    const drafts = [
      draft("li", "linkedin", "Read more at https://example.com/a."),
      draft("fb", "facebook", "Read more at https://example.com/b."),
    ];
    const finding = auditVariantConsistency(drafts).get("li")?.[0];

    assert.equal(finding?.rule, "consistency_url_drift");
    assert.equal(finding?.level, "warn");
  });

  it("blocks variants missing a disclosure present elsewhere", () => {
    const drafts = [
      draft("ig", "instagram", "#ad New launch."),
      draft("x", "x", "New launch."),
    ];

    assert.deepEqual(rulesFor("ig", drafts), []);
    assert.deepEqual(rulesFor("x", drafts), [
      "consistency_disclosure_missing",
    ]);
  });

  it("returns no findings for matching variants", () => {
    const findings = auditVariantConsistency([
      draft("ig", "instagram", "#ad Launch is $99 on 6/30. https://x.test"),
      draft("fb", "facebook", "#ad Launch is $99 on 6/30. https://x.test"),
    ]);

    assert.equal(findings.size, 0);
  });
});
