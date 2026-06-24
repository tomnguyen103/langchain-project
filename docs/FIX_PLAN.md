# Fix Plan — Closing SocialFlow's Agent Loop (execution of the 2026-06-24 roadmap)

**Source:** [`docs/ai-agent-feature-roadmap.md`](ai-agent-feature-roadmap.md) §6 "Build first". **Started:** 2026-06-24. **Baseline:** `tsc --noEmit` clean + 248/248 unit tests green (re-verified before work).

This plan operationalizes the roadmap's build-first wave into **6 goals across 2 PRs**, in strict priority order. Each goal is code-verified (lint + typecheck + unit tests + build + `drizzle-kit check`) before it counts as done — runtime verification stays deferred per the project norm (no live DB/Redis/LLM/social creds).

## Workflow (per user directive, 2026-06-24)
1. Build features in priority order; keep the green baseline green at every step.
2. After **≥3 goals** done and **all local gates green**, push a **non-draft** PR (CodeRabbit auto-reviews on open).
3. **Wait for CodeRabbit findings**, apply fixes, push once, `@coderabbitai review` once, repeat until the review is clean AND CI is green.
4. **Merge to main** at the end of the review cycle. Then start the next batch off updated `main`.
5. Never push red code; never commit secrets/`.env`.

> **Cadence note:** the standing project rule is one-PR-per-feature; the user overrode it for this work to **≥3 goals per PR**. Two PRs total. Sequential merge (PR1 → main → PR2) avoids stacked-PR conflicts.

## Priority rationale
The roadmap's keystone finding: the **publish→measure→learn loop is dead at measurement** — `post_targets.metrics` is read by Rigel but never written. So **Pulse is built first** (it unblocks every learning feature), then the governance rails (**Quaestor** cost telemetry, **Vigil** eval gate) that make further autonomy safe, then the engagement/reliability/compliance wave.

---

## PR 1 — Close the loop + governance rails (no DB migration)

### Goal 1 — Pulse: per-target engagement metrics ingestion  ★ keystone
- **Roadmap:** PRD 1. **Maps to:** MASTER_PLAN Goal 10.2 `[~]` (metrics-fetch worker absent).
- **Shape:** a repeatable BullMQ `metrics` job (NOT a new roster agent) registered per active account by Sirius, mirroring `worker/processors/comment-poll.ts` idempotency. Walks recently-published `post_targets`, calls each connector's declared `fetchMetrics`, writes `metrics` + `metricsUpdatedAt`. Maturity-curve cadence (poll often in first 48h, then taper).
- **Files:** `worker/processors/metrics-poll.ts` (new), `lib/queue/queues.ts` (+`metrics` queue), `lib/queue/jobs.ts` (+`registerMetricsPoll`/`enqueue`), `worker/index.ts` (+worker), `lib/agents/sirius/index.ts` (register alongside comment-poll), connector `fetchMetrics` impls starting with Meta (`lib/platforms/{facebook,instagram}.ts`), `lib/repos/posts.ts`, dashboard + `/posts/[id]` read-out.
- **No migration** (writes existing columns).
- **Acceptance:** published target gets non-null `metrics` (against a mocked connector in tests); rate-limit errors back off, don't fail the post; old posts skipped; Sirius registers the poll exactly once (idempotent). New unit tests for the cadence scheduler + idempotent write.

