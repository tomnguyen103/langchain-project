import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import {
  approvalLinks,
  campaigns,
  campaignSources,
  type ApprovalLink,
  type Campaign,
  type CampaignSource,
  type NewApprovalLink,
} from "@/db/schema";
import { hashIntegrationToken } from "@/lib/integrations/tokens";

export async function createApprovalLink(
  data: NewApprovalLink,
): Promise<ApprovalLink> {
  const [row] = await db.insert(approvalLinks).values(data).returning();
  return row;
}

export async function getApprovalPortalByToken(
  token: string,
): Promise<
  | {
      link: ApprovalLink;
      campaign: Campaign | null;
      sources: CampaignSource[];
    }
  | undefined
> {
  const tokenHash = hashIntegrationToken(token);
  const [row] = await db
    .select({ link: approvalLinks, campaign: campaigns })
    .from(approvalLinks)
    .leftJoin(campaigns, eq(approvalLinks.campaignId, campaigns.id))
    .where(
      and(
        eq(approvalLinks.tokenHash, tokenHash),
        eq(approvalLinks.status, "active"),
        gt(approvalLinks.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return undefined;
  const sources = row.campaign
    ? await db
        .select()
        .from(campaignSources)
        .where(eq(campaignSources.campaignId, row.campaign.id))
    : [];
  return { ...row, sources };
}

/**
 * Atomically claim a link for use: the UPDATE only matches a row still
 * `active`, so of two concurrent submissions for the same token only one can
 * win. Returns false if the link was already used (or claimed by a
 * concurrent request) by the time this runs.
 */
export async function markApprovalLinkUsed(id: string): Promise<boolean> {
  const rows = await db
    .update(approvalLinks)
    .set({ status: "used", usedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(approvalLinks.id, id), eq(approvalLinks.status, "active")))
    .returning({ id: approvalLinks.id });
  return rows.length > 0;
}
