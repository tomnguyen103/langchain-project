import { getChatModel } from "@/lib/llm/factory";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { draftPrompt } from "../prompts";
import { textOf } from "../_util";
import type { ContentStateType } from "../state";

export async function draftPerPlatformNode(state: ContentStateType) {
  const model = getChatModel({ temperature: 0.8 });
  const drafts: Record<string, string> = {};

  for (const platform of state.platforms) {
    const meta = PLATFORM_META[platform];
    const res = await model.invoke(
      draftPrompt({
        platform: meta.label,
        maxLength: meta.maxBodyLength,
        digest: state.digest,
        topic: state.topic,
      }),
    );
    drafts[platform] = textOf(res.content).trim();
  }

  return { drafts };
}
