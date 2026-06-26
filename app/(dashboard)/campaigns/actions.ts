"use server";

import { revalidatePath } from "next/cache";

import { platformEnum, type Platform } from "@/db/schema";
import { generateApprovalToken } from "@/lib/approval-links/tokens";
import { AgentName } from "@/lib/agents/types";
import { startMeteredAgentRun } from "@/lib/agents/metered-run";
import { requireRole } from "@/lib/auth/current-role";
import {
  buildRunBudget,
  estimateAgentRunCostUsd,
} from "@/lib/billing/agent-budget";
import { getPlanLimits } from "@/lib/billing/entitlements";
import {
  buildSourceCampaignTopic,
  summarizeCampaignSource,
} from "@/lib/campaigns/source-repurposer";
import { buildCampaignFromTemplate } from "@/lib/campaigns/templates";
import { buildAttributionUrl } from "@/lib/campaigns/toolkit";
import { requireUserId } from "@/lib/clerk";
import { env } from "@/lib/env";
import {
  createCampaign,
  createCampaignExperiment,
  createCampaignSource,
  getUserCampaign,
  getUserCampaignSource,
} from "@/lib/repos/campaigns";
import { listSocialAccounts } from "@/lib/repos/accounts";
import { createApprovalLink } from "@/lib/repos/approval-links";
import { createAttributionLink } from "@/lib/repos/attribution";
import { createCompetitorWatch } from "@/lib/repos/competitors";
import { enqueueWebhookEvent } from "@/lib/repos/webhooks";

const VALID_PLATFORMS = new Set<string>(platformEnum.enumValues);

function platformsFromForm(formData: FormData): Platform[] {
  return formData
    .getAll("platform")
    .filter((value): value is string => typeof value === "string")
    .filter((value) => VALID_PLATFORMS.has(value)) as Platform[];
}

export async function createCampaignAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const name = String(formData.get("name") ?? "").trim();
  const brief = String(formData.get("brief") ?? "").trim();
  const platforms = platformsFromForm(formData);
  if (!name) throw new Error("Name the campaign.");

  const campaign = await createCampaign({
    clerkUserId: userId,
    name: name.slice(0, 120),
    brief: brief.slice(0, 2_000),
    platforms,
    status: "draft",
  });
  await enqueueWebhookEvent({
    clerkUserId: userId,
    eventType: "campaign.created",
    payload: { campaignId: campaign.id, name: campaign.name },
  });
  revalidatePath("/campaigns");
}

export async function createCampaignFromTemplateAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const templateKey = String(formData.get("templateKey") ?? "");
  const accounts = await listSocialAccounts(userId);
  const availablePlatforms = [
    ...new Set(
      accounts
        .filter((account) => account.status === "active")
        .map((account) => account.platform),
    ),
  ];
  const template = buildCampaignFromTemplate({
    key: templateKey,
    availablePlatforms,
  });
  if (!template) throw new Error("Campaign template not found.");

  const campaign = await createCampaign({
    clerkUserId: userId,
    name: template.name,
    brief: template.brief,
    platforms: template.platforms,
    goals: template.goals,
    templateKey: template.templateKey,
    status: "draft",
  });
  await enqueueWebhookEvent({
    clerkUserId: userId,
    eventType: "campaign.created",
    payload: {
      campaignId: campaign.id,
      name: campaign.name,
      templateKey: campaign.templateKey,
    },
  });
  revalidatePath("/campaigns");
}

export async function addCampaignSourceAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const campaignId = String(formData.get("campaignId") ?? "");
  const campaign = await getUserCampaign(campaignId, userId);
  if (!campaign) throw new Error("Campaign not found.");

  const title = String(formData.get("title") ?? "").trim();
  const sourceText = String(formData.get("sourceText") ?? "").trim();
  if (!title) throw new Error("Name the source.");
  if (sourceText.length < 20) throw new Error("Add more source detail.");

  const source = await createCampaignSource({
    clerkUserId: userId,
    campaignId: campaign.id,
    title: title.slice(0, 160),
    sourceType: "pasted_text",
    sourceText: sourceText.slice(0, 20_000),
    summary: summarizeCampaignSource(sourceText),
  });
  await enqueueWebhookEvent({
    clerkUserId: userId,
    eventType: "campaign.source_created",
    payload: {
      campaignId: campaign.id,
      sourceId: source.id,
      title: source.title,
    },
  });
  revalidatePath("/campaigns");
}

