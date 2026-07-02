import type { CampaignSource } from "@/db/schema";
import { AddSourceForm, StartSourceRunButton } from "./source-forms";

export function SourcesTab({
  campaignId,
  sources,
}: {
  campaignId: string;
  sources: CampaignSource[];
}) {
  return (
    <div className="space-y-4">
      <AddSourceForm campaignId={campaignId} />

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
              <StartSourceRunButton campaignId={campaignId} sourceId={source.id} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
