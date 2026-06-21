# Agent Orchestration — Design Proposal

> **Status:** Design only. No code in this document has been merged. It proposes
> how to layer a roster of **named, autonomous content agents** on top of the
> existing system (the SocialFlow stack described in [PLAN.md](PLAN.md)) without
> rewriting what already works.
>
> Companion docs: [PLAN.md](PLAN.md) (architecture) · [ROADMAP.md](ROADMAP.md) (build phases).

## Why

Today the AI side of the product is **one** LangGraph `StateGraph` (`lib/agent/graph.ts`)
that runs `analyze → draftPerPlatform → critique → (refine ↩ | finalize) → END` for a
single topic, plus a research pre-step (`lib/agent/research.ts`) chained ahead of it
by `worker/processors/research.ts`. It works, but it is monolithic: research, drafting,
publishing, engagement, and reporting are separate concerns glued together by ad-hoc
queue chaining.

This proposal reframes those concerns as a **roster of agents**, each owning one slice
of the pipeline, coordinated by a thin **orchestrator** that hands work from one agent
to the next over the BullMQ queues that already exist. The goal is the "autonomous
content agents" model — research a niche → generate posts → autopost → engage → report,
on a loop — expressed in a way that drops cleanly into the current codebase.

**Design choice (locked):** *separate agent graphs + orchestrator.* Each agent is its
own small module/graph with a typed input/output; a top-level orchestrator routes work
between them via queues. This is more modular than wrapping the existing nodes, and it
matches the "agents that operate on their own" vision. The trade-off is more new code,
introduced in phases (see [Migration path](#migration-path)).

## The roster

Constellation names, each mapped to a concern that **already exists** in the codebase
so nothing is invented from scratch:

| Agent | Role | Maps onto today |
|---|---|---|
| **Orion** | Strategist / orchestrator | (new) the orchestrator itself + a planning step |
| **Vega** | Niche research | `lib/agent/research.ts` + `lib/agent/tools/web-search.ts` |
| **Lyra** | Content generation (draft → critique → refine) | `lib/agent/graph.ts` nodes `draft-per-platform`, `critique`, `refine`, `digest` |
| **Atlas** | Autopost / scheduling | `lib/queue/jobs.ts#enqueuePublish` + `worker/processors/publish.ts` |
| **Sirius** | Engagement / auto-reply | `worker/processors/{comment-poll,reply}.ts` + `lib/auto-reply/*` |
| **Polaris** | Group seeding | (new) — a new connector capability + processor |
| **Rigel** | Reporting / insights | (new) — reads `generated_content`, `post_targets`, engagement metrics |

Vega, Lyra, Atlas, and Sirius are **re-labelings of working code** — adopting them is
mostly organizational. Orion, Polaris, and Rigel are the genuinely new pieces.

## Architecture

### Where the new code lives

A new top-level `lib/agents/` directory sits *beside* (not replacing) the existing
`lib/agent/` content graph. `lib/agent/` becomes Lyra's internal implementation.

```text
lib/
├─ agent/                      # UNCHANGED: Lyra's content StateGraph (graph.ts, nodes/, state.ts …)
├─ agents/                     # NEW: the roster + orchestration layer
│  ├─ types.ts                 # AgentDefinition, AgentContext, AgentResult, AgentName enum
│  ├─ registry.ts              # getAgent(name) — the only lookup; no switch anywhere else
│  ├─ orchestrator.ts          # Orion: routes work agent→agent by enqueuing the next job
│  ├─ vega/      research agent  (wraps lib/agent/research.ts)
│  ├─ lyra/      content agent   (wraps lib/agent/index.ts#runContentAgent)
│  ├─ atlas/     publish agent   (wraps lib/queue/jobs.ts#enqueuePublish)
│  ├─ sirius/    engagement agent(wraps comment-poll/reply)
│  ├─ polaris/   seeding agent   (NEW capability)
│  └─ rigel/     reporting agent (NEW)
└─ queue/                      # UNCHANGED mechanism; gains a few QueueName entries
```

### Core contract

Every agent implements the same small interface, mirroring how `PlatformConnector`
unifies platforms today (one interface, a registry, zero `switch` statements):

```ts
// lib/agents/types.ts  (PROPOSED)
export enum AgentName {
  Orion = "orion",   // orchestrator / strategist
  Vega = "vega",     // research
  Lyra = "lyra",     // content
  Atlas = "atlas",   // autopost
  Sirius = "sirius", // engagement
  Polaris = "polaris", // seeding
  Rigel = "rigel",   // reporting
}

export interface AgentContext {
  clerkUserId: string;
  clerkOrgId?: string;
  /** Correlates every step of one pipeline run across queues + LangSmith. */
  runId: string;
}

export interface AgentResult {
  /** Which agent (if any) the orchestrator should hand off to next. */
  handoff?: { to: AgentName; payload: unknown };
  /** Structured summary for Rigel + LangSmith. */
  summary?: Record<string, unknown>;
}

export interface AgentDefinition<Input = unknown> {
  name: AgentName;
  /** Run one unit of this agent's work. Pure-ish: side effects via injected repos. */
  run(input: Input, ctx: AgentContext): Promise<AgentResult>;
}
```

```ts
// lib/agents/registry.ts  (PROPOSED)
import { AgentName, type AgentDefinition } from "./types";
// import each agent definition…
const REGISTRY: Record<AgentName, AgentDefinition> = { /* … */ };
export function getAgent(name: AgentName): AgentDefinition {
  return REGISTRY[name];
}
```

### Orion, the orchestrator

Orion does **not** do content work. It owns the *plan* and the *handoffs*. A run is a
sequence of agent steps; after each agent returns an `AgentResult`, Orion enqueues the
next agent's job (or stops). This reuses the existing durable-ledger enqueue pattern
(`enqueueWithLedger` + `recordSchedule`) so every handoff is idempotent and survives a
Redis blip — exactly like `enqueuePublish`/`enqueueResearch` do today.

```ts
// lib/agents/orchestrator.ts  (PROPOSED, sketch)
export async function dispatch(step: { agent: AgentName; payload: unknown }, ctx: AgentContext) {
  const result = await getAgent(step.agent).run(step.payload, ctx);
  if (result.handoff) {
    await enqueueAgentStep(result.handoff.to, result.handoff.payload, ctx); // ledger-backed
  }
  await recordAgentRun(ctx.runId, step.agent, result.summary); // feeds Rigel
  return result;
}
```

The canonical loop Orion drives:

```text
Vega → Orion(plan) → Lyra → Atlas → Sirius
  ▲                                     │
  └─────────── Rigel ◄──────────────────┘   (reports feed the next cycle's plan)
```

Polaris runs in parallel off the same live posts as Sirius. This is the same flow as
the diagram in the standalone Lumen plan, now expressed against real modules.

### How agents reuse existing code (no rewrite)

| Agent | Reuses | New work |
|---|---|---|
| **Vega** | `runResearch({ niche })` from `lib/agent/research.ts` | none — wrap + emit `handoff: { to: Lyra }` |
| **Lyra** | `runContentAgent({ topic, platforms, userId })` from `lib/agent/index.ts` | none — wrap + emit `handoff: { to: Atlas }` with the saved `generated_content` ids |
| **Atlas** | `enqueuePublish({ postTargetId, clerkUserId, runAt })` | a thin step that turns accepted drafts → `posts`/`post_targets` then schedules |
| **Sirius** | `registerCommentPoll` / `enqueueCommentReply` + reply processor | none structurally — relabel |
| **Polaris** | the `PlatformConnector` pattern | a `seedGroups()` capability + `worker/processors/seeding.ts` |
| **Rigel** | `generated_content`, `post_targets` (engagement metrics from Goal 10) | a reporting query module + `worker/processors/report.ts` (scheduled) |

Today `worker/processors/research.ts` already chains research → ideas. Under this design
that chaining moves up into Orion (`handoff`), so the processors get thinner and the
*routing* lives in one place instead of being hard-coded inside each processor.

## Queues

Add agent-step queues alongside the existing ones in `lib/queue/queues.ts`. The
mechanism (lazy `getQueue`, ledger, deterministic job ids) is unchanged.

```ts
// lib/queue/queues.ts — PROPOSED additions to the QueueName enum
export enum QueueName {
  Publish = "publish",
  Research = "research",
  Generate = "generate",
  CommentPoll = "comment-poll",
  Reply = "reply",
  TokenRefresh = "token-refresh",
  // NEW:
  AgentStep = "agent-step",   // generic orchestrator handoff queue (one worker, routes by AgentName)
  Seeding = "seeding",        // Polaris
  Report = "report",          // Rigel (scheduled, like token-refresh)
}
```

Two viable shapes for handoffs — **start with the single generic queue** (simplest;
one `agent-step` worker calls `getAgent(job.data.agent).run(...)`), and only split a
hot agent onto its own queue/concurrency later if its throughput or failure profile
demands isolation. (Atlas and Sirius already have dedicated queues — `publish`,
`comment-poll`, `reply` — and keep them.)

A new `worker/processors/agent-step.ts` is the only required processor for the generic
path; `seeding.ts` and `report.ts` are added with Polaris and Rigel. Register them in
`worker/index.ts` exactly like the current `startWorker(QueueName.X, processor, n)`
calls, and (for Rigel) add a scheduled upsert next to `registerTokenRefresh()`.

## Schema additions

Two new tables (Drizzle, following the existing `id uuid pk` + `createdAt/updatedAt`
convention in `db/schema/_helpers.ts`). Nothing existing changes.

| Table | Purpose / key columns |
|---|---|
| **agent_runs** | one row per pipeline run; `runId`, `clerkUserId`, `status`, `plan jsonb`, `currentAgent`, `langsmithRunId`, timing. The spine Orion + Rigel read. |
| **agent_steps** | one row per agent invocation in a run; `runId` (fk), `agent`, `status`, `input jsonb`, `summary jsonb`, `error`, `startedAt/finishedAt`. Feeds Rigel and the UI. |

Provenance already exists for content (`generated_content.researchTopicId`,
`posts.sourceContentId`); `agent_runs.runId` threads through those rows so a published
post can be traced back through Lyra → Vega → the originating niche.

> **Note on naming:** there is already an `AGENTS.md` at the repo root, but it is the
> Next.js coding-rules file, unrelated to this. This document is the agent-*orchestration*
> design; keep them distinct.

## Observability

Reuse the LangSmith wiring that `lib/agent/index.ts` already does (it captures the root
run id via `handleChainStart` and stamps it onto `generated_content`). Extend it so
`AgentContext.runId` ↔ `agent_runs.langsmithRunId`, giving one trace per pipeline run
that spans every agent, not just Lyra's graph.

## Migration path

Strictly additive, each step shippable on its own (mirrors the goal-per-PR rhythm in
ROADMAP.md). No step rewrites working code.

1. **Define the contract.** Add `lib/agents/{types,registry}.ts` and the `agent_runs` /
   `agent_steps` tables (+ migration). Nothing calls them yet. *Ships green, zero behavior change.*
2. **Wrap the working agents.** Implement Vega (over `runResearch`) and Lyra (over
   `runContentAgent`) as `AgentDefinition`s. Add Atlas over `enqueuePublish`. Still no
   orchestrator — agents are individually callable. *Ships green.*
3. **Introduce Orion + the `agent-step` queue.** Add `orchestrator.ts`, the `AgentStep`
   queue, and `worker/processors/agent-step.ts`. Move the research→generate chaining out
   of `worker/processors/research.ts` and into an Orion handoff. *First end-to-end
   autonomous run: niche → research → content → scheduled posts.*
4. **Sirius.** Relabel comment-poll/reply under the Sirius agent; have Atlas's publish
   completion hand off to Sirius to ensure polling is registered for freshly-published targets.
5. **Rigel.** Add the `Report` queue + scheduled processor; write the reporting queries;
   surface a dashboard. Reports feed Orion's next-cycle plan (`agent_runs.plan`).
6. **Polaris.** Add the seeding capability to `PlatformConnector` + `worker/processors/seeding.ts`.

After step 3 the system is genuinely "autonomous agents handing off to each other." Steps
4–6 widen the roster. At every step, the Definition of Done from ROADMAP.md applies:
local gates green → PR → CodeRabbit → merge.

## What this is NOT

- **Not** a rewrite of `lib/agent/`. That graph becomes Lyra's engine, untouched.
- **Not** a new queue technology. Same BullMQ + Upstash + ledger.
- **Not** a change to the publish/OAuth/connector core. Atlas and Polaris use it as-is.
- **Not** merged. This is a proposal to review before any of the phases above are built.
