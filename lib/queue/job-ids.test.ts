import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  commentPollSchedulerId,
  commentReplyJobId,
  publishJobId,
  researchJobId,
} from "./job-ids";

describe("job-ids", () => {
  it("publishJobId is deterministic and stable per target", () => {
    assert.equal(publishJobId("t-1"), "publish:t-1");
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
      "publish:abc",
      "research:abc",
      "comment-poll:abc",
      "reply:abc",
    ]);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("distinct targets get distinct ids", () => {
    assert.notEqual(publishJobId("a"), publishJobId("b"));
  });
});
