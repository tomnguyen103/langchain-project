import type { AgentRunPlan } from "@/db/schema";
import { AgentName } from "./types";

export type AgentRunTemplateKey =
  | "standard_pipeline"
  | "weekly_trend_brief"
  | "launch_campaign"
  | "evergreen_refresh"
  | "crisis_watch";

export type AgentRunTemplate = {
  key: AgentRunTemplateKey;
  label: string;
  description: string;
  placeholder: string;
  objective: string;
};

export const AGENT_RUN_TEMPLATES: AgentRunTemplate[] = [
  {
    key: "standard_pipeline",
    label: "Standard pipeline",
    description: "Research, draft, review, schedule, monitor.",
    placeholder: "AI tools for indie founders",
    objective: "Create a governed cross-platform content run.",
  },
  {
    key: "weekly_trend_brief",
    label: "Weekly trend brief",
    description: "Turn a market trend into platform-ready posts.",
    placeholder: "This week's ecommerce retention trends",
    objective: "Find current angles and convert them into a weekly trend campaign.",
  },
  {
    key: "launch_campaign",
    label: "Launch campaign",
    description: "Create announcement posts with stronger review gates.",
    placeholder: "Launch week for our new analytics dashboard",
    objective: "Draft a launch sequence with clear positioning and review emphasis.",
  },
  {
    key: "evergreen_refresh",
    label: "Evergreen refresh",
    description: "Generate updated angles for proven durable topics.",
    placeholder: "Refresh our best onboarding tips for founders",
    objective: "Create new evergreen angles without duplicating older wording.",
  },
  {
    key: "crisis_watch",
    label: "Crisis watch",
    description: "Research risk-sensitive messaging before drafting.",
    placeholder: "Platform outage response for customers",
    objective: "Prepare cautious, review-heavy messaging for a sensitive topic.",
  },
];

const TEMPLATE_KEYS = new Set(AGENT_RUN_TEMPLATES.map((template) => template.key));

export function assertAgentRunTemplateKey(value: string): AgentRunTemplateKey {
  if (!TEMPLATE_KEYS.has(value as AgentRunTemplateKey)) {
    throw new Error("Choose a valid run template.");
  }
  return value as AgentRunTemplateKey;
}

export function getAgentRunTemplate(
  key: AgentRunTemplateKey,
): AgentRunTemplate {
  return AGENT_RUN_TEMPLATES.find((template) => template.key === key)!;
}

export function applyAgentRunTemplate(input: {
  templateKey: AgentRunTemplateKey;
  niche: string;
  platforms: string[];
  budget: NonNullable<AgentRunPlan["budget"]>;
}): {
  plan: AgentRunPlan;
  firstStep: { agent: AgentName; payload: unknown };
} {
  const template = getAgentRunTemplate(input.templateKey);
  const firstPayload = {
    niche: input.niche,
    platforms: input.platforms,
    templateKey: template.key,
    objective: template.objective,
  };
  return {
    plan: {
      niche: input.niche,
      platforms: input.platforms,
      budget: input.budget,
      templateKey: template.key,
      templateLabel: template.label,
      objective: template.objective,
      steps: [{ agent: AgentName.Vega, payload: firstPayload }],
    },
    firstStep: { agent: AgentName.Vega, payload: firstPayload },
  };
}
