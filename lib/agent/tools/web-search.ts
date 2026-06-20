import type { Finding } from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Web research via Tavily. Returns [] when no key is configured or on failure,
 * so research gracefully falls back to the model's own knowledge.
 */
export async function searchWeb(
  query: string,
  maxResults = 5,
): Promise<Finding[]> {
  if (!env.TAVILY_API_KEY) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query,
        max_results: maxResults,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: (r.content ?? "").slice(0, 400),
    }));
  } catch {
    return [];
  }
}
