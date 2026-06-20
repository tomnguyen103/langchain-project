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
    .slice(0, 6);
}

/** Research a niche (web search) and ideate content angles from the findings. */
export async function runResearch(input: { niche: string }): Promise<{
  findings: Finding[];
  ideas: string[];
  langsmithRunId: string | null;
}> {
  const findings = await searchWeb(input.niche);
  const context = findings.length
    ? findings.map((f) => `- ${f.title}: ${f.snippet}`).join("\n")
    : "(no external sources available)";

  const model = getChatModel({ temperature: 0.9 });
  // Capture the LangSmith run id so the idea can deep-link to its trace.
  let langsmithRunId: string | undefined;
  const res = await model.invoke(ideationPrompt(input.niche, context), {
    callbacks: [
      {
        handleLLMStart: (_llm, _prompts, runId) => {
          langsmithRunId ??= runId;
        },
      },
    ],
  });
  return {
    findings,
    ideas: parseIdeas(textOf(res.content)),
    langsmithRunId: langsmithRunId ?? null,
  };
}
