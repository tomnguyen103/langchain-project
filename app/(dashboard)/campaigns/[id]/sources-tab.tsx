import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CampaignSource } from "@/db/schema";
import { addCampaignSourceAction, startCampaignSourceRunAction } from "../actions";

export function SourcesTab({
  campaignId,
  sources,
}: {
  campaignId: string;
  sources: CampaignSource[];
}) {
  return (
    <div className="space-y-4">
      <form action={addCampaignSourceAction} className="space-y-3">
        <input type="hidden" name="campaignId" value={campaignId} />
        <Input name="title" placeholder="Source title" />
        <Textarea
          name="sourceText"
          rows={4}
          placeholder="Paste webinar notes, a blog post, sales notes, or a transcript excerpt"
        />
        <Button type="submit" size="sm" variant="outline">
          Add source
        </Button>
      </form>

      {sources.length > 0 ? (
        <div className="space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
            >
              <span className="min-w-0 flex-1 font-medium">
                {source.title}
                {source.summary ? (
                  <span className="text-muted-foreground mt-0.5 block truncate text-xs font-normal">
                    {source.summary}
                  </span>
                ) : null}
              </span>
              <form action={startCampaignSourceRunAction}>
                <input type="hidden" name="campaignId" value={campaignId} />
                <input type="hidden" name="sourceId" value={source.id} />
                <Button type="submit" size="sm">
                  Start run
                </Button>
              </form>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
