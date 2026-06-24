/**
 * Per-item review (Agent Inbox) run-resolution decision.
 *
 * The brand-safety gate (Castor) pauses a run (awaiting_approval) whenever it
 * holds any draft. With per-item review a human resolves drafts one at a time
 * (Accept / Edit→Accept / Reject / Ignore); the run can only finish once nothing
 * is still held:
 *   - "stay"   — at least one draft is still held; keep the run paused.
 *   - "resume" — nothing held and >=1 accepted; resume to Atlas to publish them.
 *   - "reject" — nothing held and none accepted; finalize the run as rejected.
 */
export type ReviewResolution = "stay" | "resume" | "reject";

export function resolveReviewDecision(counts: {
  heldCount: number;
  acceptedCount: number;
}): ReviewResolution {
  if (counts.heldCount > 0) return "stay";
  return counts.acceptedCount > 0 ? "resume" : "reject";
}
