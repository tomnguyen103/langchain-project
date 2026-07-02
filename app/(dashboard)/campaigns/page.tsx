import Link from "next/link";
import { FileText, Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireUserId } from "@/lib/clerk";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaigns/templates";
import { listSocialAccounts } from "@/lib/repos/accounts";
import { listCampaignWorkspaces } from "@/lib/repos/campaigns";
import { listCompetitorWatches } from "@/lib/repos/competitors";
import {
  createCampaignFromTemplateAction,
  createCompetitorWatchAction,
} from "./actions";
import { CreateCampaignForm } from "./create-campaign-form";

export default async function CampaignsPage() {
  const userId = await requireUserId();
  const [campaigns, accounts, competitorWatches] = await Promise.all([
    listCampaignWorkspaces(userId),
    listSocialAccounts(userId),
    listCompetitorWatches(userId),
  ]);
  const platforms = [
    ...new Set(
      accounts
        .filter((account) => account.status === "active")
        .map((account) => account.platform),
    ),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Campaigns"
        description="Briefs, source material, and source-to-draft campaign runs."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateCampaignForm platforms={platforms} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template library</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-4">
            {CAMPAIGN_TEMPLATES.map((template) => (
              <form
                key={template.key}
                action={createCampaignFromTemplateAction}
                className="rounded-lg border p-3"
              >
                <input
                  type="hidden"
                  name="templateKey"
                  value={template.key}
                />
                <p className="text-sm font-medium">{template.name}</p>
                <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">
                  {template.brief}
                </p>
                <Button type="submit" size="sm" variant="outline" className="mt-3">
                  Use template
                </Button>
              </form>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competitor watch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            action={createCompetitorWatchAction}
            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
          >
            <Input name="competitorName" placeholder="Competitor" />
            <Input name="sourceUrl" placeholder="https://example.com" />
            <Button type="submit" size="sm">
              Add watch
            </Button>
          </form>
          {competitorWatches.length > 0 ? (
            <div className="space-y-2">
              {competitorWatches.map((watch) => (
                <div
                  key={watch.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
                >
                  <span className="font-medium">{watch.competitorName}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {watch.sourceUrl ?? "No source URL"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create a brief, add source material, then start a source-to-draft run."
        />
      ) : (
        <div className="space-y-2">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                  <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {campaign.name}
                  </span>
                  <Badge variant="outline">{campaign.status}</Badge>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {campaign.sources.length} source
                    {campaign.sources.length === 1 ? "" : "s"} ·{" "}
                    {campaign.experiments.length} experiment
                    {campaign.experiments.length === 1 ? "" : "s"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
