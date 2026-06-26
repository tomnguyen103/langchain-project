import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isEvergreenDue,
  nextEvergreenRunAt,
  selectEvergreenSource,
} from "./automation";

describe("evergreen automation", () => {
  it("computes next weekly and monthly run times", () => {
    const from = new Date("2026-06-26T18:30:00Z");
    assert.equal(
      nextEvergreenRunAt("weekly", from).toISOString(),
      "2026-07-03T10:00:00.000Z",
    );
    assert.equal(
      nextEvergreenRunAt("monthly", from).toISOString(),
      "2026-07-26T10:00:00.000Z",
    );
  });

  it("selects the first winner that passes filters", () => {
    const source = selectEvergreenSource(
      [
        { targetId: "old", platform: "x", engagementSum: 99 },
        { targetId: "ok", platform: "linkedin", engagementSum: 50 },
      ],
      {
        minEngagement: 10,
        platforms: ["linkedin"],
        lastSourceTargetId: "old",
      },
    );
    assert.equal(source?.targetId, "ok");
  });

  it("only treats enabled due preferences as runnable", () => {
    const now = new Date("2026-06-26T12:00:00Z");
    assert.equal(
      isEvergreenDue({ enabled: true, nextRunAt: new Date("2026-06-26T11:00:00Z") }, now),
      true,
    );
    assert.equal(
      isEvergreenDue({ enabled: false, nextRunAt: new Date("2026-06-26T11:00:00Z") }, now),
      false,
    );
  });
});
