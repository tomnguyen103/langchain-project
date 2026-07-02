import { Button } from "@/components/ui/button";
import type { CampaignExperiment } from "@/db/schema";
import type { CampaignRecommendation } from "@/lib/campaigns/recommendations";
import { createCampaignExperimentAction } from "../actions";

export function ExperimentsTab({
  campaignId,
  recommendations,
  experiments,
}: {
  campaignId: string;
  recommendations: CampaignRecommendation[];
  experiments: CampaignExperiment[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 lg:grid-cols-3">
        {recommendations.map((recommendation) => (
          <form
            key={recommendation.name}
            action={createCampaignExperimentAction}
            className="rounded-lg border p-3"
          >
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="name" value={recommendation.name} />
            <input
              type="hidden"
              name="hypothesis"
              value={recommendation.hypothesis}
            />
            <p className="text-sm font-medium">{recommendation.name}</p>
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
              {recommendation.hypothesis}
            </p>
            <Button type="submit" size="sm" variant="outline" className="mt-3">
              Save experiment
            </Button>
          </form>
        ))}
      </div>

      {experiments.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Experiments</p>
          <div className="space-y-2">
            {experiments.map((experiment) => (
              <div key={experiment.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{experiment.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {experiment.status}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {experiment.hypothesis}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
