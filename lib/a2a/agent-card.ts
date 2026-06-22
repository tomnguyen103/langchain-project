export type AgentCard = {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: { streaming: boolean };
  skills: Array<{ id: string; name: string; description: string }>;
};

/** Build the A2A Agent Card describing the SocialFlow content agent (pure). */
export function buildAgentCard(baseUrl: string): AgentCard {
  return {
    name: "SocialFlow Content Agent",
    description:
      "Researches a niche, drafts brand-safe social content across platforms, runs a brand-safety review, and schedules approved posts.",
    url: `${baseUrl.replace(/\/$/, "")}/api/a2a`,
    version: "1.0.0",
    capabilities: { streaming: false },
    skills: [
      {
        id: "draft-and-schedule",
        name: "Draft & schedule a campaign",
        description:
          "Given a niche/topic and target platforms, run research → drafting → brand-safety review → scheduling.",
      },
    ],
  };
}
