# Master Implementation Plan — Agent-Layer Upgrade (P0–P2)

**Source:** [docs/research/ai-agent-trends-2026-06-22.md](research/ai-agent-trends-2026-06-22.md) (gap matrix). **Created:** 2026-06-22.
**Goal:** bring SocialFlow's `Orion`/`Lyra` agent layer up to the June-2026 production-agent baseline — a brand-safety **approval gate**, **evals**, **per-brand memory**, **least-privilege/identity/audit**, then **supervisor orchestration**, **parallel drafting**, and **MCP/A2A** interop.

## Confirmed decisions (from planning Q&A)
1. **Approval model = threshold auto-publish.** A post auto-publishes when its brand-safety score ≥ a **per-tenant threshold** *and* the tenant has auto-publish enabled; otherwise it is held in a **review queue** for human approval.
2. **Reviewer placement = new roster agent `Castor`** between `Lyra → Atlas`, registered in Orion's registry like the others. Adds an `agent_name` enum value + an `awaiting_approval` run state (migration).
3. **Plan depth = equal depth, all tiers.** Full implement-ready tasks for every item P0–P2.

## Architecture decisions (with rationale)
- **AD-1 — Pause/resume lives in Orion, not in LangGraph.** `@langchain/langgraph@1.4.4` supports `interrupt()`, but the content graph (`lib/agent/graph.ts`) is `.compile()`d with **no checkpointer** and runs **synchronously inside `Lyra`**; there is no durable LangGraph server to resume against. SocialFlow's durability already lives in **BullMQ + `agent_steps`** (`lib/agents/orchestrator.ts`). So the gate is modeled as: `Castor` returns a **pause control signal**, Orion sets the run to `awaiting_approval` (instead of `completed`), and a human approval **enqueues the next step** (`Atlas`) via the existing durable enqueue. This reuses the idempotent ledger and adds no new runtime.
- **AD-2 — One brand-safety "judge", two call sites.** A single module (`lib/agent/guardrails/brand-safety.ts`) is used **online** by `Castor` (gate) and **offline** by the LangSmith eval harness (regression + Align calibration). Deterministic checks (banned terms) reuse the ReDoS-guarded matching already proven in auto-reply; subjective checks (brand voice, policy) use the **provider-agnostic LLM factory** (`lib/llm/factory.ts`).
- **AD-3 — `Lyra` stops auto-accepting.** Today `lib/agents/lyra/index.ts:41` calls `markGeneratedContentAccepted(...)` and hands off to `Atlas`. After this work, `Lyra` hands off to `Castor` and **acceptance happens only after the gate** (auto or human). This is the single most important behavior change.
- **AD-4 — Brand profile is the home for both settings and learned memory.** One `brand_profiles` table carries typed **settings** (voice, banned terms, `autoPublishEnabled`, `autoPublishThreshold`) and a jsonb **learned-memory** blob (winning formats/themes/times) that `Rigel` writes and `Lyra` reads — closing the analytics→drafting loop.
- **AD-5 — Backward-compatible everywhere.** New enum values, nullable columns, opt-in flags. Linear handoffs still work; supervisor/parallel/MCP/A2A are additive and feature-gated. Each task leaves `main` shippable.

## Dependency graph
```
T1 enums/migration ─┬─ T2 Orion pause/resume ─┬─ T6 Castor+Lyra ─┬─ T7 approve/resume API ── T8 review UI
                    │                          │                  └─ T12 capabilities
                    ├─ T5 review persistence ──┘                  └─ T14 supervisor
                    └─ T13 audit hash-chain
T3 guardrail ───────┬─ T6 Castor
                    └─ T9 evals/Align
T4 brand profile ───┬─ T6 Castor (threshold)
                    ├─ T10 brand voice in graph ── T11 learned memory + Rigel feedback
                    └─ (T15 parallel drafting uses T10)
T16 MCP inward (independent) · T17 A2A outward (needs T2; better after T14)
```
Build order follows the graph bottom-up; P0 is the first complete vertical slice (generate → gate → hold → approve → schedule).

