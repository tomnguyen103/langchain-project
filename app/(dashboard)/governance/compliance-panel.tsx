import { format } from "date-fns";
import Link from "next/link";
import { ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { DisclosureLedgerEntry } from "@/db/schema";

export function CompliancePanel({
  entries,
}: {
  entries: DisclosureLedgerEntry[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          An audit of AI-content disclosure applied when the agent published —
          evidence for platform and regional rules (EU AI Act Art. 50, CA SB
          942).
        </p>
        <Link
          href="/settings?tab=ai-disclosure"
          className="text-muted-foreground hover:text-foreground shrink-0 text-sm underline"
        >
          Configure
        </Link>
      </div>

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
