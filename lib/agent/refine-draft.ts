import type { Platform } from "@/db/schema";
import { getChatModel } from "@/lib/llm/factory";
import { PLATFORM_META } from "@/lib/platforms/constants";

import { textOf } from "./_util";
import { refinePrompt } from "./prompts";

/** Fallback length cap for a platform-agnostic draft (no platform set). */
const DEFAULT_MAX_LENGTH = 2200;

/**
 * Re-draft one held caption from a human reviewer's feedback — the Agent Inbox
 * "Respond" action. A focused, single-shot refine that reuses the content
 * engine's refine prompt/limits, scoped to one draft (not the full Lyra graph).
 */
export async function refineDraftWithFeedback(args: {
  platform: Platform | null;
  draft: string;
  feedback: string;
}): Promise<string> {
  const meta = args.platform ? PLATFORM_META[args.platform] : null;
  const maxLength = meta?.maxBodyLength ?? DEFAULT_MAX_LENGTH;
  const label = meta?.label ?? "social media";

  const model = getChatModel({ temperature: 0.7 });
  const res = await model.invoke(
    refinePrompt({
      platform: label,
      maxLength,
      draft: args.draft,
      notes: args.feedback,
    }),
  );
  return textOf(res.content).trim().slice(0, maxLength);
}
