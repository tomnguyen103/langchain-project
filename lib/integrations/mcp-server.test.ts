import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMcpResponse, SOCIALFLOW_MCP_TOOLS } from "./mcp-server";

describe("MCP server helpers", () => {
  it("lists only read-only campaign tools", () => {
    const response = buildMcpResponse({
      id: 1,
      method: "tools/list",
      campaigns: [],
    });

    assert.deepEqual(response.result, { tools: SOCIALFLOW_MCP_TOOLS });
    assert.equal(SOCIALFLOW_MCP_TOOLS[0].name, "socialflow.list_campaigns");
  });

  it("returns campaigns from the read-only tool call", () => {
    const response = buildMcpResponse({
      id: 2,
      method: "tools/call",
      params: { name: "socialflow.list_campaigns" },
      campaigns: [
        {
          id: "campaign-1",
          name: "Launch",
          brief: "Brief",
          status: "draft",
          platforms: ["linkedin"],
          templateKey: null,
          createdAt: "2026-06-26T12:00:00.000Z",
          updatedAt: "2026-06-26T12:00:00.000Z",
          sources: [],
          experiments: [],
          attribution: [],
        },
      ],
    });

    const result = response.result as {
      content: Array<{ type: string; text: string }>;
    };
    assert.equal(result.content[0]?.type, "text");
    assert.match(result.content[0]?.text ?? "", /campaign-1/);
  });
});
