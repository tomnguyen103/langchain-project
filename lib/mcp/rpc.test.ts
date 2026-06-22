import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRpcRequest, parseRpcResult } from "./rpc";

describe("mcp json-rpc", () => {
  it("builds a JSON-RPC 2.0 request", () => {
    assert.deepEqual(buildRpcRequest("tools/list", {}, 1), {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
  });

  it("extracts the result", () => {
    assert.deepEqual(
      parseRpcResult<{ tools: string[] }>({
        jsonrpc: "2.0",
        id: 1,
        result: { tools: ["a"] },
      }),
      { tools: ["a"] },
    );
  });

  it("throws on an error envelope", () => {
    assert.throws(() => parseRpcResult({ error: { message: "boom" } }), /boom/);
  });

  it("throws on a missing result", () => {
    assert.throws(
      () => parseRpcResult({ jsonrpc: "2.0", id: 1 }),
      /missing result/,
    );
  });
});
