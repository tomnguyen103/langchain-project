import type { CampaignWorkspace } from "@/lib/repos/campaigns";

export type PublicCampaign = {
  id: string;
  name: string;
  brief: string;
  status: string;
  platforms: string[];
  templateKey: string | null;
  createdAt: string;
  updatedAt: string;
  sources: Array<{
    id: string;
    title: string;
    sourceType: string;
    sourceUrl: string | null;
    citationLabel: string | null;
    summary: string | null;
  }>;
  experiments: Array<{
    id: string;
    name: string;
    hypothesis: string;
    status: string;
  }>;
  attribution: Array<{
    id: string;
    label: string;
    trackedUrl: string;
    clicks: number;
    conversions: number;
    revenueCents: number;
  }>;
};

export function serializePublicCampaign(
  campaign: CampaignWorkspace,
): PublicCampaign {
  return {
    id: campaign.id,
    name: campaign.name,
    brief: campaign.brief,
    status: campaign.status,
    platforms: campaign.platforms,
    templateKey: campaign.templateKey,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    sources: campaign.sources.map((source) => ({
      id: source.id,
      title: source.title,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      citationLabel: source.citationLabel,
      summary: source.summary,
    })),
    experiments: campaign.experiments.map((experiment) => ({
      id: experiment.id,
      name: experiment.name,
      hypothesis: experiment.hypothesis,
      status: experiment.status,
    })),
    attribution: campaign.attributionLinks.map((link) => ({
      id: link.id,
      label: link.label,
      trackedUrl: link.trackedUrl,
      clicks: link.clicks,
      conversions: link.conversions,
      revenueCents: link.revenueCents,
    })),
  };
}
