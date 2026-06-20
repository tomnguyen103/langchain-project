import type { Platform } from "@/db/schema";
import { getChatModel } from "@/lib/llm/factory";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { refinePrompt } from "../prompts";
import { textOf } from "../_util";
import type { ContentStateType } from "../state";

export async function refineNode(state: ContentStateType) {
  const model = getChatModel({ temperature: 0.7 });
  const drafts: Record<string, string> = {};

  for (const [platform, draft] of Object.entries(state.drafts)) {
    const meta = PLATFORM_META[platform as Platform];
    const res = await model.invoke(
      refinePrompt({
        platform: meta.label,
        maxLength: meta.maxBodyLength,
        draft,
        notes: state.critiqueNotes,
      }),
    );
    drafts[platform] = textOf(res.content).trim();
  }

  return { drafts, revisionCount: state.revisionCount + 1 };
}
