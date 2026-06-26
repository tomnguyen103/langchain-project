"use server";

import { redirect } from "next/navigation";

import {
  getApprovalPortalByToken,
  markApprovalLinkUsed,
} from "@/lib/repos/approval-links";
import { updateCampaign } from "@/lib/repos/campaigns";

export async function decideApprovalLinkAction(
  formData: FormData,
): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const decision = String(formData.get("decision") ?? "");
  const portal = await getApprovalPortalByToken(token);
  if (!portal?.campaign) throw new Error("Approval link is no longer valid.");
  if (email !== portal.link.email.toLowerCase()) {
    throw new Error("Email does not match this approval link.");
  }

  await markApprovalLinkUsed(portal.link.id);
  if (decision === "approve") {
    await updateCampaign(portal.campaign.id, portal.link.clerkUserId, {
      status: "active",
    });
  }
  redirect(`/approve/${token}?done=${decision === "approve" ? "approved" : "sent"}`);
}
