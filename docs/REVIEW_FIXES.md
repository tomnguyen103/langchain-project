# Review Remediation Plan

Prioritized fixes from the full code-quality + frontend/a11y review (2026-06-22).
Worked on the `review-fixes` branch; batched into two non-draft PRs (Goals 1–3,
then 4–6), each driven to CI-green + CodeRabbit-clean. Merged to `main` only at
the very end, after both batches are clean + green (batch 2 stays unmerged while
batch 1 is under review).

## Batch 1 (Goals 1–3)

### Goal 1 — Metering & limits (Critical)
- Gate `POST /api/agents/run` behind the `research` entitlement (Pro+) and
  `consumeQuota(userId, "ai_generations")` with refund on enqueue failure —
  closes the unmetered-LLM-pipeline bypass.
- Add a Postgres-backed fixed-window rate limiter (reusing the atomic-upsert
  pattern, no new infra); apply per-user to `/api/agents/run` and
  `/api/generate` to bound burst abuse within quota.
- Fix the plan-limit inversion (`pro.postsPerDay` < `free.postsPerDay`) and add a
  guard test asserting `free ≤ pro ≤ premium` for every numeric limit.

### Goal 2 — Accessibility (Critical a11y)
- Label the two `rule-form` Selects; name the media-uploader file input.
- Expose billing usage bars (`role="progressbar"` + values).
- Announce the error boundaries (`role="alert"`) and the route loading fallback
  (`role="status"`); `not-found` → `min-h-dvh`.
- `+N more` button label, char-counter `aria-live`/`aria-invalid`, decorative
  icons `aria-hidden`.

### Goal 3 — Tests / CI / observability
- Replace the hand-maintained `test` file list with glob discovery (kills the
  silent-skip trap).
- App-side structured error seam; replace bare `console.error` in routes.
- CI hardening: advisory `npm audit`, `drizzle-kit check` drift gate, bump pinned
  actions off the deprecated Node 20 runtime.
- Add feasible high-value unit tests (Lyra failure path, ImageKit invalid input).

## Batch 2 (Goals 4–6)

### Goal 4 — Backend hardening
- User-scoped `getPostTarget(id, clerkUserId)`; Atlas Path B uses it.
- Vega marks its `research_topics` row `failed` on error.
- Mark a run `failed` only on the final attempt (move out of `dispatch`).
- Cap ingested comment `author`/`text` length; add `/api/health/ready`.

### Goal 5 — Frontend polish + perf
- Remove em-dashes from visible copy; unify duplicate-intent CTAs.
- Add table/grid semantics and a research in-progress affordance.
- Reporting indexes (`agent_runs.created_at`, `post_targets.published_at`).

### Goal 6 — Remaining + cleanup
- X PKCE random verifier in a per-flow cookie (if low-risk).
- Document the orchestrator (runId, agent) idempotency constraint.
- Remaining test-quality gaps; document any item deferred-with-justification.
