> Archived 2026-06-24. Superseded by docs/MASTER_PLAN_v2.md.

# Orchestration Build — Goal Prompts

Runnable `/goal` prompts that implement the agent-orchestration layer designed in
[ORCHESTRATION.md](ORCHESTRATION.md). Companion to [PLAN.md](PLAN.md) and
[ROADMAP.md](ROADMAP.md). These goals are **additive** to the merged SocialFlow
codebase (Goals 0–10) — they introduce the named agent roster (Orion, Vega, Lyra,
Atlas, Sirius, Polaris, Rigel) on top of the existing `lib/agent/` graph and BullMQ
queues **without rewriting working code**.

Goals here are prefixed **`A`** (A0–A5) to avoid colliding with the numeric Goals
0–10 in ROADMAP.md. One Goal = one phase from ORCHESTRATION.md's migration path.

## How to run this project

- **1 Goal = 1 Phase = 1 feature branch.** Open a **fresh Claude Code session per
  goal**, paste that goal's `/goal …` block, and let it run to completion (each block
  contains all its tasks).
- Run goals **strictly in order** (each builds on the previous branch).
- Keep **local gates green** at the end of every goal: `npm run lint && npm run
  typecheck && npm run build` (and `npm test`). Never leave a goal red.

## PR / review cadence (IMPORTANT — read before starting)

This differs from ROADMAP.md's "merge every goal." Per the requested workflow:

- **Do NOT open a PR or merge after each individual goal.** Instead, work goals on a
  rolling feature branch and **batch the review every 3 completed goals.**
- **Batch 1 = Goals A0 + A1 + A2.** After A2's local gates are green, **push the branch
  and open ONE non-draft PR** covering A0–A2. This triggers CodeRabbit.
