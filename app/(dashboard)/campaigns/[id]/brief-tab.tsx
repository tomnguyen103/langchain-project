import {
  crisisRiskRadar,
  platformAlgorithmCoach,
  simulateAudience,
  strategyDebate,
  suggestHashtags,
  transformForPlatform,
} from "@/lib/campaigns/toolkit";
import type { Platform } from "@/db/schema";

export function BriefTab({
  name,
  brief,
  platforms,
}: {
  name: string;
  brief: string | null;
  platforms: Platform[];
}) {
  const basis = brief || name;
  const firstPlatform = platforms[0];
  const riskFindings = crisisRiskRadar(basis);

  return (
    <div className="space-y-4">
      {brief ? <p className="text-muted-foreground text-sm">{brief}</p> : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Audience simulation</p>
          <div className="mt-2 space-y-1">
            {simulateAudience(basis).map((reaction) => (
              <p key={reaction.segment} className="text-xs">
                <span className="font-medium">{reaction.segment}:</span>{" "}
                {reaction.reaction}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Optimization</p>
          <p className="text-muted-foreground mt-2 text-xs">
            {suggestHashtags(basis).join(" ") || "No hashtags"}
          </p>
          {firstPlatform ? (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
              {transformForPlatform(basis, firstPlatform)}
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Risk and coaching</p>
          <p className="text-muted-foreground mt-2 text-xs">
            {riskFindings.length === 0
              ? "No crisis keywords detected."
              : riskFindings.map((finding) => finding.rule).join(", ")}
          </p>
          {firstPlatform ? (
            <p className="text-muted-foreground mt-1 text-xs">
              {platformAlgorithmCoach(firstPlatform)[0]}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <p className="text-sm font-medium">Strategy debate</p>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {strategyDebate(basis).map((item) => (
            <p key={item.agent} className="text-muted-foreground text-xs">
              <span className="font-medium text-foreground">{item.agent}:</span>{" "}
              {item.position}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