---

# Phase 0 — Foundations

## Task 1: Add `Castor` agent + `awaiting_approval` run state (enums & migration)
**Description.** Introduce the new roster identifier and run lifecycle state the gate needs, keeping the DB enum and the TS enum in lockstep (the enum comment in `db/schema/enums.ts:79` mandates this).
**Acceptance criteria:**
- [ ] `AgentName.Castor = "castor"` added to `lib/agents/types.ts`; `"castor"` appended to `agentNameEnum` (`db/schema/enums.ts`).
- [ ] `"awaiting_approval"` (and `"rejected"`) appended to `agentRunStatusEnum`.
- [ ] Drizzle migration generated (drizzle-kit assigns next number, 0009+).
**Verification:**
- [ ] `npm run typecheck` clean; `npm run db:generate` produces a reviewed SQL migration; `npm run lint`.
**Dependencies:** None.
**Files:** `lib/agents/types.ts`, `db/schema/enums.ts`, `db/migrations/00NN_*.sql`.
**Scope:** S.

## Task 2: Orion pause/resume + `AgentResult` control signal
**Description.** Teach the orchestrator that an agent can **pause a run for approval** rather than complete or hand off, and add a durable **resume** that enqueues the next step. Pure-deps design preserved (unit-testable without db/queue).
**Acceptance criteria:**
- [ ] `AgentResult` gains optional `control?: { pause: "awaiting_approval"; reason?: string }` (`lib/agents/types.ts`).
- [ ] In `dispatch`/`deliverHandoff` (`lib/agents/orchestrator.ts`): when `result.control?.pause`, `updateAgentRun(status:"awaiting_approval")` and **do not** enqueue or mark completed; idempotency guard still re-delivers a prior step without re-running.
- [ ] New `resumeRun({ runId, step })` on the orchestrator + runtime (`lib/agents/orchestrator.runtime.ts`) that enqueues a step for an existing run and sets it back to `running`.
**Verification:**
- [ ] Extend `lib/agents/orchestrator.test.ts`: pause path leaves `awaiting_approval` + no enqueue; resume path enqueues exactly one step; existing tests still green. `npm test`.
**Dependencies:** T1.
**Files:** `lib/agents/types.ts`, `lib/agents/orchestrator.ts`, `lib/agents/orchestrator.runtime.ts`, `lib/agents/orchestrator.test.ts`.
**Scope:** M.

### Checkpoint: Foundations
- [ ] `npm run lint && npm run typecheck && npm run build` green; `npm test` green; migration reviewed (not yet required to be applied to a live DB).

---

# Phase 1 — P0: Brand-safety guardrail + approval gate + evals

## Task 3: Brand-safety guardrail engine (the shared judge)
**Description.** A pure, injectable module that scores a draft against a brand profile and returns a verdict. Deterministic banned-term/PII checks + an LLM-as-judge for voice/policy. No db/env imports (mirrors the agent factories) so it unit-tests with a stub model.
**Acceptance criteria:**
- [ ] `runBrandSafety(input, deps)` returns, per draft, `{ score: 0..1, verdict: "pass"|"review"|"block", violations: Array<{rule, detail}> }`.
- [ ] Deterministic layer: banned-term + basic PII/secret match using the **ReDoS-guarded** matcher pattern already used in auto-reply (bounded input, caps); a `block` verdict on any banned term regardless of score.
- [ ] Subjective layer: LLM judge via `getChatModel({ temperature: 0 })` (`lib/llm/factory.ts`) with a versioned prompt; resilient to model errors (fail-closed to `review`, never silently `pass`).
**Verification:**
- [ ] `lib/agent/guardrails/brand-safety.test.ts`: banned term → `block`; clean on-brand draft (stub judge high) → `pass`; borderline → `review`; judge throw → `review`. `npm test`.
**Dependencies:** None (uses a stub brand profile until T4).
**Files:** `lib/agent/guardrails/brand-safety.ts`, `lib/agent/guardrails/brand-safety.test.ts`, `lib/agent/prompts.ts` (judge prompt).
**Scope:** M.