- **Batch 2 = Goals A3 + A4 + A5.** Continue on the branch after the Batch-1 PR; after
  A5's gates are green, **push and open the second non-draft PR** covering A3–A5
  (or push onto the same PR if Batch 1 hasn't merged yet — your call).
- For **every** PR: poll `gh pr checks <#>` until CI is green, then read CodeRabbit's
  actual findings via `gh api repos/<owner>/<repo>/pulls/<#>/comments` (not just the
  green check). **Wait for CodeRabbit, then apply every actionable fix** → re-run local
  gates → push once → comment `@coderabbitai review` exactly once → wait ~2–3 min and
  re-poll. Repeat until **CodeRabbit is clean AND CI is green**.
- **Merge to `main` only at the END**, after both review batches are clean+green
  (squash-merge, then delete the branch).

> Quota tip: CodeRabbit is rate-limited per hour. Verify green locally before pushing so
> the auto-review on open isn't wasted. Check remaining quota with `@coderabbitai rate limit`.

### Branching

```text
main
 └─ orchestration-agents              ← single rolling branch for all 6 goals
      A0 → A1 → A2  ──push──►  PR #N  (Batch 1: CI + CodeRabbit, fix findings)
      A3 → A4 → A5  ──push──►  PR #M  (Batch 2: CI + CodeRabbit, fix findings)
                                 └──► squash-merge to main at the very end
```

Create the branch once at the start of A0: `git checkout -b orchestration-agents`
from an up-to-date `main`. Do **not** branch per goal.

## Run order (canonical — do not reorder)

```text
A0  →  A1  →  A2   ──(Batch-1 PR: review + fix)──►   A3  →  A4  →  A5   ──(Batch-2 PR)──►  MERGE
```

**Why this order (don't break the main logic):**

- **A0 first** — the `AgentDefinition` contract + registry + the `agent_runs` /
  `agent_steps` tables are the spine everything else imports. Nothing references them
  yet, so it ships safely and gives later goals a stable interface.
- **A1 before A2** — A1 wraps the *already-working* agents (Vega over `runResearch`,
  Lyra over `runContentAgent`, Atlas over `enqueuePublish`) as `AgentDefinition`s. They
  must exist and be individually callable before Orion can route between them.
- **A2 is the keystone** — it adds Orion + the `agent-step` queue + processor and
  **moves the research→generate chaining out of `worker/processors/research.ts` into an
  Orion handoff.** This is the first end-to-end autonomous run. Everything before it is
  inert scaffolding; everything after it widens the roster.
- **A3 (Sirius) after A2** — engagement hand-off (publish-complete → ensure comment
  polling) needs Orion's handoff mechanism from A2.
- **A4 (Rigel) after A2/A3** — reporting reads `agent_runs`/`agent_steps` (A0) plus
  engagement results (A3) and feeds Orion's next-cycle plan (A2).
- **A5 (Polaris) last** — it adds a *new* `PlatformConnector` capability + processor;
  it's the most isolated new surface and depends on nothing after it.

**Safe parallelism (optional, advanced):** within A1 the three agent wrappers (Vega,
Lyra, Atlas) are independent and can be built by parallel sub-agents inside that one
goal. The safe default is sequential.

## Prerequisites

- Goals 0–10 from ROADMAP.md merged to `main` (the `lib/agent/` graph, BullMQ queues,
  `enqueuePublish`/`enqueueResearch`, comment-poll/reply, and `generated_content`/
  `post_targets` schema all exist).
- `gh` CLI authenticated (`gh auth status`); CodeRabbit GitHub App installed on the repo.
- `DATABASE_URL` reachable for `npm run db:migrate` (or verified-ready if running
  migrations later).

> **Test-runner note:** the `test` script in `package.json` lists test files
> explicitly (it does not glob). Whenever a goal adds a new `*.test.ts`, also add that
> file to the `test` script's argument list, or it won't run in `npm test` / CI.

---

## The Goal Prompts

Copy one block at a time into a fresh Claude Code session. Each is self-contained.

### Goal A0 — Agent contract, registry & schema spine

```text
/goal Goal A0 — Agent contract, registry & schema spine

Project: AI Social Content Automation SaaS. Design: docs/ORCHESTRATION.md (this implements its migration step 1); architecture: docs/PLAN.md. Implement the agent-orchestration foundation. This goal is purely additive — NOTHING existing changes behavior, and nothing calls the new code yet. Do NOT rewrite lib/agent/.

Branch: from an up-to-date main, create `orchestration-agents` (this single branch is reused for ALL goals A0–A5 — do not branch per goal).

Read first: docs/ORCHESTRATION.md (the "Core contract", "Schema additions", and "Migration path" sections), lib/agent/index.ts and lib/agent/state.ts (to match style), db/schema/_helpers.ts (id/createdAt/updatedAt convention), db/schema/generated-content.ts and db/schema/posts.ts (provenance fields), lib/queue/queues.ts.

Tasks (do all, in order):
A0.1 Contract: create lib/agents/types.ts exactly per ORCHESTRATION.md — AgentName enum (orion, vega, lyra, atlas, sirius, polaris, rigel), AgentContext { clerkUserId, clerkOrgId?, runId }, AgentResult { handoff?, summary? }, AgentDefinition<Input> { name, run(input, ctx) }. Export types only; no runtime deps.
A0.2 Registry: create lib/agents/registry.ts with getAgent(name: AgentName): AgentDefinition backed by a Record<AgentName, AgentDefinition>. Allow partial population for now (registry may throw a clear "agent not registered" error for names without an implementation yet) so this compiles before A1 adds the agents. No switch statements anywhere.
A0.3 Schema: add db/schema/agent-runs.ts (agent_runs) and db/schema/agent-steps.ts (agent_steps) per ORCHESTRATION.md's table spec, following the _helpers.ts convention (uuid pk, createdAt/updatedAt timestamptz). agent_runs: runId (unique), clerkUserId (indexed), status, plan jsonb, currentAgent, langsmithRunId, started/finished timestamps. agent_steps: runId fk → agent_runs, agent, status, input jsonb, summary jsonb, error, startedAt/finishedAt. Wire both into db/schema.ts (or db/schema/index barrel) so Drizzle picks them up.
A0.4 Repos: add lib/repos/agent-runs.ts with typed CRUD — createAgentRun, getAgentRun, updateAgentRun, recordAgentStep, listStepsForRun. Mirror the style of the existing lib/repos/* (e.g. lib/repos/research.ts).
A0.5 Migration: run npm run db:generate to produce the migration in db/migrations/, then npm run db:migrate (or verify-ready if no DATABASE_URL). Commit the generated SQL.

Checkpoint A0: lib/agents/{types,registry}.ts compile; agent_runs/agent_steps migrate cleanly; repos typecheck; nothing else in the app changed behavior. Run `npm run lint && npm run typecheck && npm run build` and `npm test` — ALL GREEN before finishing. If anything is red, fix it within this goal before stopping.

Do NOT open a PR yet — A0 is part of Batch 1 (A0–A2), reviewed together after A2. Just leave the branch green and committed.
```

### Goal A1 — Wrap the working agents (Vega, Lyra, Atlas)

```text
/goal Goal A1 — Wrap the working agents: Vega, Lyra, Atlas

Project: AI Social Content Automation SaaS. Design: docs/ORCHESTRATION.md (migration step 2). Prerequisite: Goal A0 complete on the `orchestration-agents` branch. Stay on that same branch — do NOT create a new branch and do NOT merge.

Goal: expose the agents that already exist as code as AgentDefinition implementations. These are THIN WRAPPERS over working functions — do not reimplement research, content generation, or publishing. No orchestrator yet; each agent must be individually callable.

Read first: lib/agent/research.ts (runResearch), lib/agent/index.ts (runContentAgent), lib/queue/jobs.ts (enqueuePublish signature), lib/repos/generated-content.ts, lib/repos/posts.ts, db/schema/post-targets.ts, docs/ORCHESTRATION.md ("How agents reuse existing code").

Tasks (in order; the three agents are independent and may be built as parallel sub-tasks):
A1.1 Vega (research agent): lib/agents/vega/index.ts implementing AgentDefinition. run({ niche }, ctx) calls runResearch({ niche }) from lib/agent/research.ts, persists ideas/findings exactly as worker/processors/research.ts does today (reuse replaceIdeasForTopic etc.), and returns AgentResult with summary { ideas, findings } and handoff { to: AgentName.Lyra, payload: { topic: niche, generatedContentIds } }. Do not duplicate research logic — call the existing function.
A1.2 Lyra (content agent): lib/agents/lyra/index.ts. run({ topic, platforms }, ctx) calls runContentAgent({ topic, platforms, userId: ctx.clerkUserId }) from lib/agent/index.ts, and returns summary { drafts: <count> } plus handoff { to: AgentName.Atlas, payload: { acceptedContentIds } }. lib/agent/ (the StateGraph) is Lyra's engine and stays UNTOUCHED.
A1.3 Atlas (autopost agent): lib/agents/atlas/index.ts. run({ acceptedContentIds | postTargetIds, runAt }, ctx) turns accepted drafts into posts + post_targets via the existing repos, then schedules each target with enqueuePublish({ postTargetId, clerkUserId: ctx.clerkUserId, runAt }). Return summary { scheduled: <count> }. No handoff (publishing is terminal for the forward path until A3 adds Sirius).
A1.4 Register all three in lib/agents/registry.ts (replace the A0 placeholders). Add focused unit tests (node:test via tsx) for each wrapper's input→handoff mapping, mocking the underlying functions/repos.

Checkpoint A1: getAgent(AgentName.Vega|Lyra|Atlas) returns working definitions; a unit test can invoke each in isolation and assert the handoff payload; existing research/publish behavior is unchanged. `npm run lint && npm run typecheck && npm run build && npm test` ALL GREEN. Fix any red within this goal.

Do NOT open a PR yet — A1 is part of Batch 1 (A0–A2). Leave the branch green and committed.
```

### Goal A2 — Orion orchestrator + agent-step queue (first autonomous run)

```text
/goal Goal A2 — Orion orchestrator + agent-step queue

Project: AI Social Content Automation SaaS. Design: docs/ORCHESTRATION.md (migration step 3 — the keystone). Prerequisite: Goals A0+A1 complete on `orchestration-agents`. Stay on that branch.

Goal: introduce Orion (the orchestrator) and a generic agent-step queue so agents hand off to one another as durable, idempotent jobs. Move the research→generate chaining OUT of worker/processors/research.ts and INTO an Orion handoff. After this goal the system performs a full autonomous run: niche → research (Vega) → content (Lyra) → scheduled posts (Atlas).

Read first: lib/queue/queues.ts (QueueName enum), lib/queue/jobs.ts (enqueueWithLedger + recordSchedule pattern, deterministic jobIds), lib/queue/with-ledger.ts, lib/queue/job-ids.ts, worker/index.ts (startWorker registration), worker/processors/research.ts (the chaining to relocate), docs/ORCHESTRATION.md ("Orion, the orchestrator" + "Queues").

Tasks (in order):
A2.1 Queue: add QueueName.AgentStep = "agent-step" to lib/queue/queues.ts. Add an agentStepJobId(runId, agent) helper to lib/queue/job-ids.ts (deterministic → idempotent + cancellable).
A2.2 Enqueue helper: add enqueueAgentStep({ runId, agent, payload, clerkUserId }) to lib/queue/jobs.ts using the SAME enqueueWithLedger + recordSchedule(refType:"agent_step") pattern as enqueuePublish/enqueueResearch — record ledger first, roll back on enqueue failure.
A2.3 Orchestrator: lib/agents/orchestrator.ts with dispatch(step, ctx): calls getAgent(step.agent).run(step.payload, ctx), persists the step via recordAgentStep (A0 repo), and if result.handoff enqueues the next agent via enqueueAgentStep. Add startRun({ clerkUserId, plan }) that creates an agent_runs row and enqueues the first step.
A2.4 Processor: worker/processors/agent-step.ts reads { runId, agent, payload } and calls dispatch(...); register it in worker/index.ts via startWorker(QueueName.AgentStep, agentStepProcessor, 3) following the existing pattern (ready/completed/failed/error listeners are handled by startWorker).
A2.5 Relocate chaining: change the research flow so completing research hands off to Lyra through Orion (an enqueueAgentStep to AgentName.Lyra) instead of worker/processors/research.ts directly chaining a generate job. Keep research idempotent. Update/extend the existing research processor tests accordingly.
A2.6 Entry point: add a server action or app/api/agents/run/route.ts (Node runtime) that calls orchestrator.startRun(...) for a given niche+platforms, so a run can be kicked off from the app. Gate it behind the existing auth (requireUserId).

Checkpoint A2 (first autonomous loop): kicking off a run for a niche produces, with no manual steps, research findings → ideas → tailored drafts in generated_content → scheduled post_targets; agent_runs/agent_steps rows record each hop; handoffs are idempotent on retry (deterministic jobIds); the schedules ledger stays consistent. `npm run lint && npm run typecheck && npm run build && npm test` ALL GREEN.

NOW open Batch-1 review (covers A0+A1+A2):
1. Self-review the full diff: `git diff main...HEAD`.
2. Confirm local gates GREEN.
3. Push `orchestration-agents` and open ONE NON-DRAFT PR to main titled "Orchestration agents — Batch 1 (A0–A2)". This triggers CodeRabbit.
4. Drive it: poll `gh pr checks <#>` until CI green; read findings via `gh api repos/<owner>/<repo>/pulls/<#>/comments`; fix every actionable finding → re-run local gates → push once → comment "@coderabbitai review" exactly once → wait ~2–3 min → re-poll. Repeat until CodeRabbit clean AND CI green.
5. Do NOT merge yet — A3–A5 (Batch 2) continue on the same branch. Leave the PR open and green.
```

### Goal A3 — Sirius (engagement / auto-reply agent)

```text
/goal Goal A3 — Sirius engagement agent

Project: AI Social Content Automation SaaS. Design: docs/ORCHESTRATION.md (migration step 4). Prerequisite: Goal A2 complete + Batch-1 PR open/green on `orchestration-agents`. Stay on that branch (this begins Batch 2).

Goal: bring comment-polling + auto-reply under the Sirius agent, and have Atlas's publish completion hand off to Sirius so freshly-published targets are guaranteed to have comment polling registered. Reuse the existing auto-reply machinery — do not reimplement it.

Read first: worker/processors/comment-poll.ts, worker/processors/reply.ts, lib/queue/jobs.ts (registerCommentPoll, enqueueCommentReply), lib/auto-reply/* (match/template/slot), worker/processors/publish.ts (where publish completes), docs/ORCHESTRATION.md ("How agents reuse existing code" — Sirius row).

Tasks (in order):
A3.1 Sirius agent: lib/agents/sirius/index.ts implementing AgentDefinition. run({ socialAccountId | publishedTargetIds }, ctx) ensures comment polling is active for the relevant account(s) via registerCommentPoll(...) and records a summary. Register it in lib/agents/registry.ts.
A3.2 Publish → Sirius handoff: after a target publishes successfully (worker/processors/publish.ts), enqueue an agent-step to AgentName.Sirius for that target's account (via enqueueAgentStep, idempotent). Do not block or fail publishing if the Sirius hop fails — log and continue (publishing remains the source of truth).
A3.3 Keep reply dispatch as-is functionally, but record reply outcomes into the agent_steps trail for the run when a runId is available (best-effort; comment events without a run still work).
A3.4 Tests: unit-test the Sirius wrapper (account → registerCommentPoll called) and the publish→Sirius handoff enqueue (idempotent, non-blocking on failure).

Checkpoint A3: publishing a post automatically ensures its account is being polled; a comment containing a rule keyword still gets exactly one auto-reply (dedupe + cooldown + daily cap respected, unchanged); Sirius activity appears in agent_steps. `npm run lint && npm run typecheck && npm run build && npm test` ALL GREEN.

Do NOT open a new PR yet — A3 is part of Batch 2 (A3–A5). Leave the branch green and committed.
```

### Goal A4 — Rigel (reporting / insights agent)

```text
/goal Goal A4 — Rigel reporting agent

Project: AI Social Content Automation SaaS. Design: docs/ORCHESTRATION.md (migration step 5). Prerequisite: Goal A3 complete on `orchestration-agents`. Stay on that branch.

Goal: add Rigel — a scheduled agent that compiles project events (top content/posts by performance, rising topics, engagement + run-success signals) from existing tables, and feeds a structured report back into Orion's next-cycle plan.

Read first: db/schema/generated-content.ts, db/schema/post-targets.ts (+ any engagement metrics added by ROADMAP Goal 10), db/schema/agent-runs.ts + agent-steps.ts (A0), lib/queue/jobs.ts (registerTokenRefresh as the scheduled-job template), worker/index.ts (scheduler registration next to ensureTokenRefreshScheduler), docs/ORCHESTRATION.md ("Rigel" row + "Queues").

Tasks (in order):
A4.1 Queue + schedule: add QueueName.Report = "report" to lib/queue/queues.ts; add registerReportSchedule() to lib/queue/jobs.ts using upsertJobScheduler (mirror registerTokenRefresh, e.g. daily); register it in worker/index.ts beside the token-refresh scheduler bootstrap (with the same retry-on-Redis-blip guard).
A4.2 Reporting queries: lib/agents/rigel/queries.ts — read-only aggregations over generated_content / post_targets / agent_runs (e.g. top topics by published count + engagement, run success rate, failed-publish counts). Keep them parameterized by clerkUserId/period.
A4.3 Rigel agent + processor: lib/agents/rigel/index.ts (AgentDefinition: run({ period }, ctx) → builds the report, returns summary) and worker/processors/report.ts that invokes it on the schedule; register Rigel in the registry. Persist the report (a new db/schema/reports.ts table OR onto agent_runs.plan — choose per ORCHESTRATION.md and note the choice in the PR).
A4.4 Feed-forward: expose the latest report to Orion.startRun so the next cycle's plan can prioritize what performed (e.g. orchestrator reads the most recent report to seed niche/platform priorities). Keep it optional — a run with no prior report still works.
A4.5 Tests: unit-test the aggregation queries against seeded fixtures and the Rigel wrapper's summary shape.

Checkpoint A4: the scheduled report runs and produces a structured summary from real tables; Orion can consume the latest report to bias the next run; no existing behavior regressed. `npm run lint && npm run typecheck && npm run build && npm test` ALL GREEN.

Do NOT open a new PR yet — A4 is part of Batch 2 (A3–A5). Leave the branch green and committed.
```

### Goal A5 — Polaris (group-seeding agent)

```text
/goal Goal A5 — Polaris group-seeding agent

Project: AI Social Content Automation SaaS. Design: docs/ORCHESTRATION.md (migration step 6). Prerequisite: Goal A4 complete on `orchestration-agents`. Stay on that branch (this finishes Batch 2).

Goal: add Polaris — a seeding agent that enters relevant groups/communities, checks for new posts, and interacts. This is the most isolated NEW surface: it adds a capability to the PlatformConnector pattern and its own processor. Build it behind capabilities so platforms that can't seed degrade gracefully (mirrors how supportsComments works today).

Read first: lib/platforms/types.ts (PlatformConnector + capabilities descriptor), lib/platforms/registry.ts, lib/platforms/base.ts (refresh-on-expiry pattern), an existing adapter (e.g. lib/platforms/facebook.ts), worker/processors/comment-poll.ts (repeatable-job pattern), docs/ORCHESTRATION.md ("Polaris" row).

Tasks (in order):
A5.1 Capability: extend the PlatformConnector capabilities descriptor in lib/platforms/types.ts with supportsSeeding (default false). Add optional methods listGroupPosts()/interactWithPost() to the interface; provide safe no-op/unsupported defaults in base.ts so existing adapters need no changes.
A5.2 One real adapter capability: implement seeding on ONE platform where it's feasible (note which in the PR), guarded by supportsSeeding:true. Leave the rest at the default (unsupported).
A5.3 Queue + processor: add QueueName.Seeding = "seeding"; a repeatable per-target seeding job (registerSeeding(...) mirroring registerCommentPoll's upsertJobScheduler) and worker/processors/seeding.ts that, for seeding-capable accounts, fetches new group posts and interacts within safe rate limits. Register in worker/index.ts.
A5.4 Polaris agent: lib/agents/polaris/index.ts (AgentDefinition) that activates/deactivates seeding for an account and records summary into agent_steps; register in the registry. Optionally let Orion include Polaris as a parallel branch off live posts (same posts Sirius watches).
A5.5 Tests: unit-test the capability gating (non-seeding platform → no-op), the Polaris wrapper, and the seeding registration idempotency.

Checkpoint A5: a seeding-capable account enters its configured groups and interacts within rate limits; non-capable platforms are cleanly skipped (no errors); Polaris activity appears in agent_steps. `npm run lint && npm run typecheck && npm run build && npm test` ALL GREEN.

NOW finish Batch-2 review AND the final merge:
1. Self-review `git diff main...HEAD` for the A3–A5 work.
2. Confirm local gates GREEN.
3. Push and open the SECOND NON-DRAFT PR to main titled "Orchestration agents — Batch 2 (A3–A5)" (or push onto the existing PR if Batch 1 has not merged — keep one reviewable history). Triggers CodeRabbit.
4. Drive BOTH open PRs to clean+green: poll `gh pr checks`, read findings via `gh api repos/<owner>/<repo>/pulls/<#>/comments`, fix every actionable finding → re-run local gates → push once → "@coderabbitai review" once → wait ~2–3 min → re-poll. Repeat until CodeRabbit clean AND CI green on everything.
5. ONLY THEN squash-merge to main (Batch 1 first if separate, then Batch 2), and delete the `orchestration-agents` branch. This is the final orchestration-readiness merge.
```

---

## Definition of Done — applies to EVERY goal

1. **Implement every task** in the goal, in order; each meets its checkpoint criteria.
2. **Local gates GREEN before finishing a goal**: `npm run lint && npm run typecheck &&
   npm run build && npm test`. Fix locally — never leave a goal red.
3. **Self-review** the diff before any push.
4. **Review happens per batch, not per goal** (A0–A2, then A3–A5). On each PR: drive CI
   green, wait for CodeRabbit, apply every actionable finding, re-verify gates, push
   once, `@coderabbitai review` once, repeat until clean+green.
5. **Merge to `main` only at the very end**, after both batches are clean+green; squash,
   then delete the branch.
6. Do **not** rewrite `lib/agent/` or the publish/connector core — these goals are
   additive (see ORCHESTRATION.md "What this is NOT").

## Goal → migration-step → roster map

| Goal | ORCHESTRATION.md step | Introduces | New queues |
|---|---|---|---|
| **A0** | 1 — contract + schema | `lib/agents/{types,registry}`, `agent_runs`, `agent_steps`, repos | — |
| **A1** | 2 — wrap working agents | Vega, Lyra, Atlas (thin wrappers) | — |
| **A2** | 3 — orchestrator | **Orion** + first autonomous run | `agent-step` |
| **A3** | 4 — engagement | **Sirius** (+ publish→Sirius handoff) | — |
| **A4** | 5 — reporting | **Rigel** (scheduled) + feed-forward to Orion | `report` |
| **A5** | 6 — seeding | **Polaris** (new connector capability) | `seeding` |

**Batch 1 PR:** A0 + A1 + A2 ·  **Batch 2 PR:** A3 + A4 + A5 ·  **Merge:** at the end.
