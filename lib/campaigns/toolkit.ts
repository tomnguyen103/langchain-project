import type { Platform } from "@/db/schema";

export type RiskFinding = { rule: string; detail: string; level: "warn" | "block" };

export function simulateAudience(text: string): Array<{
  segment: string;
  reaction: "positive" | "neutral" | "negative";
  note: string;
}> {
  const lower = text.toLowerCase();
  return [
    {
      segment: "Buyer",
      reaction: lower.includes("save") || lower.includes("faster") ? "positive" : "neutral",
      note: "Looks for concrete value and implementation clarity.",
    },
    {
      segment: "Skeptic",
      reaction: lower.includes("guarantee") || lower.includes("best") ? "negative" : "neutral",
      note: "Challenges absolute claims and vague proof.",
    },
    {
      segment: "Peer",
      reaction: lower.includes("template") || lower.includes("framework") ? "positive" : "neutral",
      note: "Responds to reusable tactics and practical examples.",
    },
  ];
}

export function suggestHashtags(text: string, limit = 5): string[] {
  const stop = new Set(["with", "from", "that", "this", "your", "about", "into"]);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !stop.has(word));
  return [...new Set(words)].slice(0, limit).map((word) => `#${word}`);
}

export function transformForPlatform(text: string, platform: Platform): string {
  const trimmed = text.trim();
  if (platform === "x") return trimmed.slice(0, 280);
  if (platform === "linkedin") return trimmed.replace(/\.\s+/g, ".\n\n");
  if (platform === "instagram") {
    const tags = suggestHashtags(trimmed, 4).join(" ");
    return tags ? `${trimmed}\n\n${tags}` : trimmed;
  }
  return trimmed;
}

export function platformAlgorithmCoach(platform: Platform): string[] {
  if (platform === "x") return ["Lead with the point.", "Use one clear reply prompt."];
  if (platform === "linkedin") return ["Use a strong first line.", "Keep outbound links out of the body."];
  if (platform === "instagram") return ["Put the hook before hashtags.", "Keep captions skimmable."];
  if (platform === "tiktok") return ["Open with motion or tension.", "Make the first sentence searchable."];
  return ["Match the platform's native format.", "Use one primary action."];
}

export function strategyDebate(brief: string): Array<{ agent: string; position: string }> {
  return [
    { agent: "Vega", position: `Research angle: validate demand around "${brief.slice(0, 80)}".` },
    { agent: "Lyra", position: "Creative angle: draft one proof-led and one story-led variant." },
    { agent: "Castor", position: "Risk angle: hold absolute claims and unsupported comparisons." },
  ];
}

export function crisisRiskRadar(text: string): RiskFinding[] {
  const findings: RiskFinding[] = [];
  if (/\b(outage|breach|lawsuit|recall|incident)\b/i.test(text)) {
    findings.push({
      rule: "crisis_sensitive_topic",
      level: "warn",
      detail: "Sensitive-topic language should be reviewed before publishing.",
    });
  }
  if (/\b(blame|guarantee|never happen again)\b/i.test(text)) {
    findings.push({
      rule: "crisis_overclaim",
      level: "block",
      detail: "Avoid blame or guarantees in crisis communication.",
    });
  }
  return findings;
}

export function buildAttributionUrl(
  destinationUrl: string,
  params: Record<string, string>,
): string {
  const url = new URL(destinationUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}
