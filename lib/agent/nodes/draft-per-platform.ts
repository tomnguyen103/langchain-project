import { getChatModel } from "@/lib/llm/factory";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { draftPrompt } from "../prompts";
import { selectBestDraft } from "../select-draft";
import { textOf } from "../_util";
import type { ContentStateType } from "../state";

/** Variants generated per platform; the best is selected (fan-out → fan-in). */
const DRAFT_VARIANTS = 1;

export async function draftPerPlatformNode(state: ContentStateType) {
  const model = getChatModel({ temperature: 0.8 });

  // Fan out: draft every platform (and its N variants) concurrently to stay
  // within the API route budget. Fan in: pick the best variant per platform.
  const entries = await Promise.all(
    state.platforms.map(async (platform) => {
      const meta = PLATFORM_META[platform];
      const prompt = draftPrompt({
        platform: meta.label,
        maxLength: meta.maxBodyLength,
        digest: state.digest,
        topic: state.topic,
        voice: state.brandVoice,
        bannedTerms: state.bannedTerms,
      });
      const variants = await Promise.all(
        Array.from({ length: DRAFT_VARIANTS }, async () => {
          const res = await model.invoke(prompt);
          return textOf(res.content).trim();
        }),
      );
      const best = selectBestDraft(variants, {
        maxLength: meta.maxBodyLength,
        bannedTerms: state.bannedTerms,
      }).slice(0, meta.maxBodyLength);
      return [platform, best] as const;
    }),
  );

  return { drafts: Object.fromEntries(entries) };
}
