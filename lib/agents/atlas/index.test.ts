import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NewPostTarget } from "@/db/schema";

import { createAtlas } from "./index";

describe("atlas agent", () => {
  it("builds one post + per-platform targets from accepted drafts and schedules each", async () => {
    const enqueued: string[] = [];
    const stamped: string[] = [];
    const atlas = createAtlas({
      getGeneratedContentByIds: async (ids) => {
        assert.deepEqual(ids, ["c1", "c2", "c3"]);
        return [
          { id: "c1", platform: "instagram", content: "IG body" },
          { id: "c2", platform: "x", content: "X body" },
          { id: "c3", platform: "tiktok", content: "no active account" },
        ];
      },
      listSocialAccounts: async () => [
        { id: "acc-ig", platform: "instagram", status: "active" },
        { id: "acc-x", platform: "x", status: "active" },
        { id: "acc-tt", platform: "tiktok", status: "expired" }, // inactive → skipped
      ],
      createPostWithTargets: async (input) => {
        assert.equal(input.post.status, "scheduled");
        assert.equal(input.post.sourceContentId, "c1");
        assert.equal(input.targets.length, 2); // tiktok dropped (no active account)
        return {
          id: "post-1",
          targets: input.targets.map((_t, i) => ({
            id: `t${i}`,
            postId: "post-1",
          })),
        };
      },
      getPostTarget: async () => undefined,
      enqueuePublish: async ({ postTargetId }) => {
        enqueued.push(postTargetId);
        return `job_${postTargetId}`;
      },
      updatePostTarget: async (id) => {
        stamped.push(id);
      },
      recomputePostStatus: async () => "scheduled",
    });

    const result = await atlas.run(
      { acceptedContentIds: ["c1", "c2", "c3"] },
      { clerkUserId: "user-1", runId: "run-1" },
    );

    assert.deepEqual(enqueued, ["t0", "t1"]);
    assert.deepEqual(stamped, ["t0", "t1"]);
    assert.deepEqual(result.summary, { scheduled: 2 });
    assert.equal(result.handoff, undefined); // terminal — no forward handoff in A1
  });

  it("marks a target failed (and does not throw) when its enqueue fails", async () => {
    const updates: Array<{ id: string; data: Partial<NewPostTarget> }> = [];
    let recomputed = 0;
    const atlas = createAtlas({
      getGeneratedContentByIds: async () => [
        { id: "c1", platform: "instagram", content: "b" },
      ],
      listSocialAccounts: async () => [
        { id: "acc", platform: "instagram", status: "active" },
      ],
      createPostWithTargets: async () => ({
        id: "p1",
        targets: [{ id: "t0", postId: "p1" }],
      }),
      getPostTarget: async () => undefined,
      enqueuePublish: async () => {
        throw new Error("redis down");
      },
      updatePostTarget: async (id, data) => {
        updates.push({ id, data });
      },
      recomputePostStatus: async () => {
        recomputed += 1;
        return "draft";
      },
    });

    const result = await atlas.run(
      { acceptedContentIds: ["c1"] },
      { clerkUserId: "u", runId: "r" },
    );

    assert.deepEqual(result.summary, { scheduled: 0 });
    assert.equal(updates.length, 1);
    assert.equal(updates[0].data.status, "failed");
    assert.equal(recomputed, 1);
  });

  it("schedules explicit postTargetIds directly without building a post", async () => {
    const enqueued: string[] = [];
    const atlas = createAtlas({
      getGeneratedContentByIds: async () => {
        throw new Error("should not be called");
      },
      listSocialAccounts: async () => {
        throw new Error("should not be called");
      },
      createPostWithTargets: async () => {
        throw new Error("should not be called");
      },
      getPostTarget: async (id) => ({ id, postId: `post_${id}` }),
      enqueuePublish: async ({ postTargetId }) => {
        enqueued.push(postTargetId);
        return "job";
      },
      updatePostTarget: async () => {},
      recomputePostStatus: async () => undefined,
    });

    const result = await atlas.run(
      { postTargetIds: ["a", "b"] },
      { clerkUserId: "u", runId: "r" },
    );

    assert.deepEqual(enqueued, ["a", "b"]);
    assert.deepEqual(result.summary, { scheduled: 2 });
  });
});
