import { FileText, Megaphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireUserId } from "@/lib/clerk";
import { recommendCampaignExperiments } from "@/lib/campaigns/recommendations";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaigns/templates";
import {
  crisisRiskRadar,
  platformAlgorithmCoach,
  simulateAudience,
  strategyDebate,
  suggestHashtags,
  transformForPlatform,
} from "@/lib/campaigns/toolkit";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { listSocialAccounts } from "@/lib/repos/accounts";
import { getEngagementSummary } from "@/lib/repos/posts";
import { listCampaignWorkspaces } from "@/lib/repos/campaigns";
import { listCompetitorWatches } from "@/lib/repos/competitors";
import {
  addCampaignSourceAction,
  createCampaignAction,
  createAttributionLinkAction,
  createCampaignFromTemplateAction,
  createCampaignExperimentAction,
  createCompetitorWatchAction,
  startCampaignSourceRunAction,
} from "./actions";
import { ApprovalLinkForm } from "./approval-link-form";

export default async function CampaignsPage() {
  const userId = await requireUserId();
  const [campaigns, accounts, engagement, competitorWatches] = await Promise.all([
    listCampaignWorkspaces(userId),
    listSocialAccounts(userId),
    getEngagementSummary(userId),
    listCompetitorWatches(userId),
  ]);
  const recommendations = recommendCampaignExperiments(engagement);
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
          <form action={createCampaignAction} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Input name="name" placeholder="Launch campaign" maxLength={120} />
              <Input name="brief" placeholder="Audience, offer, constraints" />
            </div>
            {platforms.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {platforms.map((platform) => (
                  <label
                    key={platform}
                    className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                  >
                    <input
                      type="checkbox"
                      name="platform"
                      value={platform}
                      defaultChecked
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    {PLATFORM_META[platform].label}
                  </label>
                ))}
              </div>
            ) : null}
            <Button type="submit">Create campaign</Button>
          </form>
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
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <FileText className="size-4" aria-hidden />
                  {campaign.name}
                  <span className="text-muted-foreground text-xs font-normal">
                    {campaign.status}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const basis = campaign.brief || campaign.name;
                  const firstPlatform = campaign.platforms[0];
                  const riskFindings = crisisRiskRadar(basis);
                  return (
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-sm font-medium">Audience simulation</p>
                        <div className="mt-2 space-y-1">
                          {simulateAudience(basis).map((reaction) => (
                            <p key={reaction.segment} className="text-xs">
                              <span className="font-medium">
                                {reaction.segment}:
                              </span>{" "}
                              {reaction.reaction}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-sm font-medium">Optimization</p>
                        <p className="text-muted-foreground mt-2 text-xs">
                          {suggestHashtags(basis).join(" ") || "No hashtags"}
                        </p>
                        {firstPlatform ? (
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                            {transformForPlatform(basis, firstPlatform)}
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-sm font-medium">Risk and coaching</p>
                        <p className="text-muted-foreground mt-2 text-xs">
                          {riskFindings.length === 0
                            ? "No crisis keywords detected."
                            : riskFindings.map((finding) => finding.rule).join(", ")}
                        </p>
                        {firstPlatform ? (
                          <p className="text-muted-foreground mt-1 text-xs">
                            {platformAlgorithmCoach(firstPlatform)[0]}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}

                {campaign.brief ? (
                  <p className="text-muted-foreground text-sm">{campaign.brief}</p>
                ) : null}

                <ApprovalLinkForm campaignId={campaign.id} />

                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">Strategy debate</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    {strategyDebate(campaign.brief || campaign.name).map((item) => (
                      <p key={item.agent} className="text-muted-foreground text-xs">
                        <span className="font-medium text-foreground">
                          {item.agent}:
                        </span>{" "}
                        {item.position}
                      </p>
                    ))}
                  </div>
                </div>

                <form
                  action={createAttributionLinkAction}
                  className="grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_auto]"
                >
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <Input name="label" placeholder="CTA link" />
                  <Input
                    name="destinationUrl"
                    placeholder="https://example.com"
                  />
                  <Input name="utmSource" placeholder="linkedin" />
                  <input type="hidden" name="utmMedium" value="social" />
                  <Button type="submit" size="sm">
                    Track
                  </Button>
                </form>

                {campaign.attributionLinks.length > 0 ? (
                  <div className="space-y-2">
                    {campaign.attributionLinks.map((link) => (
                      <div
                        key={link.id}
                        className="rounded-lg border p-3 text-sm"
                      >
                        <p className="font-medium">{link.label}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {link.trackedUrl}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-2 lg:grid-cols-3">
                  {recommendations.map((recommendation) => (
                    <form
                      key={recommendation.name}
                      action={createCampaignExperimentAction}
                      className="rounded-lg border p-3"
                    >
                      <input
                        type="hidden"
                        name="campaignId"
                        value={campaign.id}
                      />
                      <input
                        type="hidden"
                        name="name"
                        value={recommendation.name}
                      />
                      <input
                        type="hidden"
                        name="hypothesis"
                        value={recommendation.hypothesis}
                      />
                      <p className="text-sm font-medium">
                        {recommendation.name}
                      </p>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {recommendation.hypothesis}
                      </p>
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="mt-3"
                      >
                        Save experiment
                      </Button>
                    </form>
                  ))}
                </div>

                {campaign.experiments.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Experiments</p>
                    <div className="space-y-2">
                      {campaign.experiments.map((experiment) => (
                        <div
                          key={experiment.id}
                          className="rounded-lg border p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{experiment.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {experiment.status}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {experiment.hypothesis}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <form action={addCampaignSourceAction} className="space-y-3">
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <Input name="title" placeholder="Source title" />
                  <Textarea
                    name="sourceText"
                    rows={4}
                    placeholder="Paste webinar notes, a blog post, sales notes, or a transcript excerpt"
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Add source
                  </Button>
                </form>

                {campaign.sources.length > 0 ? (
                  <div className="space-y-2">
                    {campaign.sources.map((source) => (
                      <div
                        key={source.id}
                        className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
                      >
                        <span className="min-w-0 flex-1 font-medium">
                          {source.title}
                          {source.summary ? (
                            <span className="text-muted-foreground mt-0.5 block truncate text-xs font-normal">
                              {source.summary}
                            </span>
                          ) : null}
                        </span>
                        <form action={startCampaignSourceRunAction}>
                          <input
                            type="hidden"
                            name="campaignId"
                            value={campaign.id}
                          />
                          <input type="hidden" name="sourceId" value={source.id} />
                          <Button type="submit" size="sm">
                            Start run
                          </Button>
                        </form>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
