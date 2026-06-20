import type { Platform } from "@/db/schema";
import { env } from "@/lib/env";
import { saveGeneratedContent } from "@/lib/repos/generated-content";
import { PROMPT_VERSION } from "../prompts";
import type { ContentStateType } from "../state";

export async function finalizeNode(state: ContentStateType) {
  const model = env.LLM_PROVIDER ?? "gemini";
  await saveGeneratedContent(
    Object.entries(state.drafts).map(([platform, content]) => ({
      clerkUserId: state.userId,
      kind: "caption" as const,
      platform: platform as Platform,
      topic: state.topic,
      content,
      critiqueNotes: state.critiqueNotes || null,
      model,
      promptVersion: PROMPT_VERSION,
    })),
  );
  return {};
}