## Task 4: Per-tenant brand profile + thresholds (settings)
**Description.** The `brand_profiles` table + repo + a settings page so each tenant configures voice, banned terms, auto-publish toggle, and threshold. (Learned-memory columns are added here but populated in T11.)
**Acceptance criteria:**
- [ ] `brand_profiles` table: `clerkUserId`/`clerkOrgId`, `voice` text, `bannedTerms` jsonb `string[]`, `autoPublishEnabled` boolean (default **false** — safe default), `autoPublishThreshold` numeric (default e.g. 0.8), `learnedMemory` jsonb (nullable), timestamps; unique per tenant. Migration generated.
- [ ] Repo `lib/repos/brand-profiles.ts`: `getBrandProfile(tenant)` (returns sane defaults when unset), `upsertBrandProfile`.
- [ ] Settings UI to edit the profile (Next 16 App Router, Clerk `useAuth`/`Show`, a11y: labelled fields/fieldset, real `<form onSubmit>`).
**Verification:**
- [ ] `lib/repos/brand-profiles.test.ts` (defaults + upsert). Manual: save profile → values persist. `npm test`, `npm run build`.
**Dependencies:** T1 (migration chain).
**Files:** `db/schema/brand-profiles.ts`, `db/schema/enums.ts` (if a `review_status` enum is added here), `lib/repos/brand-profiles.ts`, `app/(dashboard)/settings/brand/page.tsx` (+ form component), migration.
**Scope:** M.

## Task 5: Review persistence (content reviews + generated_content state)
**Description.** Persist each gate decision for auditing and for the review queue. Add review state to `generated_content` and a `content_reviews` ledger row per (run, content).
**Acceptance criteria:**
- [ ] `generated_content` gains `reviewStatus` (`pending|approved|rejected`, default `pending`), `brandSafetyScore` numeric (nullable), `reviewedAt` (nullable) — extends the existing `accepted` boolean (`db/schema/generated-content.ts:33`).
- [ ] `content_reviews` table: `runId`, `generatedContentId`, `score`, `verdict`, `violations` jsonb, `decidedBy` (`auto|<userId>`), `decision`, timestamps. Migration.
- [ ] Repo `lib/repos/content-reviews.ts`: `recordReview`, `listPendingReviews(tenant)`, `setDecision`.
**Verification:**
- [ ] `lib/repos/content-reviews.test.ts` (record, list pending, decide). `npm test`.
**Dependencies:** T1.
**Files:** `db/schema/content-reviews.ts`, `db/schema/generated-content.ts`, `db/schema/enums.ts`, `lib/repos/content-reviews.ts`, migration.
**Scope:** M.

## Task 6: `Castor` reviewer agent + `Lyra` stops auto-accepting
**Description.** The new roster agent that runs the gate. `Lyra` hands off to `Castor` (not `Atlas`); `Castor` scores drafts, and either **auto-accepts + hands off to `Atlas`** (all pass ≥ threshold and auto-publish enabled) or **records pending reviews + pauses** the run.
**Acceptance criteria:**
- [ ] `lib/agents/castor/index.ts` implements `AgentDefinition<CastorInput>` with injected deps (`getGeneratedContentByIds`, `runBrandSafety`, `getBrandProfile`, `recordReview`, `markGeneratedContentAccepted`); registered in `lib/agents/registry.ts`.
- [ ] `Lyra` (`lib/agents/lyra/index.ts`) no longer calls `markGeneratedContentAccepted`; hands off `{ to: Castor, payload: { generatedContentIds } }`.
- [ ] Pass path → accept + `handoff: { to: Atlas, payload: { acceptedContentIds } }`. Hold path → `recordReview(...)` for each + `control: { pause: "awaiting_approval" }`, **no** acceptance.
**Verification:**
- [ ] `lib/agents/castor/index.test.ts` (pass→Atlas; hold→pause, nothing accepted) and updated `lib/agents/lyra/index.test.ts` (hands off to Castor, no auto-accept). `npm test`.
**Dependencies:** T2, T3, T4, T5.
**Files:** `lib/agents/castor/index.ts`, `lib/agents/castor/index.test.ts`, `lib/agents/registry.ts`, `lib/agents/lyra/index.ts`, `lib/agents/lyra/index.test.ts`.
**Scope:** M.

