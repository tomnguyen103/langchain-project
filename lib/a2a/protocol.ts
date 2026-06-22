/** A2A task state mapped from our agent_runs.status. */
export type A2aTaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "failed"
  | "canceled";

export function mapRunStatusToTaskState(status: string): A2aTaskState {
  switch (status) {
    case "pending":
      return "submitted";
    case "running":
      return "working";
    case "awaiting_approval":
      return "input-required";
    case "completed":
      return "completed";
    case "rejected":
    case "cancelled":
      return "canceled";
    case "failed":
      return "failed";
    default:
      return "working";
  }
}

type A2aId = string | number | null;

export type ParsedA2a =
  | { method: "message/send"; id: A2aId; text: string; platforms: string[] }
  | { method: "tasks/get"; id: A2aId; taskId: string }
  | { method: "unsupported"; id: A2aId };

/** Parse an A2A JSON-RPC 2.0 request into a typed, validated shape (pure). */
export function parseA2aRequest(body: unknown): ParsedA2a {
  const envelope = (body ?? {}) as {
    id?: unknown;
    method?: unknown;
    params?: unknown;
  };
  const id: A2aId =
    typeof envelope.id === "string" || typeof envelope.id === "number"
      ? envelope.id
      : null;
  const method = typeof envelope.method === "string" ? envelope.method : "";
  const params = (envelope.params ?? {}) as Record<string, unknown>;

  if (method === "message/send") {
    const message = (params.message ?? {}) as { parts?: unknown };
    const parts = Array.isArray(message.parts) ? message.parts : [];
    const text = parts
      .map((p) =>
        p &&
        typeof p === "object" &&
        "text" in p &&
        typeof (p as { text: unknown }).text === "string"
          ? (p as { text: string }).text
          : "",
      )
      .join(" ")
      .trim();
    const platforms = Array.isArray(params.platforms)
      ? params.platforms.filter((x): x is string => typeof x === "string")
      : [];
    return { method: "message/send", id, text, platforms };
  }
  if (method === "tasks/get") {
    const taskId = typeof params.id === "string" ? params.id : "";
    return { method: "tasks/get", id, taskId };
  }
  return { method: "unsupported", id };
}

export function jsonRpcResult(id: A2aId, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}

export function jsonRpcError(id: A2aId, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}
