import { getChatModel } from "@/lib/llm/factory";
import { critiquePrompt } from "../prompts";
import { textOf } from "../_util";
import type { ContentStateType } from "../state";

export async function critiqueNode(state: ContentStateType) {
  const model = getChatModel({ temperature: 0.2 });
  const draftsText = Object.entries(state.drafts)
    .map(([platform, body]) => `[${platform}]\n${body}`)
    .join("\n\n");

  const res = await model.invoke(critiquePrompt(draftsText));
  const text = textOf(res.content).trim();
  const needsRevision = text.toUpperCase().startsWith("REVISE");

  return {
    needsRevision,
    critiqueNotes: needsRevision ? text.replace(/^REVISE:?/i, "").trim() : "",
  };
}
