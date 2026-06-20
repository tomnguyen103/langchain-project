export const GRAPH_API_VERSION = "v21.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const GRAPH_TIMEOUT_MS = 15_000;

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly raw: unknown,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

type GraphInit = {
  method?: "GET" | "POST" | "DELETE";
  accessToken: string;
  params?: Record<string, string | undefined>;
};

/** Thin wrapper over the Meta Graph API with consistent error handling. */
export async function graphFetch<T = unknown>(
  path: string,
  init: GraphInit,
): Promise<T> {
  const method = init.method ?? "GET";
  const url = new URL(`${GRAPH_BASE}${path}`);
  const form = new URLSearchParams({ access_token: init.accessToken });
  for (const [key, value] of Object.entries(init.params ?? {})) {
    if (value !== undefined) form.set(key, value);
  }

  const signal = AbortSignal.timeout(GRAPH_TIMEOUT_MS);
  let response: Response;
  if (method === "GET") {
    for (const [key, value] of form.entries()) url.searchParams.set(key, value);
    response = await fetch(url, { method, signal });
  } else {
    response = await fetch(url, {
      method,
      body: form,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal,
    });
  }

  const json = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;

  if (!response.ok || json === null) {
    const message = json?.error?.message ?? response.statusText;
    throw new MetaApiError(message, response.status, json);
  }
  return json;
}

/** Public GET (no access token injected) — used for OAuth token-exchange endpoints. */
export async function graphGet<T = unknown>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });
  const json = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;
  if (!response.ok || json === null) {
    throw new MetaApiError(
      json?.error?.message ?? response.statusText,
      response.status,
      json,
    );
  }
  return json;
}
