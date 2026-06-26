export type CampaignSimulationLevel = "warn" | "block";
export type CampaignSimulationRecommendation =
  | "ready"
  | "approve_with_warnings"
  | "hold";

export type CampaignSimulationDraft = {
  id: string;
  platform: string | null;
  content: string;
  violations?: Array<{
    rule: string;
    detail: string;
    level?: CampaignSimulationLevel;
  }> | null;
};

export type CampaignSimulationFinding = {
  draftId: string;
  platform: string | null;
  rule: string;
  detail: string;
  level: CampaignSimulationLevel;
};

export type CampaignSimulation = {
  draftCount: number;
  platformCount: number;
  score: number;
  blockCount: number;
  warnCount: number;
  recommendation: CampaignSimulationRecommendation;
  findings: CampaignSimulationFinding[];
};

function levelFor(rule: string, level: CampaignSimulationLevel | undefined) {
  if (level) return level;
  return rule.startsWith("consistency_") ? "block" : "warn";
}

export function buildCampaignSimulation(
  drafts: CampaignSimulationDraft[],
): CampaignSimulation {
  const findings = drafts.flatMap((draft) =>
    (draft.violations ?? []).map((violation) => ({
      draftId: draft.id,
      platform: draft.platform,
      rule: violation.rule,
      detail: violation.detail,
      level: levelFor(violation.rule, violation.level),
    })),
  );
  const blockCount = findings.filter((finding) => finding.level === "block").length;
  const warnCount = findings.length - blockCount;
  const score = Math.max(0, 100 - blockCount * 35 - warnCount * 10);
  return {
    draftCount: drafts.length,
    platformCount: new Set(drafts.map((draft) => draft.platform ?? "generic")).size,
    score,
    blockCount,
    warnCount,
    recommendation:
      blockCount > 0
        ? "hold"
        : warnCount > 0
          ? "approve_with_warnings"
          : "ready",
    findings,
  };
}
