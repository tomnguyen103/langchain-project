import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextAfterCursor } from "./_meta-graph";

describe("nextAfterCursor (Graph pagination)", () => {
  it("prefers cursors.after when present", () => {
    assert.equal(
      nextAfterCursor({ cursors: { after: "CUR123" }, next: "https://x/?after=URL" }),
      "CUR123",
    );
  });

  it("falls back to the after param in the next URL when cursors.after is missing", () => {
    assert.equal(
      nextAfterCursor({ next: "https://graph.facebook.com/v21.0/x/comments?after=NEXTCUR" }),
      "NEXTCUR",
    );
  });

  it("returns undefined when next has no after param (genuine end)", () => {
    assert.equal(
      nextAfterCursor({ next: "https://graph.facebook.com/v21.0/x?until=123" }),
      undefined,
    );
  });

  it("returns undefined when there is no paging", () => {
    assert.equal(nextAfterCursor(undefined), undefined);
    assert.equal(nextAfterCursor({}), undefined);
  });
});
