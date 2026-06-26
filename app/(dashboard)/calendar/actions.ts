"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/current-role";
import { getPlanLimits } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { createMensa } from "@/lib/agents/mensa";
import { listSocialAccounts } from "@/lib/repos/accounts";
import { getBrandProfile } from "@/lib/repos/brand-profiles";
import { getLatestReport } from "@/lib/repos/reports";
import { createContentPlan } from "@/lib/repos/content-plans";

const PRO_SLOT_CAP = 14;

export async function generatePlan(): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");

  const limits = await getPlanLimits();
  if (!limits.research) {
    throw new Error("Content planning is a Pro feature. Upgrade to use it.");
  }

  const accounts = await listSocialAccounts(userId);
  const platforms = [...new Set(accounts.filter((a) => a.status === "active").map((a) => a.platform))];
  if (platforms.length === 0) {
    throw new Error("Connect at least one active account before generating a plan.");
  }

  const mensa = createMensa({
    getLatestReport: async (uid) => (await getLatestReport(uid)) ?? null,
    getLearnedMemory: async (uid) => {
      const profile = await getBrandProfile(uid);
      return profile.learnedMemory;
    },
  });

  const maxSlots = PRO_SLOT_CAP;
  const output = await mensa.generatePlan(userId, { platforms, maxSlots });

  const plan = await createContentPlan({
    clerkUserId: userId,
    periodStart: new Date(output.periodStart),
    periodEnd: new Date(output.periodEnd),
    status: "draft",
    slots: output.slots,
  });

  redirect(`/plans/${plan.id}`);
}
