import { AgentName, type AgentCapability } from "./types";

/**
 * The declared least-privilege capability matrix for the roster.
 *
 * The REAL enforcement is structural: the registry (lib/agents/registry.ts)
 * injects only the deps each agent needs, so e.g. Castor has no publish
 * dependency and literally cannot schedule posts. This map makes that contract
 * explicit and auditable — and the accompanying test fails if a sensitive
 * capability (e.g. `publish`) is ever granted to an agent that shouldn't have it.
 */
export const AGENT_CAPABILITIES: Record<AgentName, readonly AgentCapability[]> =
  {
    [AgentName.Orion]: ["orchestrate"],
    [AgentName.Vega]: ["research"],
    [AgentName.Lyra]: ["generate"],
    [AgentName.Castor]: ["review"],
    [AgentName.Atlas]: ["publish"],
    [AgentName.Sirius]: ["engage"],
    [AgentName.Rigel]: ["report"],
    [AgentName.Polaris]: ["seed"],
  };

/** Whether an agent is permitted a capability per the matrix. */
export function hasCapability(
  agent: AgentName,
  capability: AgentCapability,
): boolean {
  return AGENT_CAPABILITIES[agent].includes(capability);
}

/** Assert an agent is permitted a capability, else throw. */
export function assertCapability(
  agent: AgentName,
  capability: AgentCapability,
): void {
  if (!hasCapability(agent, capability)) {
    throw new Error(`Agent "${agent}" is not permitted to ${capability}.`);
  }
}
