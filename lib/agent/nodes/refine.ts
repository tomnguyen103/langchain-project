import type { Platform } from "@/db/schema";
import { getChatModel } from "@/lib/llm/factory";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { refinePrompt } from "../prompts";
import { textOf } from "../_util";
import type { ContentStateType } from "../state";

export async function refineNode(state: ContentStateType) {
  const model = getChatModel({ temperature: 0.7 });

  const entries = await Promise.all(
    Object.entries(state.drafts).map(async ([platform, draft]) => {
      const meta = PLATFORM_META[platform as Platform];
      const res = await model.invoke(
        refinePrompt({
          platform: meta.label,
          maxLength: meta.maxBodyLength,
          draft,
          notes: state.critiqueNotes,
        }),
      );
      const body = textOf(res.content).trim().slice(0, meta.maxBodyLength);
      return [platform, body] as const;
    }),
  );

  return {
    drafts: Object.fromEntries(entries),
    revisionCount: state.revisionCount + 1,
  };
}
