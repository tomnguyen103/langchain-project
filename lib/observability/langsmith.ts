import { env } from "@/lib/env";

/** Whether LangSmith tracing is switched on. */
export function isLangSmithEnabled(): boolean {
  return env.LANGCHAIN_TRACING_V2 === "true" && Boolean(env.LANGCHAIN_API_KEY);
}

/**
 * Best-effort deep link to a LangSmith run. LangSmith run URLs are scoped by
 * workspace + project ids (UUIDs), so a correct link needs both configured via
 * LANGSMITH_ORG_ID + LANGSMITH_PROJECT_ID. Returns null when not configured or
 * no run id — callers render nothing rather than a broken link.
 */
export function langsmithRunUrl(
  runId: string | null | undefined,
): string | null {
  if (!runId || !env.LANGSMITH_ORG_ID || !env.LANGSMITH_PROJECT_ID) return null;
  return (
    `https://smith.langchain.com/o/${env.LANGSMITH_ORG_ID}` +
    `/projects/p/${env.LANGSMITH_PROJECT_ID}/r/${encodeURIComponent(runId)}`
  );
}
