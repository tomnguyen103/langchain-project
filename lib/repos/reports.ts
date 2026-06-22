import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { reports, type Report, type ReportData } from "@/db/schema";

/** Persist a compiled report for a user/period. */
export async function saveReport(
  clerkUserId: string,
  period: string,
  data: ReportData,
): Promise<Report> {
  const [row] = await db
    .insert(reports)
    .values({ clerkUserId, period, data })
    .returning();
  return row;
}

/** The most recent report for a user — Orion's feed-forward input. */
export async function getLatestReport(
  clerkUserId: string,
): Promise<Report | undefined> {
  const [row] = await db
    .select()
    .from(reports)
    .where(eq(reports.clerkUserId, clerkUserId))
    .orderBy(desc(reports.createdAt))
    .limit(1);
  return row;
}