## Task 7: Approve / reject / resume API
**Description.** The server endpoint the dashboard calls. Approve → mark reviews approved, accept those drafts, **resume** the run (enqueue `Atlas`). Reject → mark rejected, set run `rejected` (optionally re-loop `Lyra`). Tenant-scoped authz.
**Acceptance criteria:**
- [ ] Route/handler (App Router) `approveRun`/`rejectRun` operating on `runId` (+ optional per-content selection), guarded by Clerk auth and tenant ownership.
- [ ] Approve: `setDecision(approved)` + `markGeneratedContentAccepted(selected)` + `orchestrator.resumeRun({ runId, step: { agent: Atlas, payload: { acceptedContentIds } } })`.
- [ ] Reject: `setDecision(rejected)` + `updateAgentRun(status:"rejected")`.
**Verification:**
- [ ] Unit tests for the repo/service seam (approve resumes once; reject finalizes; cross-tenant denied). Manual: approve a held run → `Atlas` schedules. `npm test`.
**Dependencies:** T2, T5, T6.
**Files:** `app/api/agents/runs/[runId]/route.ts` (or server actions), `lib/repos/agent-runs.ts` (resume helper), `lib/agents/orchestrator.runtime.ts`.
**Scope:** M.

## Task 8: Dashboard review queue UI
**Description.** Where humans clear held posts. Lists pending reviews with draft text, per-platform variant, brand-safety score, and violations; approve/reject (single + bulk); integrates with the existing dashboard "Needs attention".
**Acceptance criteria:**
- [ ] `/review` page lists `listPendingReviews(tenant)` with score + violations; approve/reject call T7; optimistic update + toast (`sonner`).
- [ ] Empty/loading/error states; a11y (focusable controls, labelled actions, skip-link parity with the rest of the app).
- [ ] Dashboard surfaces a pending-review count.
**Verification:**
- [ ] `npm run build`; manual end-to-end: held post appears → approve → disappears + schedules. (UI tests optional — note `npm test` only globs `lib/**`.)
**Dependencies:** T7.
**Files:** `app/(dashboard)/review/page.tsx` (+ components), dashboard widget, nav entry.
**Scope:** M–L.

### Checkpoint A — P0 gate works end-to-end
- [ ] Generate → low-score draft held (`awaiting_approval`) → shows in `/review` → approve → `Atlas` schedules → appears on calendar. Auto-publish path: high-score + toggle on → schedules with no human step.
- [ ] All four gates green; `npm test` green.

## Task 9: LangSmith offline evals + Align calibration
**Description.** A regression dataset + evaluator that runs the **same judge** over labeled examples, plus a calibration pass to pick the threshold from data (Align-Evals style: maximize agreement with human labels).
**Acceptance criteria:**
- [ ] Labeled dataset (on-brand / off-brand / banned / borderline) under `evals/brand-safety/`.
- [ ] Runner script (`npm run eval:brand-safety`) scores the dataset, reports precision/recall + judge–human agreement, and **prints a recommended `autoPublishThreshold`**; runs fully offline (no publish, no scheduling).
- [ ] Findings + chosen default threshold documented in `docs/IMPLEMENTATION_NOTES.md`; LangSmith dataset upload gated on `isLangSmithEnabled()`.
**Verification:**
- [ ] `npm run eval:brand-safety` produces a report; a deliberately off-brand example is caught. (Place any unit test under `lib/` to be picked up by `npm test`, or run the eval script directly via `tsx`.)
**Dependencies:** T3.
**Files:** `evals/brand-safety/*`, `package.json` (script), `docs/IMPLEMENTATION_NOTES.md`.
**Scope:** M.

