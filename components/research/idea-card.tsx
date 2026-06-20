import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type IdeaView = {
  id: string;
  content: string;
  traceUrl?: string | null;
};

export function IdeaCard({ idea }: { idea: IdeaView }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <p className="text-sm">{idea.content}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/create?topic=${encodeURIComponent(idea.content)}`}>
              Use in composer <ArrowRight className="size-4" />
            </Link>
          </Button>
          {idea.traceUrl ? (
            <Button asChild variant="ghost" size="sm">
              <a
                href={idea.traceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Activity className="size-4" /> Trace
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
