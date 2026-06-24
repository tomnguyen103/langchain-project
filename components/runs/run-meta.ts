import type { AgentRunStatus, AgentStepStatus } from "@/db/schema/enums";

/** The Badge variants this app ships (see components/ui/badge.tsx). */
type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

/** Display name + role for each roster agent — presentation only. */
const AGENT_LABELS: Record<string, { name: string; role: string }> = {
  orion: { name: "Orion", role: "Orchestrator" },
  vega: { name: "Vega", role: "Research" },
  lyra: { name: "Lyra", role: "Content" },
  castor: { name: "Castor", role: "Brand safety" },
  atlas: { name: "Atlas", role: "Publishing" },
  sirius: { name: "Sirius", role: "Engagement" },
  polaris: { name: "Polaris", role: "Seeding" },
  rigel: { name: "Rigel", role: "Reporting" },
};

/** Resolve an agent wire-id to its label, falling back to the raw id. */
export function agentLabel(agent: string): { name: string; role: string } {
  return AGENT_LABELS[agent] ?? { name: agent, role: "" };
}

/** Label + Badge variant for a whole-run status. */
export function runStatusBadge(status: AgentRunStatus): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case "running":
      return { label: "Running", variant: "default" };
    case "completed":
      return { label: "Completed", variant: "outline" };
    case "failed":
      return { label: "Failed", variant: "destructive" };
    case "rejected":
      return { label: "Rejected", variant: "destructive" };
    case "cancelled":
      return { label: "Cancelled", variant: "outline" };
    case "awaiting_approval":
      return { label: "Awaiting approval", variant: "secondary" };
    case "pending":
      return { label: "Pending", variant: "secondary" };
  }
}

/** Label + Badge variant for a single step's status. */
export function stepStatusBadge(status: AgentStepStatus): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case "running":
      return { label: "running", variant: "default" };
    case "completed":
      return { label: "completed", variant: "outline" };
    case "failed":
      return { label: "failed", variant: "destructive" };
    case "pending":
      return { label: "pending", variant: "secondary" };
  }
}