### Checkpoint B — P0 complete
- [ ] Threshold is calibrated from data (not guessed); gate + evals share one judge; brand-safety is provable from traces + the `content_reviews` ledger.

---

# Phase 2 — P1: Memory, identity, audit

## Task 10: Wire brand voice into generation
**Description.** Feed the brand profile into the content graph so drafts are on-brand **before** the gate (fewer rejections). Add a `brandProfile` channel to `ContentState` and thread it into digest/draft/critique prompts.
**Acceptance criteria:**
- [ ] `ContentState` (`lib/agent/state.ts`) gains a `brandProfile` input channel; `runContentAgent` accepts it; `Lyra` loads + passes it.
- [ ] `digest`/`draft-per-platform`/`critique` prompts (`lib/agent/prompts.ts`, `lib/agent/nodes/*`) include voice + banned terms.
**Verification:**
- [ ] Node tests assert the rendered prompt contains the brand voice + banned terms (stub model). `npm test`.
**Dependencies:** T4.
**Files:** `lib/agent/state.ts`, `lib/agent/index.ts`, `lib/agent/nodes/digest.ts`, `lib/agent/nodes/draft-per-platform.ts`, `lib/agent/nodes/critique.ts`, `lib/agent/prompts.ts`, `lib/agents/lyra/index.ts`.
**Scope:** M.

## Task 11: Long-term learned memory + `Rigel` feedback loop
**Description.** Close the analytics→drafting loop. `Rigel` distills run outcomes (top-performing themes/formats/times) into `brand_profiles.learnedMemory`; `Lyra`'s digest reads it.
**Acceptance criteria:**
- [ ] `Rigel` (`lib/agents/rigel/index.ts`) writes a bounded `learnedMemory` summary after aggregating outcomes (reuses `rigel/aggregate.ts`).
- [ ] `digest` node incorporates `learnedMemory` when present; absent → unchanged behavior.
- [ ] Memory is size-capped + timestamped (avoid unbounded growth / context rot).
**Verification:**
- [ ] Tests: Rigel persists insights from sample outcomes; digest includes them next run. `npm test`.
**Dependencies:** T4, T10.
**Files:** `lib/agents/rigel/index.ts`, `lib/agents/rigel/aggregate.ts`, `lib/repos/brand-profiles.ts`, `lib/agent/nodes/digest.ts`.
**Scope:** M.

## Task 12: Per-agent least-privilege capabilities + identity
**Description.** Declare and enforce what each roster agent may do, so e.g. `Castor` can never publish and only `Atlas` holds `enqueuePublish`. Bind each step to an explicit agent principal.
**Acceptance criteria:**
- [ ] `AgentDefinition` gains a `capabilities` descriptor (allowed tool/repo names); the registry wraps each agent so a capability outside its set throws (least-privilege).
- [ ] Documented capability matrix (`docs/ORCHESTRATION.md`): `Castor` = read content + judge (no publish); `Atlas` = publish; etc.
- [ ] Step records carry the agent principal + tenant (already have `clerkUserId`/`runId`; make the agent identity explicit).
**Verification:**
- [ ] Test: a deliberately mis-wired agent calling a forbidden dep is blocked; `Castor` cannot reach `enqueuePublish`. `npm test`.
**Dependencies:** T6.
**Files:** `lib/agents/types.ts`, `lib/agents/registry.ts`, per-agent index files, `docs/ORCHESTRATION.md`.
**Scope:** M.

