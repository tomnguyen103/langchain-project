import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enqueueWithLedger } from "./with-ledger";

describe("enqueueWithLedger", () => {
  it("records, enqueues, and returns the enqueue result on success", async () => {
    const calls: string[] = [];
    const result = await enqueueWithLedger({
      record: async () => {
        calls.push("record");
      },
      enqueue: async () => {
        calls.push("enqueue");
        return "job-1";
      },
      rollback: async () => {
        calls.push("rollback");
      },
    });
    assert.equal(result, "job-1");
    assert.deepEqual(calls, ["record", "enqueue"]); // rollback not called
  });

  it("rolls back the ledger and rethrows when the enqueue fails", async () => {
    const calls: string[] = [];
    const boom = new Error("queue add failed");
    await assert.rejects(
      enqueueWithLedger({
        record: async () => {
          calls.push("record");
        },
        enqueue: async () => {
          calls.push("enqueue");
          throw boom;
        },
        rollback: async () => {
          calls.push("rollback");
        },
      }),
      boom,
    );
    assert.deepEqual(calls, ["record", "enqueue", "rollback"]);
  });

  it("does not roll back if recording itself fails", async () => {
    const calls: string[] = [];
    await assert.rejects(
      enqueueWithLedger({
        record: async () => {
          calls.push("record");
          throw new Error("ledger write failed");
        },
        enqueue: async () => {
          calls.push("enqueue");
          return 1;
        },
        rollback: async () => {
          calls.push("rollback");
        },
      }),
      /ledger write failed/,
    );
    assert.deepEqual(calls, ["record"]); // never enqueued, nothing to roll back
  });

  it("surfaces the original enqueue error even if rollback also throws", async () => {
    await assert.rejects(
      enqueueWithLedger({
        record: async () => {},
        enqueue: async () => {
          throw new Error("original");
        },
        rollback: async () => {
          throw new Error("rollback also failed");
        },
      }),
      /original/,
    );
  });
});
