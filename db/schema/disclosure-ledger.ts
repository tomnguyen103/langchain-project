import { boolean, index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { platformEnum } from "./enums";
import { postTargets } from "./post-targets";
import { timestamps } from "./_helpers";

/**
 * Append-only audit of AI-content disclosure applied when the agent publishes
 * (Aletheia). One row per published target the disclosure engine acted on: which
 * native label was flagged, what disclosure text was appended, and under which
 * policy/jurisdiction — so a tenant can evidence compliance (EU AI Act Art. 50,
 * CA SB 942). post_target_id is SET NULL on delete so the audit row survives.
 */
export const disclosureLedger = pgTable(
  "disclosure_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    postTargetId: uuid("post_target_id").references(() => postTargets.id, {
      onDelete: "set null",
    }),
    platform: platformEnum("platform").notNull(),
    /** Whether the platform's native AI-content label was flagged for this post. */
    platformLabelApplied: boolean("platform_label_applied")
      .notNull()
      .default(false),
    /** Disclosure text appended to the body (null = none applied). */
    disclosureText: text("disclosure_text"),
    /** Free-text jurisdiction tag recorded for audit (e.g. "EU", "US-CA"). */
    jurisdiction: text("jurisdiction"),
    /** Disclosure-policy version in effect when the row was written. */
    policyVersion: text("policy_version").notNull(),
    ...timestamps,
  },
  (t) => [
    index("disclosure_ledger_user_idx").on(t.clerkUserId),
    index("disclosure_ledger_target_idx").on(t.postTargetId),
  ],
);

export type DisclosureLedgerEntry = typeof disclosureLedger.$inferSelect;
export type NewDisclosureLedgerEntry = typeof disclosureLedger.$inferInsert;
