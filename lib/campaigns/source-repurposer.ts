import type { Platform } from "@/db/schema";
import { PLATFORM_META } from "@/lib/platforms/constants";

export function summarizeCampaignSource(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= 280 ? normalized : `${normalized.slice(0, 277)}...`;
}

export function buildSourceCampaignTopic(input: {
  campaignName: string;
  brief: string;
  sourceTitle: string;
  sourceText: string;
  platforms: Platform[];
}): string {
  const platformLabels = input.platforms
    .map((platform) => PLATFORM_META[platform].label)
    .join(", ");
  return [
    `Campaign: ${input.campaignName}`,
    `Platforms: ${platformLabels || "platform-agnostic"}`,
    input.brief ? `Brief: ${input.brief}` : "",
    `Source: ${input.sourceTitle}`,
    "Repurpose this source into campaign-ready drafts without inventing unsupported claims.",
    "",
    input.sourceText.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}
