import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { requireUserId } from "@/lib/clerk";
import { recommendCampaignExperiments } from "@/lib/campaigns/recommendations";
import { getUserCampaignWorkspace } from "@/lib/repos/campaigns";
import { getEngagementSummary } from "@/lib/repos/posts";

import { BriefTab } from "./brief-tab";
import { ExperimentsTab } from "./experiments-tab";
import { LinksTab } from "./links-tab";
import { SourcesTab } from "./sources-tab";

const TABS = ["brief", "sources", "experiments", "links"] as const;
type CampaignTab = (typeof TABS)[number];

function isCampaignTab(value: string | undefined): value is CampaignTab {
  return TABS.includes(value as CampaignTab);
}

function firstValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const sp = await searchParams;
  const requestedTab = firstValue(sp.tab);
  const defaultTab: CampaignTab = isCampaignTab(requestedTab)
    ? requestedTab
    : "brief";

  const [campaign, engagement] = await Promise.all([
    getUserCampaignWorkspace(id, userId),
    getEngagementSummary(userId),
  ]);
  if (!campaign) notFound();

  const recommendations = recommendCampaignExperiments(engagement);

  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> All campaigns
      </Link>

      <PageHeader
        eyebrow="Workspace"
        title={campaign.name}
        actions={<Badge variant="outline">{campaign.status}</Badge>}
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="brief">Brief &amp; strategy</TabsTrigger>
          <TabsTrigger value="sources">
            Sources &amp; runs
            {campaign.sources.length > 0 && (
              <span className="bg-secondary text-secondary-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium">
                {campaign.sources.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="experiments">
            Experiments
            {campaign.experiments.length > 0 && (
              <span className="bg-secondary text-secondary-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium">
                {campaign.experiments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="links">Links &amp; approvals</TabsTrigger>
        </TabsList>

        <TabsContent value="brief">
          <BriefTab
            name={campaign.name}
            brief={campaign.brief}
            platforms={campaign.platforms}
          />
        </TabsContent>

        <TabsContent value="sources">
          <SourcesTab campaignId={campaign.id} sources={campaign.sources} />
        </TabsContent>

        <TabsContent value="experiments">
          <ExperimentsTab
            campaignId={campaign.id}
            recommendations={recommendations}
            experiments={campaign.experiments}
          />
        </TabsContent>

        <TabsContent value="links">
          <LinksTab
            campaignId={campaign.id}
            attributionLinks={campaign.attributionLinks}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
