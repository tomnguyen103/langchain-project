import { getChatModel } from "@/lib/llm/factory";
import { digestPrompt } from "../prompts";
import { textOf } from "../_util";
import type { ContentStateType } from "../state";

export async function digestNode(state: ContentStateType) {
  const model = getChatModel({ temperature: 0.4 });
  const res = await model.invoke(digestPrompt(state.topic));
  return { digest: textOf(res.content).trim() };
}
