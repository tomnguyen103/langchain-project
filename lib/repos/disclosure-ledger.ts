import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  disclosureLedger,
  type DisclosureLedgerEntry,
  type NewDisclosureLedgerEntry,
} from "@/db/schema";

/** Append disclosure audit rows (one per published target the engine acted on). */
export async function recordDisclosures(
  entries: NewDisclosureLedgerEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  await db.insert(disclosureLedger).values(entries);
}

/** A tenant's disclosure audit, most recent first (for the /compliance page). */
export async function listDisclosures(
  clerkUserId: string,
  limit = 100,
): Promise<DisclosureLedgerEntry[]> {
  return db
    .select()
    .from(disclosureLedger)
    .where(eq(disclosureLedger.clerkUserId, clerkUserId))
    .orderBy(desc(disclosureLedger.createdAt))
    .limit(limit);
}
