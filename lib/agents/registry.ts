import { AgentName, type AgentDefinition } from "./types";

/**
 * The roster registry — the ONLY lookup from an {@link AgentName} to its
 * implementation. No `switch` statements anywhere in the orchestration layer;
 * everything routes through {@link getAgent} (mirrors lib/platforms/registry.ts).
 *
 * Populated incrementally as agents land: A1 adds Vega/Lyra/Atlas, A3 Sirius,
 * A4 Rigel, A5 Polaris. Until an agent is registered, {@link getAgent} throws a
 * clear error — expected for not-yet-implemented agents.
 */
const REGISTRY: Partial<Record<AgentName, AgentDefinition>> = {
  // Agents register here as they are implemented. Empty until Goal A1.
};

/** Resolve an agent's definition. Throws if the agent isn't registered yet. */
export function getAgent(name: AgentName): AgentDefinition {
  const agent = REGISTRY[name];
  if (!agent) {
    throw new Error(
      `Agent not registered: "${name}". Add its AgentDefinition to lib/agents/registry.ts.`,
    );
  }
  return agent;
}

/** Whether an agent currently has a registered implementation. */
export function hasAgent(name: AgentName): boolean {
  return Boolean(REGISTRY[name]);
}
