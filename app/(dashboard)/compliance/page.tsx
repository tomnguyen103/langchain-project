import { format } from "date-fns";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireUserId } from "@/lib/clerk";
import { listDisclosures } from "@/lib/repos/disclosure-ledger";

export default async function CompliancePage() {
  const userId = await requireUserId();
  const entries = await listDisclosures(userId);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Compliance ledger
        </h1>
        <p className="text-muted-foreground text-sm">
          An audit of AI-content disclosure applied when the agent published —
          evidence for platform and regional rules (EU AI Act Art. 50, CA SB
          942). Configure it in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      </header>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">No disclosures yet</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
              When the agent publishes AI content with disclosure turned on, each
              post is recorded here.
            </p>
          </CardContent>
        </Card>
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
