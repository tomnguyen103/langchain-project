import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Job, Queue } from "bullmq";

import { clearFinishedJob } from "./clear-finished-job";

function fakeJob(state: string, calls: string[]): Job {
  return {
    getState: async () => {
      calls.push(`getState:${state}`);
      return state;
    },
    remove: async () => {
      calls.push("remove");
    },
  } as unknown as Job;
}

function fakeQueue(job: Job | undefined, calls: string[]): Queue {
  return {
    getJob: async () => {
      calls.push("getJob");
      return job;
    },
  } as unknown as Queue;
}

describe("clearFinishedJob", () => {
  it("does nothing when no job exists under the id", async () => {
    const calls: string[] = [];
    await clearFinishedJob(fakeQueue(undefined, calls), "job-1");
    assert.deepEqual(calls, ["getJob"]);
  });

  it("removes a failed job so a retry can actually re-enqueue", async () => {
    // This is the confirmed bug: a deterministic job id + BullMQ's removeOnFail
    // retention meant re-adding under the same id after a final failure was a
    // silent no-op (BullMQ returns the old, dead job instead of scheduling new
    // work). Clearing it here is what makes the retry real.
    const calls: string[] = [];
    const job = fakeJob("failed", calls);
    await clearFinishedJob(fakeQueue(job, calls), "job-1");
    assert.deepEqual(calls, ["getJob", "getState:failed", "remove"]);
  });

  it("removes a completed job under the same id", async () => {
    const calls: string[] = [];
    const job = fakeJob("completed", calls);
    await clearFinishedJob(fakeQueue(job, calls), "job-1");
    assert.deepEqual(calls, ["getJob", "getState:completed", "remove"]);
  });

  it("leaves an in-flight job alone (waiting/delayed/active are legitimately pending)", async () => {
    for (const state of ["waiting", "delayed", "active"]) {
      const calls: string[] = [];
      const job = fakeJob(state, calls);
      await clearFinishedJob(fakeQueue(job, calls), "job-1");
      assert.deepEqual(calls, ["getJob", `getState:${state}`]); // no remove
    }
  });
});