### Goal 2 — Quaestor: run cost & token telemetry
- **Roadmap:** PRD 2. **Maps to:** backlog "Quaestor/Tally" (IDEAS #15 / V2 #7), measurement half only.
- **Shape:** capture LangChain `usage_metadata` at the LLM chokepoint (`lib/llm/factory.ts`); stamp per-step tokens/cost into the existing `agent_steps.summary` jsonb; a `$/MTok` cost-model map; surface per-run + per-step cost in the Lumen `/runs/[runId]` inspector and a month-to-date estimate on `/billing`.
- **Files:** `lib/llm/factory.ts`, `lib/billing/cost-model.ts` (new), `lib/agent/index.ts`, step recording in `lib/agents/orchestrator.ts`/`worker/processors/agent-step.ts`, `lib/runs/timeline.ts`, `components/runs/*`, `app/(dashboard)/billing/page.tsx`.
- **No migration** (rides jsonb). Cost shown as a clearly-labeled estimate.
- **Acceptance:** completed run shows total tokens + estimated cost per step/run; Gemini `usage_metadata` parsed or a flagged fallback used; `/billing` shows MTD estimate. Unit tests for token→cost conversion + per-step rollup.

### Goal 3 — Vigil: brand-safety eval as a CI merge gate
- **Roadmap:** PRD 3. **Maps to:** backlog "Vigil/Vetus" (IDEAS #16 / V2 #6), the CI-gate half.
- **Shape:** add a deterministic **offline-judge mode** to `evals/brand-safety/run.ts` (fixture-scored, no LLM key) and a CI job that fails the build on precision/recall regression vs threshold; keep a nightly live-judge run separate.
- **Files:** `.github/workflows/ci.yml`, `evals/brand-safety/run.ts`, `lib/evals/brand-safety-metrics.ts`, `lib/agent/guardrails/model-judge.ts` (offline mode hook).
- **No migration.**
- **Acceptance:** a deliberately-weakened judge fails the gate; offline mode produces deterministic pass/fail with no LLM key; model-bump replays the set and reports the delta. Meta-test that a bad change fails.

### PR 1 close-out
- Local gates green (lint, typecheck, `tsx --test`, `next build`, `drizzle-kit check`) → push non-draft PR → CodeRabbit → fix → merge to `main`.

---

## PR 2 — Engagement + reliability + compliance (additive migrations)

### Goal 4 — Sirius Triage v1: comment intent/sentiment + injection hardening
- **Roadmap:** PRD 6 + conflict C-2. **Maps to:** MASTER_PLAN backlog "Sirius+" (IDEAS #5).
- **Shape:** one additive migration (`intent`, `sentiment`, `urgency` nullable on `comment_events`); a cheap LLM classification step in `worker/processors/comment-poll.ts`; route only safe buckets (question/praise) to existing `reply.ts`; group everything in an inbox read-out. **P0 security:** harden `composeAiReply` (`worker/processors/reply.ts:120-137`) — bound commenter-text length, quarantine it as data (fixes the unbounded prompt-injection surface).
- **Acceptance:** commenter text is length-bounded before any prompt; each comment gets intent/sentiment/urgency; only safe buckets auto-reply; abuse/complaints never auto-engage. Injection-hardening unit test + classifier-agreement check on a labeled set.

### Goal 5 — Run Doctor: self-healing supervisor (+ per-step idempotency key)
- **Roadmap:** PRD 5 + conflict C-3. **Maps to:** MASTER_PLAN supervisor (T14, wired no-op) / "Medic" (IDEAS #17).
- **Shape:** **prerequisite** — add a per-step idempotency key so a retry of the same agent doesn't collide with its `(runId, agent)` step. Then implement `OrchestratorDeps.supervisor` (wired in `orchestrator.runtime.ts`): classify failure (transient→bounded retry; quality→re-route to refine; token→hold; hard→escalate), bounded by a max-recovery budget; **never override a pause**; record recovery actions in the hash chain; surface in `/runs/[runId]`.
- **Acceptance:** transient error retries within budget then escalates; same-agent retry doesn't double-act; `awaiting_approval` is never auto-resumed; recovery actions appear in the integrity chain. Extend `orchestrator.test.ts`.

### Goal 6 — Praxis Live v1: editable per-org policy/disclosure packs + native AI flag
- **Roadmap:** PRD 7 + conflict C-1 (the de-risked half). **Maps to:** Praxis stretch / Aletheia.
- **Shape:** make the Praxis linter read org rules from the existing `brand_profiles.disclosurePolicy` jsonb (editable in the settings form) in addition to the curated pack; ensure each platform's native AI-content flag is set at publish and recorded in `disclosure_ledger`. **C2PA cryptographic signing stays deferred** (research-later).
- **Acceptance:** an admin-added banned-claim rule blocks a violating draft via Castor; AI post on a supporting platform carries the native flag; ledger records label + policy version. Unit tests for the merged rule pack.

### PR 2 close-out
- Local gates green → push non-draft PR → CodeRabbit → fix → merge to `main`.

---

## Progress
- [ ] Goal 1 — Pulse (metrics ingestion)
- [ ] Goal 2 — Quaestor (cost telemetry)
- [ ] Goal 3 — Vigil (eval CI gate)
- [ ] **PR 1 merged**
- [ ] Goal 4 — Sirius Triage v1 (+ injection fix)
- [ ] Goal 5 — Run Doctor (+ per-step key)
- [ ] Goal 6 — Praxis Live v1
- [ ] **PR 2 merged**

## Out of scope (research-later, per roadmap §7)
C2PA/SynthID media signing · spend-cap enforcement (after Quaestor) · Campaigns/Meridian · multi-brand/Atrium · vector store/RAG · true ReAct tool-calling · A2A marketplace · Dreaming memory-consolidation · parallel subagent fan-out.

## /goal condition (paste to install a hard completion-gate)
```text
/goal Execute docs/FIX_PLAN.md: build the 6 build-first goals (Pulse, Quaestor, Vigil, Sirius Triage v1, Run Doctor, Praxis Live v1) in priority order, keeping lint/typecheck/unit-tests/build/drizzle-check green. After each batch of >=3 goals with green gates, push a NON-DRAFT PR, wait for CodeRabbit, apply fixes, drive CI green + review clean, then merge to main. Done when all 6 are merged to main.
```
