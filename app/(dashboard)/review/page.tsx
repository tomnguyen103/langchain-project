import { requireUserId } from "@/lib/clerk";
import {
  listPendingReviews,
  type PendingReview,
} from "@/lib/repos/content-reviews";
import { PageHeader } from "@/components/shared/page-header";

import { ReviewQueue } from "./review-queue";

export default async function ReviewPage() {
  const userId = await requireUserId();
  const pending = await listPendingReviews(userId);

  // Group held drafts by their run (Castor always stamps agentRunId on a held
  // draft); a run is approved/rejected as a unit.
  const byRun = new Map<string, PendingReview[]>();
  for (const draft of pending) {
    if (!draft.agentRunId) continue;
    const group = byRun.get(draft.agentRunId) ?? [];
    group.push(draft);
    byRun.set(draft.agentRunId, group);
  }
  const runs = [...byRun.entries()].map(([runId, drafts]) => ({ runId, drafts }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Review queue"
        description="Drafts the brand-safety agent held for your approval before publishing."
      />
      <ReviewQueue runs={runs} />
    </div>
  );
}
