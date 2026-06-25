import type { ReportData, ReportInsight } from "@/db/schema";

/**
 * Narrate — generates 3-5 grounded, actionable insights from a compiled
 * ReportData. Deterministic and pure: every insight cites only figures present
 * in the input so no LLM is needed to avoid hallucinated stats. An LLM layer
 * can be added on top later to enrich the wording without touching the safety
 * invariant (never claim a number not in the report).
 */
export function narrateReport(data: ReportData): ReportInsight[] {
  const insights: ReportInsight[] = [];
  const periodDays = parseInt(data.period.replace("d", ""), 10) || 7;

  // 1. Topic winner — by engagement if available, by publish count otherwise.
  const engagedTopics = [...data.topTopics]
    .filter((t) => t.engagement > 0)
    .sort((a, b) => b.engagement - a.engagement);

  if (engagedTopics.length >= 2) {
    const [first, second] = engagedTopics;
    const ratio =
      Math.round((first.engagement / Math.max(second.engagement, 1)) * 10) / 10;
    insights.push({
      type: "topic_winner",
      headline: `"${first.topic}" is your top performer`,
      detail: `${first.engagement.toLocaleString()} total interactions — ${ratio}× more than "${second.topic}" (${second.engagement.toLocaleString()}). Lean into this topic.`,
      action: {
        label: "Generate more like this",
        href: `/create?topic=${encodeURIComponent(first.topic)}`,
      },
    });
  } else if (engagedTopics.length === 1) {
    const [top] = engagedTopics;
    insights.push({
      type: "topic_winner",
      headline: `"${top.topic}" is driving all your engagement`,
      detail: `${top.engagement.toLocaleString()} interactions — more data from other topics will sharpen the comparison.`,
      action: {
        label: "Generate more like this",
        href: `/create?topic=${encodeURIComponent(top.topic)}`,
      },
    });
  } else if (data.topTopics.length >= 1) {
    const [top] = data.topTopics;
    insights.push({
      type: "topic_winner",
      headline: `"${top.topic}" is your most-published topic`,
      detail: `${top.published} post${top.published === 1 ? "" : "s"} in the last ${data.period}. Engagement data will populate once Pulse has polled your published posts.`,
    });
  }

  // 2. Publish cadence observation.
  const postsPerDay = data.totalPublished / periodDays;
  if (data.totalPublished === 0) {
    insights.push({
      type: "publish_cadence",
      headline: "No posts published this period",
      detail: `Start publishing to build momentum and unlock engagement insights.`,
      action: { label: "Create a post", href: "/create" },
    });
  } else if (postsPerDay < 0.5 && periodDays >= 7) {
    insights.push({
      type: "publish_cadence",
      headline: `${data.totalPublished} post${data.totalPublished === 1 ? "" : "s"} in the last ${data.period} — there's room to grow`,
      detail: `Publishing 3-5×/week typically lifts reach. Your current pace is ${postsPerDay.toFixed(1)}/day.`,
      action: { label: "Create more content", href: "/create" },
    });
  } else if (postsPerDay >= 1) {
    insights.push({
      type: "publish_cadence",
      headline: `Strong cadence: ${data.totalPublished} posts over ${data.period}`,
      detail: `${postsPerDay.toFixed(1)} posts/day on average. Consistent publishing is the strongest predictor of audience growth.`,
    });
  }

  // 3. Run success rate.
  const successPct = Math.round(data.runSuccessRate * 100);
  if (data.runSuccessRate < 0.8 && data.runSuccessRate > 0) {
    insights.push({
      type: "success_rate",
      headline: `Only ${successPct}% of agent runs completed`,
      detail: `${data.failedPublishCount} failed publish${data.failedPublishCount === 1 ? "" : "es"} this period. Check account health and retry failed posts.`,
      action: { label: "View failed posts", href: "/posts" },
    });
  } else if (data.runSuccessRate >= 0.95 && data.totalPublished > 0) {
    insights.push({
      type: "success_rate",
      headline: `${successPct}% run success rate — pipeline healthy`,
      detail: `Your publishing pipeline is reliable across ${data.totalPublished} post${data.totalPublished === 1 ? "" : "s"}.`,
    });
  }

  // 4. Failed publishes (even when overall rate is OK).
  if (
    data.failedPublishCount > 0 &&
    data.runSuccessRate >= 0.8
  ) {
    insights.push({
      type: "publish_failure",
      headline: `${data.failedPublishCount} publish${data.failedPublishCount === 1 ? "" : "es"} failed`,
      detail: `Most runs succeeded but ${data.failedPublishCount} target${data.failedPublishCount === 1 ? "" : "s"} didn't go live. Retry or check account health.`,
      action: { label: "Review posts", href: "/posts" },
    });
  }

  // 5. No-data state — show how to unlock insights.
  if (insights.length === 0) {
    insights.push({
      type: "empty",
      headline: "No publishing activity yet",
      detail: `Create and publish your first post to start generating insights.`,
      action: { label: "Create a post", href: "/create" },
    });
  }

  return insights.slice(0, 5);
}
