import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapRunStatusToTaskState, parseA2aRequest } from "./protocol";

describe("a2a protocol", () => {
  it("maps run status to A2A task state", () => {
    assert.equal(mapRunStatusToTaskState("awaiting_approval"), "input-required");
    assert.equal(mapRunStatusToTaskState("completed"), "completed");
    assert.equal(mapRunStatusToTaskState("failed"), "failed");
    assert.equal(mapRunStatusToTaskState("running"), "working");
    assert.equal(mapRunStatusToTaskState("rejected"), "canceled");
  });

  it("parses message/send text + platforms (dropping non-strings)", () => {
    const parsed = parseA2aRequest({
      jsonrpc: "2.0",
      id: 7,
      method: "message/send",
      params: {
        message: { parts: [{ text: "launch coffee campaign" }] },
        platforms: ["instagram", 5],
      },
    });
    assert.equal(parsed.method, "message/send");
    if (parsed.method === "message/send") {
      assert.equal(parsed.id, 7);
      assert.equal(parsed.text, "launch coffee campaign");
      assert.deepEqual(parsed.platforms, ["instagram"]);
    }
  });

  it("parses tasks/get", () => {
    const parsed = parseA2aRequest({
      id: 1,
      method: "tasks/get",
      params: { id: "run-9" },
    });
    assert.equal(parsed.method, "tasks/get");
    if (parsed.method === "tasks/get") assert.equal(parsed.taskId, "run-9");
  });

  it("flags unsupported methods", () => {
    assert.equal(parseA2aRequest({ method: "frobnicate" }).method, "unsupported");
  });
});
