import { env } from "@/lib/env";

import { buildRpcRequest, parseRpcResult } from "./rpc";

/**
 * Minimal MCP client over stateless HTTP (the 2026 MCP transport). Lets agents
 * call tools on a configured MCP server. Graceful: when no server is configured
 * it reports unconfigured / returns [] (mirrors the Tavily web-search gate), so
 * adopting MCP is additive and env-gated.
 */
export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};
export type McpToolResult = {
  content: Array<{ type: string; text?: string }>;
};

let nextId = 1;

function config(): { url: string; token?: string } | null {
  return env.MCP_SERVER_URL
    ? { url: env.MCP_SERVER_URL, token: env.MCP_SERVER_TOKEN }
    : null;
}

/** Whether an MCP server is configured. */
export function isMcpConfigured(): boolean {
  return config() !== null;
}

async function call<T>(method: string, params: unknown): Promise<T> {
  const cfg = config();
  if (!cfg) throw new Error("MCP is not configured (set MCP_SERVER_URL).");
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(cfg.token ? { authorization: `Bearer ${cfg.token}` } : {}),
    },
    body: JSON.stringify(buildRpcRequest(method, params, nextId++)),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`MCP server returned ${res.status}`);
  return parseRpcResult<T>(await res.json());
}

/** List the configured MCP server's tools — [] when no server is configured. */
export async function listMcpTools(): Promise<McpTool[]> {
  if (!isMcpConfigured()) return [];
  const result = await call<{ tools?: McpTool[] }>("tools/list", {});
  return result.tools ?? [];
}

/** Call an MCP tool by name. */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  return call<McpToolResult>("tools/call", { name, arguments: args });
}
