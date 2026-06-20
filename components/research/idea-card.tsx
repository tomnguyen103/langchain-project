import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type IdeaView = { id: string; content: string };

export function IdeaCard({ idea }: { idea: IdeaView }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <p className="text-sm">{idea.content}</p>
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href={`/create?topic=${encodeURIComponent(idea.content)}`}>
            Use in composer <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