## Task 13: Tamper-evident `agent_steps` audit chain
**Description.** Make the audit trail verifiable for enterprise governance: each step row links to the prior via a hash chain so silent edits are detectable.
**Acceptance criteria:**
- [ ] `agent_steps` gains `prevHash` + `hash` (nullable) columns (migration); `recordAgentStep` (runtime) computes `hash = H(canonical(step) + prevHash)` per run, append-only (steps are already insert-only).
- [ ] `verifyRunAudit(runId)` recomputes the chain and reports the first broken link.
**Verification:**
- [ ] Test: intact run verifies; a mutated row fails verification at the right index. `npm test`.
**Dependencies:** T1.
**Files:** `db/schema/agent-steps.ts`, `lib/agents/orchestrator.runtime.ts`, `lib/audit/run-audit.ts` (+ test), migration.
**Scope:** M.

### Checkpoint C — P1 complete
- [ ] Drafts honor brand voice; `Rigel` feeds insights forward; capabilities enforced (`Castor` can't publish); audit chain verifiable. All gates green.

---

# Phase 3 — P2: Supervisor, parallelism, interop

## Task 14: Supervisor routing in Orion
**Description.** Add dynamic next-step selection so Orion can react to results (e.g., a `Castor` rejection auto-routes back to `Lyra` to regenerate, up to N attempts) instead of only following static handoffs. Linear handoff stays the default.
**Acceptance criteria:**
- [ ] A `supervisor`/`decideNext(runState)` policy chooses the next agent from the run's history; opt-in via the run plan; static handoffs unchanged when not used.
- [ ] Bounded retries (e.g., reject → `Lyra` regenerate ≤2) with loop-guard.
**Verification:**
- [ ] Tests: reject → re-route to `Lyra`; cap respected; linear mode regression-tested. `npm test`.
**Dependencies:** T2, T6.
**Files:** `lib/agents/orchestrator.ts`, `lib/agents/types.ts`, `lib/agents/orchestrator.test.ts`.
**Scope:** M–L.

## Task 15: Parallel per-platform drafting + synthesis
**Description.** Draft platform variants concurrently and add a synthesis/selection step (fan-out/fan-in), reducing latency and enabling "best-of-N" selection.
**Acceptance criteria:**
- [ ] `draft-per-platform` fans out across platforms concurrently (e.g., `Promise.all` or LangGraph parallel branches); a `synthesize` step selects/merges.
- [ ] Output shape (`drafts`, `savedContentIds`) unchanged for downstream `Castor`/`Atlas`.
**Verification:**
- [ ] Tests: N platforms produce N drafts; synthesis picks per criteria; latency improved vs sequential (sanity). `npm test`.
**Dependencies:** T10.
**Files:** `lib/agent/graph.ts`, `lib/agent/nodes/draft-per-platform.ts`, `lib/agent/nodes/synthesize.ts` (new), `lib/agent/state.ts`.
**Scope:** M.

## Task 16: MCP inward — tool/connector layer
**Description.** Give agents a standard way to call tools via MCP (client), so new integrations plug in as MCP servers and stay out of the prompt context (tool-search/code-mode pattern). Ship one reference connector.
**Acceptance criteria:**
- [ ] MCP client wrapper in `lib/agent/tools/mcp/`; agents can invoke an MCP tool through the existing tool seam; env-gated (hidden until configured).
- [ ] One reference tool routed through MCP (e.g., web-search or an analytics pull) with a mock server in tests.
**Verification:**
- [ ] Tests with a stub MCP server: tool call round-trips; absent config → graceful no-op (mirrors the Tavily-without-key pattern). `npm test`.
**Dependencies:** Foundations (independent of P0/P1 internals).
**Files:** `lib/agent/tools/mcp/*`, registry/tool wiring, env additions (+ CI placeholders).
**Scope:** L.

## Task 17: A2A outward — expose the pipeline as an A2A agent
**Description.** Let enterprise customers' agents call SocialFlow. Serve an Agent Card + JSON-RPC `message/send`, `message/stream` (SSE), `tasks/get`, mapping a "draft & schedule campaign" message to `orchestrator.startRun` and run status to A2A tasks.
**Acceptance criteria:**
- [ ] `/.well-known/agent-card.json` describes the agent; `message/send` starts a run and returns a task id (= `runId`); `tasks/get` returns run status; `message/stream` streams progress over SSE.
- [ ] Authenticated + tenant-scoped; feature-gated; documented.
**Verification:**
- [ ] Tests for the request→`startRun` mapping + `tasks/get` status mapping; manual: external client fetches the card, sends a message, polls the run. `npm run build`.
**Dependencies:** T2 (run lifecycle), ideally T14.
**Files:** `app/.well-known/agent-card.json/route.ts`, `app/api/a2a/route.ts`, `lib/a2a/*`.
**Scope:** L.

### Checkpoint D — P2 complete
- [ ] Supervisor reroutes a rejection; drafting runs in parallel; an MCP tool call round-trips; an external A2A client can start + poll a run. All gates green.

---

## Risks & mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Behavior change: `Lyra` no longer auto-accepts (AD-3) could strand runs if the gate/UI is incomplete | High | Ship T2–T8 as one vertical slice behind a flag; keep auto-publish default **off** until evals (T9) calibrate the threshold |
| LLM-judge cost/latency on every draft | Med | Run deterministic checks first (cheap), judge only when not already `block`; cache by content hash; batch per run |
| Judge miscalibration → wrongly auto-publishes off-brand post | High | Default `autoPublishEnabled=false`; calibrate threshold from labeled data (T9); deterministic banned-term `block` overrides score |
| New `agent_name`/run-status enums need a live migration before deploy | Med | Migrations are additive; apply 00NN before the worker ships; CI builds with `SKIP_ENV_VALIDATION=true` + placeholders |
| `npm test` only globs `lib/**` | Low | Keep unit tests under `lib/`; eval/A2A scripts run via `tsx` directly |
| Scope creep across 17 tasks | Med | Hard checkpoints A–D; P0 (T1–T9) is independently shippable value; P2 is optional/gated |
| CodeRabbit adaptive rate-limit on many PRs (known) | Low | Batch into few PRs per phase; merge on CI-green + manual self-review when limited (per project norm) |

## Open questions (non-blocking — sensible defaults chosen)
- Default `autoPublishThreshold` value → **decided by T9 calibration**; ships at `0.8` placeholder, `autoPublishEnabled=false`.
- Reject UX: silently finalize vs auto-regenerate via supervisor (T14) → default **finalize**, regenerate is opt-in.
- Per-platform thresholds (e.g., stricter on LinkedIn) → start with one tenant-wide threshold; revisit after T9.
- A2A auth scheme (API key vs OAuth) for external agents → defer to T17 design.

## Rollout & flags
- New optional env (add CI placeholders per project workflow): A2A enable + secret, MCP server URLs/keys. LangSmith vars already optional.
- Suggested PR cadence: **PR-1** T1–T2 (foundations), **PR-2** T3–T8 (gate slice), **PR-3** T9 (evals), **PR-4** T10–T11 (memory), **PR-5** T12–T13 (governance), **PR-6+** T14–T17 (one per task). Each: local gates green → non-draft PR → CodeRabbit → merge on green.

## Verification appendix (every task)
```bash
npm run lint          # eslint
npm run typecheck     # tsc --noEmit
npm run build         # next build
npm test              # tsx --test "lib/**/*.test.ts"
npm run db:generate   # drizzle-kit generate  (after schema changes)
npm run db:migrate    # drizzle-kit migrate   (apply; needs DATABASE_URL)
```
A task is **done** only when lint + typecheck + build + the task's tests are green and its acceptance criteria are checked.
