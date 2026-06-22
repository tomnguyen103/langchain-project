/** Pure JSON-RPC 2.0 helpers for the MCP client (no env/network → testable). */
export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown;
};

export function buildRpcRequest(
  method: string,
  params: unknown,
  id: number,
): JsonRpcRequest {
  return { jsonrpc: "2.0", id, method, params };
}

/** Extract `result` from a JSON-RPC response, throwing on an error envelope. */
export function parseRpcResult<T>(body: unknown): T {
  if (!body || typeof body !== "object") {
    throw new Error("invalid JSON-RPC response");
  }
  const envelope = body as { result?: T; error?: { message?: string } };
  if (envelope.error) {
    throw new Error(envelope.error.message ?? "JSON-RPC error");
  }
  if (envelope.result === undefined) {
    throw new Error("JSON-RPC response missing result");
  }
  return envelope.result;
}
