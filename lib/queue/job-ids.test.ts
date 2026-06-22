import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  agentStepJobId,
  commentPollSchedulerId,
  commentReplyJobId,
  publishJobId,
  researchJobId,
  seedingSchedulerId,
} from "./job-ids";

describe("job-ids", () => {
  it("publishJobId is deterministic and stable per target", () => {
    assert.equal(publishJobId("t-1"), "publish_t-1");
    assert.equal(publishJobId("t-1"), publishJobId("t-1"));
  });

  it("each builder uses its own prefix (no cross-queue collisions)", () => {
    const id = "abc";
    const ids = [
      publishJobId(id),
      researchJobId(id),
      commentPollSchedulerId(id),
      commentReplyJobId(id),
    ];
    assert.deepEqual(ids, [
      "publish_abc",
      "research_abc",
      "comment-poll_abc",
      "reply_abc",
    ]);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("distinct targets get distinct ids", () => {
    assert.notEqual(publishJobId("a"), publishJobId("b"));
  });

  it("agentStepJobId is deterministic per (run, agent) and distinguishes hops", () => {
    assert.equal(agentStepJobId("run-1", "vega"), "agent-step_run-1_vega");
    assert.equal(agentStepJobId("run-1", "vega"), agentStepJobId("run-1", "vega"));
    assert.notEqual(agentStepJobId("run-1", "vega"), agentStepJobId("run-1", "lyra"));
    assert.notEqual(agentStepJobId("run-1", "vega"), agentStepJobId("run-2", "vega"));
  });

  it("seedingSchedulerId is deterministic per account (idempotent upsert key)", () => {
    assert.equal(seedingSchedulerId("acc-1"), "seeding_acc-1");
    assert.equal(seedingSchedulerId("acc-1"), seedingSchedulerId("acc-1"));
    assert.notEqual(seedingSchedulerId("acc-1"), seedingSchedulerId("acc-2"));
  });
});
