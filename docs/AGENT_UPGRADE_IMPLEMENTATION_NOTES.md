# Agent-Layer Upgrade — Implementation Notes

Running log of decisions made that **weren't in the spec**, things changed, and tradeoffs. Companion to [docs/AGENT_UPGRADE_PLAN.md](AGENT_UPGRADE_PLAN.md). Newest entries at the bottom of each PR section.

## Working conventions
- **One branch per PR batch (≥3 tasks).** Local gates green before pushing: `npm run lint && npm run typecheck && npm run build && npm test`. Non-draft PR → CodeRabbit auto-review → apply findings → merge on green.
- **Tests live under `lib/**`** — `npm test` globs `lib/**/*.test.ts` (`tsx --test`). New unit tests must be under `lib/` to run in CI. node:test + `assert/strict`, mirroring `lib/agents/orchestrator.test.ts`.
- **Migrations are generated, not applied.** `npm run db:generate` works offline (drizzle config defaults `url` to `""`; generate doesn't connect). `db:migrate` is deferred — no live DB is provisioned yet, so runtime/DB verification is deferred per the project norm (code-verified via lint/typecheck/build/tests).

---

## PR-1 — Foundations (T1–T3)

### T1 — Castor + run-state enums
- **Append-only enum values (tradeoff).** Added `"castor"` to `agentNameEnum` and `"awaiting_approval"` + `"rejected"` to `agentRunStatusEnum` at the **end** of each array, even though Castor logically sits between Lyra and Atlas. Rationale: Postgres `ALTER TYPE … ADD VALUE` appends cleanly; inserting mid-list would need `BEFORE/AFTER` positioning and a messier migration. The TS `AgentName` enum mirrors the same order so the "keep values in sync" contract (enums.ts) holds.
- `"rejected"` run status added now (used later by the approve/reject API, T7) so all enum changes ship in one additive migration rather than two.
- Migration `0014_empty_blackheart.sql` = three additive `ALTER TYPE … ADD VALUE`. Caveat for whoever applies it: Postgres can't use a newly-added enum value in the **same transaction** that adds it — not an issue here (no later migration both adds and uses these), just noting.

### T2 — Orion pause/resume (schema change NOT in the original spec)
- **Added `agent_steps.control` jsonb column** (migration `0015_short_joseph.sql`). **Why (off-spec):** the orchestrator's idempotency guard re-delivers a *completed* step's handoff on retry; a paused Castor step has **no handoff**, so a naive retry would hit the null-handoff branch and wrongly mark the run `completed`. Persisting the pause intent on the **same row** as the completed step lets a retry re-apply `awaiting_approval` instead. This is the correct, durable fix vs. overloading `summary`.
- Added a `settle()` helper in the orchestrator that centralizes the three terminal outcomes (pause → `awaiting_approval`; handoff → enqueue next; neither → `completed`) so both the fresh-dispatch and idempotent re-delivery paths share one rule. Pause is idempotent (re-applying `awaiting_approval` is a no-op).
- `AgentResult.control` is **mutually exclusive** with `handoff` — Castor returns one or the other.
- `resumeRun({ runId, clerkUserId, step })` lives on the orchestrator returned by `createOrchestrator`, so the runtime composition root needs **no change** (it already injects `enqueueAgentStep`/`updateAgentRun`). It flips the run to `running` then enqueues, reverting to `awaiting_approval` if the enqueue throws (so a resume can't strand the run).

### T3 — Brand-safety guardrail
- **Engine kept pure** (`lib/agent/guardrails/brand-safety.ts`, no llm/env import) with an **injected `judge`**; the real temperature-0 model judge is a separate `model-judge.ts`. This mirrors the agent-factory split so the engine unit-tests without a model or env.
- **Banned terms are case-insensitive substrings, not regex** (deviation from the plan's "reuse the ReDoS-guarded matcher"). Rationale: brand banned-term lists are words/phrases; substring matching has **no ReDoS surface**, so the guard isn't needed. The `regex-guard` util stays available if regex banned-terms are wanted later.
- **PII/secret detectors are soft** (→ `review`, not `block`) to avoid false-positive blocks on intentionally-shared contact details; **banned terms hard-block** (score 0).
- **Judge fails closed to `review`** (score 0 + a `policy` violation), never a silent pass.
- The engine's `verdict` uses a default 0.8 threshold for offline/eval readability; **Castor (T6) will apply the per-tenant threshold** to the raw `score` it returns.