export async function startCampaignSourceRunAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const limits = await getPlanLimits();
  if (!limits.research) {
    throw new Error("Campaign repurposing is a Pro feature. Upgrade to use it.");
  }

  const campaignId = String(formData.get("campaignId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  const [campaign, source] = await Promise.all([
    getUserCampaign(campaignId, userId),
    getUserCampaignSource(sourceId, userId),
  ]);
  if (!campaign || !source || source.campaignId !== campaign.id) {
    throw new Error("Campaign source not found.");
  }

  const platforms = campaign.platforms;
  const topic = buildSourceCampaignTopic({
    campaignName: campaign.name,
    brief: campaign.brief,
    sourceTitle: source.title,
    sourceText: source.sourceText,
    platforms,
  });
  const estimate = estimateAgentRunCostUsd({
    platformCount: Math.max(1, platforms.length),
    provider: env.LLM_PROVIDER,
  });

  const { runId } = await startMeteredAgentRun({
    clerkUserId: userId,
    plan: {
      niche: topic,
      platforms,
      campaignId: campaign.id,
      campaignSourceId: source.id,
      budget: buildRunBudget({ estimate }),
    },
    firstStep: {
      agent: AgentName.Lyra,
      payload: { topic, platforms },
    },
    limits,
    rateLimitBucket: `campaign-source-run:${userId}`,
  });
  await enqueueWebhookEvent({
    clerkUserId: userId,
    eventType: "agent.run_started",
    payload: { runId, campaignId: campaign.id, sourceId: source.id },
  });
  revalidatePath("/campaigns");
  revalidatePath("/runs");
}

export async function createCampaignExperimentAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const campaignId = String(formData.get("campaignId") ?? "");
  const campaign = await getUserCampaign(campaignId, userId);
  if (!campaign) throw new Error("Campaign not found.");

  const name = String(formData.get("name") ?? "").trim();
  const hypothesis = String(formData.get("hypothesis") ?? "").trim();
  if (!name) throw new Error("Name the experiment.");

  await createCampaignExperiment({
    clerkUserId: userId,
    campaignId: campaign.id,
    name: name.slice(0, 120),
    hypothesis: hypothesis.slice(0, 1_000),
    status: "draft",
  });
  revalidatePath("/campaigns");
}

export async function createCampaignApprovalLinkAction(input: {
  campaignId: string;
  email: string;
}): Promise<{ url: string }> {
  const userId = await requireUserId();
  await requireRole("creator");
  const campaign = await getUserCampaign(input.campaignId, userId);
  if (!campaign) throw new Error("Campaign not found.");
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Enter a client email.");

  const { token, tokenHash } = generateApprovalToken();
  await createApprovalLink({
    clerkUserId: userId,
    campaignId: campaign.id,
    email,
    tokenHash,
    status: "active",
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60_000),
  });
  const baseUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { url: `${baseUrl.replace(/\/$/, "")}/approve/${token}` };
}

export async function createAttributionLinkAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const campaignId = String(formData.get("campaignId") ?? "");
  const campaign = await getUserCampaign(campaignId, userId);
  if (!campaign) throw new Error("Campaign not found.");

  const label = String(formData.get("label") ?? "").trim();
  const destinationUrl = String(formData.get("destinationUrl") ?? "").trim();
  if (!label) throw new Error("Name the link.");
  const utmParams = {
    utm_source: String(formData.get("utmSource") ?? "").trim(),
    utm_medium: String(formData.get("utmMedium") ?? "social").trim(),
    utm_campaign:
      String(formData.get("utmCampaign") ?? "").trim() || campaign.name,
  };
  const trackedUrl = buildAttributionUrl(destinationUrl, utmParams);

  await createAttributionLink({
    clerkUserId: userId,
    campaignId: campaign.id,
    label: label.slice(0, 120),
    destinationUrl,
    utmParams,
    trackedUrl,
  });
  revalidatePath("/campaigns");
}

export async function createCompetitorWatchAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const competitorName = String(formData.get("competitorName") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  if (!competitorName) throw new Error("Name the competitor.");

  await createCompetitorWatch({
    clerkUserId: userId,
    competitorName: competitorName.slice(0, 120),
    sourceUrl: sourceUrl || null,
    status: "active",
    lastFinding: sourceUrl
      ? { status: "configured", note: "Awaiting external collection provider." }
      : { status: "configured" },
  });
  revalidatePath("/campaigns");
}
