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

/** Hand off to the next agent. */
type AgentHandoffResult = {
  summary?: Record<string, unknown>;
  handoff: { to: AgentName; payload: unknown };
  control?: never;
};

/** Pause the run for human approval (Castor's brand-safety gate). */
type AgentPauseResult = {
  summary?: Record<string, unknown>;
  control: { pause: "awaiting_approval"; reason?: string };
  handoff?: never;
};

/** Terminal: no handoff and no pause — the run completes. */
type AgentCompleteResult = {
  summary?: Record<string, unknown>;
  handoff?: undefined;
  control?: undefined;
};

/**
 * What an agent returns. A discriminated union so `handoff` and `control`
 * (pause) are mutually exclusive at the type level — an agent either hands off,
 * pauses for approval, or terminates the run.
 */
export type AgentResult =
  | AgentHandoffResult
  | AgentPauseResult
  | AgentCompleteResult;

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
