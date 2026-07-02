import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUserId } from "@/lib/clerk";
import {
  listPendingReviews,
  type PendingReview,
} from "@/lib/repos/content-reviews";
import { listDisclosures } from "@/lib/repos/disclosure-ledger";
import { getQualityReport } from "@/lib/repos/quality";

import { CompliancePanel } from "./compliance-panel";
import { QualityPanel } from "./quality-panel";
import { ReviewQueue } from "./review-queue";

const TABS = ["queue", "quality", "compliance"] as const;
type GovernanceTab = (typeof TABS)[number];

function isGovernanceTab(value: string | undefined): value is GovernanceTab {
  return TABS.includes(value as GovernanceTab);
}

function firstValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function GovernancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const requestedTab = firstValue(sp.tab);
  const defaultTab: GovernanceTab = isGovernanceTab(requestedTab)
    ? requestedTab
    : "queue";

  const [pending, report, disclosures] = await Promise.all([
    listPendingReviews(userId),
    getQualityReport(userId),
    listDisclosures(userId),
  ]);

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
        title="Governance"
        description="Drafts held for approval, brand-safety quality metrics, and the AI-disclosure compliance ledger."
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="queue">
            Queue
            {runs.length > 0 && (
              <span className="bg-secondary text-secondary-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium">
                {runs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="compliance">Compliance ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <ReviewQueue runs={runs} />
        </TabsContent>

        <TabsContent value="quality">
          <QualityPanel report={report} />
        </TabsContent>

        <TabsContent value="compliance">
          <CompliancePanel entries={disclosures} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
