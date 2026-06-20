import { getChatModel } from "@/lib/llm/factory";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { draftPrompt } from "../prompts";
import { textOf } from "../_util";
import type { ContentStateType } from "../state";

export async function draftPerPlatformNode(state: ContentStateType) {
  const model = getChatModel({ temperature: 0.8 });

  // Draft platforms in parallel to stay within the API route budget.
  const entries = await Promise.all(
    state.platforms.map(async (platform) => {
      const meta = PLATFORM_META[platform];
      const res = await model.invoke(
        draftPrompt({
          platform: meta.label,
          maxLength: meta.maxBodyLength,
          digest: state.digest,
          topic: state.topic,
        }),
      );
      const body = textOf(res.content).trim().slice(0, meta.maxBodyLength);
      return [platform, body] as const;
    }),
  );

  return { drafts: Object.fromEntries(entries) };
}
