import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isWatchDue,
  nextWatchRunAt,
  researchSourceStatus,
  watchPeriodKey,
} from "./watches";

describe("research watch scheduling", () => {
  it("computes the next daily and weekly 9am UTC runs", () => {
    const from = new Date("2026-06-26T18:30:10Z");

    assert.equal(
      nextWatchRunAt("daily", from).toISOString(),
      "2026-06-27T09:00:00.000Z",
    );
    assert.equal(
      nextWatchRunAt("weekly", from).toISOString(),
      "2026-07-03T09:00:00.000Z",
    );
  });

  it("only treats active due watches as runnable", () => {
    const now = new Date("2026-06-26T12:00:00Z");

    assert.equal(
      isWatchDue({ status: "active", nextRunAt: new Date("2026-06-26T11:00:00Z") }, now),
      true,
    );
    assert.equal(
      isWatchDue({ status: "paused", nextRunAt: new Date("2026-06-26T11:00:00Z") }, now),
      false,
    );
    assert.equal(
      isWatchDue({ status: "active", nextRunAt: new Date("2026-06-26T13:00:00Z") }, now),
      false,
    );
  });

  it("degrades web research visibly when Tavily is missing", () => {
    assert.equal(researchSourceStatus("web", false), "model-only");
    assert.equal(researchSourceStatus("auto", true), "web");
    assert.equal(researchSourceStatus("model_only", true), "model-only");
  });

  it("builds daily and weekly period keys for dedupe", () => {
    const date = new Date("2026-06-26T18:30:00Z");

    assert.equal(watchPeriodKey("daily", date), "2026-06-26");
    assert.equal(watchPeriodKey("weekly", date), "2026-06-22");
  });
});
