import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractComments, type WebhookPayload } from "./comments";

describe("extractComments — Facebook feed", () => {
  it("extracts an added comment with author, post id, and time", () => {
    const payload: WebhookPayload = {
      entry: [
        {
          id: "page-123",
          changes: [
            {
              field: "feed",
              value: {
                item: "comment",
                verb: "add",
                comment_id: "c-1",
                post_id: "page-123_post-9",
                message: "Love this!",
                from: { name: "Jane", id: "u-1" },
                created_time: 1_700_000_000,
              },
            },
          ],
        },
      ],
    };
    const [c] = extractComments(payload);
    assert.equal(c.platform, "facebook");
    assert.equal(c.accountExternalId, "page-123");
    assert.equal(c.externalCommentId, "c-1");
    assert.equal(c.externalPostId, "page-123_post-9");
    assert.equal(c.author, "Jane");
    assert.equal(c.text, "Love this!");
    assert.equal(c.createdAt.getTime(), 1_700_000_000 * 1000);
  });

  it("ignores non-comment feed changes (likes, edits, removes)", () => {
    const payload: WebhookPayload = {
      entry: [
        {
          id: "page-1",
          changes: [
            { field: "feed", value: { item: "like", verb: "add" } },
            {
              field: "feed",
              value: { item: "comment", verb: "remove", comment_id: "c-x" },
            },
            {
              field: "feed",
              value: { item: "comment", verb: "edited", comment_id: "c-y" },
            },
          ],
        },
      ],
    };
    assert.deepEqual(extractComments(payload), []);
  });

  it("falls back to the author id when name is absent", () => {
    const [c] = extractComments({
      entry: [
        {
          id: "p1",
          changes: [
            {
              field: "feed",
              value: {
                item: "comment",
                verb: "add",
                comment_id: "c2",
                from: { id: "u-77" },
              },
            },
          ],
        },
      ],
    });
    assert.equal(c.author, "u-77");
    assert.equal(c.text, ""); // missing message coerces to ""
  });
});

describe("extractComments — Instagram comments", () => {
  it("extracts an IG comment with username and media id", () => {
    const [c] = extractComments({
      entry: [
        {
          id: "ig-1",
          changes: [
            {
              field: "comments",
              value: {
                id: "ig-c-1",
                text: "🔥",
                from: { username: "acme", id: "ig-u-1" },
                media: { id: "ig-media-9" },
              },
            },
          ],
        },
      ],
    });
    assert.equal(c.platform, "instagram");
    assert.equal(c.externalCommentId, "ig-c-1");
    assert.equal(c.externalPostId, "ig-media-9");
    assert.equal(c.author, "acme");
    assert.equal(c.text, "🔥");
  });
});

describe("extractComments — robustness", () => {
  it("returns [] for an empty payload", () => {
    assert.deepEqual(extractComments({}), []);
  });

  it("skips entries without an id", () => {
    assert.deepEqual(
      extractComments({
        entry: [
          {
            changes: [
              {
                field: "feed",
                value: { item: "comment", verb: "add", comment_id: "c" },
              },
            ],
          },
        ],
      }),
      [],
    );
  });

  it("collects across multiple entries and changes", () => {
    const out = extractComments({
      entry: [
        {
          id: "p1",
          changes: [
            {
              field: "feed",
              value: { item: "comment", verb: "add", comment_id: "a" },
            },
          ],
        },
        {
          id: "ig",
          changes: [{ field: "comments", value: { id: "b" } }],
        },
      ],
    });
    assert.equal(out.length, 2);
    assert.deepEqual(
      out.map((c) => c.externalCommentId),
      ["a", "b"],
    );
  });
});
