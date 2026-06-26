export type EngagementTotals = {
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  totalShares: number;
  postsWithMetrics: number;
};

export type CampaignRecommendation = {
  name: string;
  hypothesis: string;
  confidence: "low" | "medium" | "high";
};

export function recommendCampaignExperiments(
  totals: EngagementTotals,
): CampaignRecommendation[] {
  if (totals.postsWithMetrics === 0) {
    return [
      {
        name: "Baseline message test",
        hypothesis: "Run two clear positioning variants to establish a metrics baseline.",
        confidence: "low",
      },
    ];
  }

  const engagement =
    totals.totalLikes + totals.totalComments + totals.totalShares;
  const commentRate = totals.totalViews > 0 ? totals.totalComments / totals.totalViews : 0;
  const shareRate = totals.totalViews > 0 ? totals.totalShares / totals.totalViews : 0;
  const recommendations: CampaignRecommendation[] = [];

  if (commentRate < 0.01) {
    recommendations.push({
      name: "Question-led CTA",
      hypothesis:
        "A concrete question in the final line should increase comment rate.",
      confidence: engagement > 50 ? "medium" : "low",
    });
  }

  if (shareRate < 0.005) {
    recommendations.push({
      name: "Utility hook",
      hypothesis:
        "A checklist or template-style hook should increase shares per view.",
      confidence: engagement > 100 ? "medium" : "low",
    });
  }

  recommendations.push({
    name: "Proof-first opener",
    hypothesis:
      "Opening with a metric, customer quote, or concrete result should improve early engagement.",
    confidence: totals.postsWithMetrics >= 10 ? "high" : "medium",
  });

  return recommendations.slice(0, 3);
}
