import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  campaignExperiments,
  campaigns,
  campaignSources,
  attributionLinks,
  type AttributionLink,
  type Campaign,
  type CampaignExperiment,
  type CampaignSource,
  type NewCampaign,
  type NewCampaignExperiment,
  type NewCampaignSource,
} from "@/db/schema";

export type CampaignWorkspace = Campaign & {
  sources: CampaignSource[];
  experiments: CampaignExperiment[];
  attributionLinks: AttributionLink[];
};

export async function listCampaignWorkspaces(
  clerkUserId: string,
): Promise<CampaignWorkspace[]> {
  const rows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.clerkUserId, clerkUserId))
    .orderBy(desc(campaigns.updatedAt))
    .limit(50);
  if (rows.length === 0) return [];

  const ids = rows.map((campaign) => campaign.id);
  const [sources, experiments, links] = await Promise.all([
    db
      .select()
      .from(campaignSources)
      .where(inArray(campaignSources.campaignId, ids))
      .orderBy(desc(campaignSources.createdAt)),
    db
      .select()
      .from(campaignExperiments)
      .where(inArray(campaignExperiments.campaignId, ids))
      .orderBy(desc(campaignExperiments.createdAt)),
    db
      .select()
      .from(attributionLinks)
      .where(inArray(attributionLinks.campaignId, ids))
      .orderBy(desc(attributionLinks.createdAt)),
  ]);

  return rows.map((campaign) => ({
    ...campaign,
    sources: sources.filter((source) => source.campaignId === campaign.id),
    experiments: experiments.filter(
      (experiment) => experiment.campaignId === campaign.id,
    ),
    attributionLinks: links.filter((link) => link.campaignId === campaign.id),
  }));
}

export async function createCampaign(data: NewCampaign): Promise<Campaign> {
  const [row] = await db.insert(campaigns).values(data).returning();
  return row;
}

export async function updateCampaign(
  id: string,
  clerkUserId: string,
  data: Partial<NewCampaign>,
): Promise<void> {
  await db
    .update(campaigns)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.clerkUserId, clerkUserId)));
}

export async function getUserCampaign(
  id: string,
  clerkUserId: string,
): Promise<Campaign | undefined> {
  const [row] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.clerkUserId, clerkUserId)))
    .limit(1);
  return row;
}

export async function createCampaignSource(
  data: NewCampaignSource,
): Promise<CampaignSource> {
  const [row] = await db.insert(campaignSources).values(data).returning();
  return row;
}

export async function getUserCampaignSource(
  id: string,
  clerkUserId: string,
): Promise<CampaignSource | undefined> {
  const [row] = await db
    .select()
    .from(campaignSources)
    .where(
      and(eq(campaignSources.id, id), eq(campaignSources.clerkUserId, clerkUserId)),
    )
    .limit(1);
  return row;
}

export async function createCampaignExperiment(
  data: NewCampaignExperiment,
): Promise<CampaignExperiment> {
  const [row] = await db.insert(campaignExperiments).values(data).returning();
  return row;
}
