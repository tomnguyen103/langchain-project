import { format } from "date-fns";
import Link from "next/link";
import { ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireUserId } from "@/lib/clerk";
import { listDisclosures } from "@/lib/repos/disclosure-ledger";

export default async function CompliancePage() {
  const userId = await requireUserId();
  const entries = await listDisclosures(userId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Compliance ledger"
        description="An audit of AI-content disclosure applied when the agent published — evidence for platform and regional rules (EU AI Act Art. 50, CA SB 942)."
        actions={
          <Link
            href="/settings"
            className="text-muted-foreground hover:text-foreground text-sm underline"
          >
            Configure
          </Link>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No disclosures yet"
          description="When the agent publishes AI content with disclosure turned on, each post is recorded here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-2 p-3 text-sm"
                >
                  <Badge variant="outline">{entry.platform}</Badge>
                  {entry.platformLabelApplied ? (
                    <Badge>native label</Badge>
                  ) : null}
                  {entry.disclosureText ? (
                    <span className="text-muted-foreground">
                      &ldquo;{entry.disclosureText}&rdquo;
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">
                      no text appended
                    </span>
                  )}
                  {entry.jurisdiction ? (
                    <Badge variant="secondary">{entry.jurisdiction}</Badge>
                  ) : null}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {format(entry.createdAt, "PP p")}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
