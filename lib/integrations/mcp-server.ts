import type { PublicCampaign } from "./public-campaigns";

export const MCP_PROTOCOL_VERSION = "2024-11-05";

export const SOCIALFLOW_MCP_TOOLS = [
  {
    name: "socialflow.list_campaigns",
    description:
      "List SocialFlow campaigns, summaries, experiments, and attribution metrics.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
] as const;

export type McpResponse = {
  jsonrpc: "2.0";
  id: unknown;
  result?: unknown;
  error?: { code: number; message: string };
};

export function buildMcpResponse(args: {
  id: unknown;
  method: string;
  campaigns: PublicCampaign[];
  params?: unknown;
}): McpResponse {
  switch (args.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: args.id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "socialflow", version: "1.0.0" },
        },
      };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: args.id,
        result: { tools: SOCIALFLOW_MCP_TOOLS },
      };
    case "tools/call":
      return buildToolCallResponse(args.id, args.params, args.campaigns);
    default:
      return {
        jsonrpc: "2.0",
        id: args.id,
        error: { code: -32601, message: "Method not found" },
      };
  }
}

function buildToolCallResponse(
  id: unknown,
  params: unknown,
  campaigns: PublicCampaign[],
): McpResponse {
  const name =
    params && typeof params === "object" && "name" in params
      ? (params as { name?: unknown }).name
      : null;
  if (name !== "socialflow.list_campaigns") {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: "Unknown tool" },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify({ campaigns }, null, 2),
        },
      ],
    },
  };
}
