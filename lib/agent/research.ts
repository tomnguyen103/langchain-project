import type { Finding } from "@/db/schema";
import { getChatModel } from "@/lib/llm/factory";
import { ideationPrompt } from "./prompts";
import { searchWeb } from "./tools/web-search";
import { textOf } from "./_util";

function parseIdeas(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 8);
}

/** Research a niche (web search) and ideate content angles from the findings. */
export async function runResearch(input: {
  niche: string;
}): Promise<{ findings: Finding[]; ideas: string[] }> {
  const findings = await searchWeb(input.niche);
  const context = findings.length
    ? findings.map((f) => `- ${f.title}: ${f.snippet}`).join("\n")
    : "(no external sources available)";

  const model = getChatModel({ temperature: 0.9 });
  const res = await model.invoke(ideationPrompt(input.niche, context));
  return { findings, ideas: parseIdeas(textOf(res.content)) };
}
