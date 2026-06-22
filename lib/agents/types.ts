/**
 * Agent-orchestration contract — the small interface every roster agent
 * implements, mirroring how `PlatformConnector` unifies platforms today (one
 * interface, one registry, zero `switch` statements).
 *
 * Types only: this module has no runtime dependencies, so it can be imported
 * from anywhere (schema, repos, worker, app) without pulling in heavy code.
 * See docs/ORCHESTRATION.md → "Core contract".
 */

/**
 * The named roster (constellation names). Values are stable wire identifiers
 * reused across queues, the `agent_runs`/`agent_steps` tables, and LangSmith —
 * do not rename them without a migration.
 */
export enum AgentName {
  Orion = "orion", // orchestrator / strategist
  Vega = "vega", // niche research
  Lyra = "lyra", // content generation (draft → critique → refine)
  Atlas = "atlas", // autopost / scheduling
  Sirius = "sirius", // engagement / auto-reply
  Polaris = "polaris", // group seeding
  Rigel = "rigel", // reporting / insights
  Castor = "castor", // brand-safety review / approval gate (Lyra → Castor → Atlas)
}

/** Ambient context threaded through every step of one pipeline run. */
export interface AgentContext {
  clerkUserId: string;
  clerkOrgId?: string;
  /** Correlates every step of one pipeline run across queues + LangSmith. */
  runId: string;
}

/** What an agent returns: an optional handoff to the next agent + a summary. */
export interface AgentResult {
  /** Which agent (if any) the orchestrator should hand off to next. */
  handoff?: { to: AgentName; payload: unknown };
  /** Structured summary for Rigel + LangSmith. */
  summary?: Record<string, unknown>;
  /**
   * Pause the run for human approval instead of handing off or completing.
   * Mutually exclusive with `handoff`; used by Castor's brand-safety gate.
   */
  control?: { pause: "awaiting_approval"; reason?: string };
}

/**
 * One roster agent. `run` performs a single unit of this agent's work and is a
 * method (not a function property) on purpose: method parameters are checked
 * bivariantly, so a typed `AgentDefinition<SpecificInput>` is assignable to the
 * registry's `AgentDefinition<unknown>` slot without casts.
 */
export interface AgentDefinition<Input = unknown> {
  name: AgentName;
  /** Run one unit of work. Side effects go through injected repos/queues. */
  run(input: Input, ctx: AgentContext): Promise<AgentResult>;
}
