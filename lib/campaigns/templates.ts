import type { Platform } from "@/db/schema";

export type CampaignTemplateKey =
  | "launch"
  | "webinar"
  | "customer_story"
  | "evergreen";

export type CampaignTemplate = {
  key: CampaignTemplateKey;
  name: string;
  brief: string;
  goals: Record<string, string>;
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    key: "launch",
    name: "Launch sequence",
    brief:
      "Announce the launch, prove the problem, show the differentiator, and close with a clear action.",
    goals: { stage: "launch", primaryMetric: "qualified clicks" },
  },
  {
    key: "webinar",
    name: "Webinar promotion",
    brief:
      "Promote a live session with the audience pain point, expert angle, agenda, and registration CTA.",
    goals: { stage: "demand", primaryMetric: "registrations" },
  },
  {
    key: "customer_story",
    name: "Customer story",
    brief:
      "Turn a customer outcome into a credibility campaign with before, after, proof, and lessons learned.",
    goals: { stage: "proof", primaryMetric: "engaged accounts" },
  },
  {
    key: "evergreen",
    name: "Evergreen refresh",
    brief:
      "Repackage a proven topic with updated framing, platform-native hooks, and a fresh CTA.",
    goals: { stage: "evergreen", primaryMetric: "engagement rate" },
  },
];

export function getCampaignTemplate(
  key: string,
): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((template) => template.key === key);
}

export function buildCampaignFromTemplate(opts: {
  key: string;
  availablePlatforms: Platform[];
}): {
  name: string;
  brief: string;
  platforms: Platform[];
  goals: Record<string, string>;
  templateKey: CampaignTemplateKey;
} | null {
  const template = getCampaignTemplate(opts.key);
  if (!template) return null;
  return {
    name: template.name,
    brief: template.brief,
    platforms: opts.availablePlatforms.slice(0, 4),
    goals: template.goals,
    templateKey: template.key,
  };
}
