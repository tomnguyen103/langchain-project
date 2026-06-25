# Master Implementation Plan (v2)
_Consolidated from 16 source docs on 2026-06-24. Supersedes: **docs/MASTER_PLAN.md (v1)** (retained in `docs/` as history). Status reflects a **fresh** codebase scan — files opened and confirmed, plus a clean `tsc --noEmit` and a passing unit run (**248/248 tests, 62 suites**, 2026-06-24) — not aspiration, and **not** copied from v1's marks._
_Last updated: 2026-06-24 (run #2). Re-verified against the current codebase — no new/changed source plans and no code changes since run #1; the work-item set and all statuses are unchanged._

> **Why v2?** v1 was written earlier today but (a) left every source plan sitting in `docs/` (now archived by this run) and (b) carried some stale notes. Per the consolidation rules, every status below was **re-derived from current evidence**: a few v1 items were upgraded or corrected (onboarding checklist, reconnect CTA, `comment_events`, `lib/reviews/resolve.ts`), and the negatives (Atrium, metrics-fetch worker, A2A scaffold) were re-confirmed. See **Re-verification notes** for the deltas.

> **Global caveat — runtime verification is still deferred.** Per the project norm, no DB/Redis/LLM/social creds are provisioned, so **nothing has been exercised against real services**. Migrations are **generated, not applied** (0000–0024, 25 files). "Done" here means **code-verified** (lint/typecheck/build/tests + the cited evidence), not "proven live." Going live = apply migrations through 0024 → deploy the always-on worker → exercise generate → Castor gate → review → approve → Atlas schedule → publish.

## Status legend
- [x] Done · [~] Partial · [ ] Not started · [?] Needs verification

## Summary
- **Source docs merged:** 16 — the 15 plan/spec/fix/research docs consolidated by v1, **plus v1 itself** (its items carried forward and re-verified).
- **Canonical committed work items:** **69** → **65 Done · 3 Partial · 1 Not started · 0 unclear**.
- **Ideation backlog (two "idea menu" docs, explicitly never a commitment):** 5 Partial · ~36 Not started (carried forward verbatim; none dropped).
- **Headline:** The product is far more built than the plans imply, and v2's fresh scan **strengthens** that picture — `tsc` is clean and all 248 unit tests pass today. The complete 11-phase SaaS (Goals 0–10), the full named-agent roster (Orion/Vega/Lyra/Atlas/Sirius/Polaris/Rigel + Castor), the entire P0–P2 agent-layer upgrade (Castor gate, evals, brand memory, least-privilege, audit hash-chain, supervisor, MCP-inward, A2A-outward), all 10 remediation goals + the multi-axis review fixes, and the "Recommended Top 3 + wave-2" V2 features (Aletheia, Praxis, Triage, TrueView, Lumen, Praetor) are implemented and on `main`. Remaining work is (a) three genuine partials, (b) **two open decisions** — productionize the multi-tenant A2A model, and the deferred C2PA cryptographic signing — and (c) the large, explicitly-uncommitted feature-idea backlog (campaigns, multi-brand workspaces, cost metering, DM agent, ROI attribution, …). The single biggest real risk remains that **none of it has run against live infrastructure yet.**

---

## Plan (grouped by phase / theme)

### Phase 0 — Foundation & Infrastructure
- [x] **Data layer + dual driver** — Drizzle over Neon; `DB_DRIVER` selects pooled `neon-serverless` (worker) vs stateless `neon-http` (app); `runAtomicWrite` (batch on http / transaction on pool); `closeDbPool` on shutdown.
  - Evidence: [db/index.ts:28](db/index.ts), [worker/load-env.ts](worker/load-env.ts) (sets `DB_DRIVER=pool`), [worker/index.ts:153](worker/index.ts)
  - Sources: PLAN.md, ROADMAP.md (Goal 0), FIX_PLAN.md (Goal 5)
- [x] **Env validation** — zod, server/client split, fail-fast; unconditional `ENCRYPTION_KEY` length check.
  - Evidence: [lib/env.ts:1](lib/env.ts), [lib/utils/crypto.ts:24](lib/utils/crypto.ts)
  - Sources: PLAN.md, ROADMAP.md (Goal 0)
- [x] **Queue + worker skeleton** — `QueueName` enum, lazy `getQueue`, `enqueueWithLedger`, deterministic job-ids; `startWorker` per queue; graceful SIGTERM.
  - Evidence: [lib/queue/queues.ts](lib/queue/queues.ts), [lib/queue/with-ledger.ts](lib/queue/with-ledger.ts), [lib/queue/job-ids.ts](lib/queue/job-ids.ts), [worker/index.ts:1](worker/index.ts)
  - Sources: PLAN.md, ROADMAP.md (Goal 0)
- [x] **Design system / ShadCN theme + health route + CI/CodeRabbit** — ShadCN components, Tailwind v4 tokens, light/dark; `/api/health` liveness; CI workflow + CodeRabbit drove every PR.
  - Evidence: [components/ui](components/ui), [app/api/health/route.ts](app/api/health/route.ts), [app/globals.css](app/globals.css), [.github/workflows/ci.yml](.github/workflows/ci.yml)
  - Sources: ROADMAP.md (Goal 0), IMPLEMENTATION_NOTES.md
  - Notes: `/theme-check` proof page from the Goal-0 prompt not present as a route; theming itself is present and used app-wide.

### Phase 1 — Auth, App Shell & Marketing
- [x] **Clerk auth + route protection** — `clerkMiddleware` with public allow-list incl. `/api/webhooks`; `requireUserId`/`getOrgId`; sign-in/up routes.
  - Evidence: [proxy.ts:12](proxy.ts), [lib/clerk.ts:1](lib/clerk.ts)
  - Sources: PLAN.md, ROADMAP.md (Goal 1), FIX_PLAN.md (Goal 1 — webhook unblock)
- [x] **Marketing landing + pricing** — hero, feature grid, platform glyphs, honest agent-pipeline illustration, pricing CTAs (Free/Pro/Premium); legal privacy/terms stubs.
  - Evidence: [app/(marketing)/page.tsx:1](app/(marketing)/page.tsx), [app/(marketing)/pricing/page.tsx](app/(marketing)/pricing/page.tsx), [app/(marketing)/legal/privacy/page.tsx](app/(marketing)/legal/privacy/page.tsx)
  - Sources: ROADMAP.md (Goal 1), REVIEW_FIX_PLAN.md (PR-E landing polish)
- [x] **Dashboard shell + nav** — sidebar (Review/Runs/Compliance/Team incl.), topbar with `QuotaBadge`/`ThemeToggle`/`UserButton`.
  - Evidence: [app/(dashboard)/layout.tsx:1](app/(dashboard)/layout.tsx), [components/shared/nav-items.ts](components/shared/nav-items.ts), [components/shared/topbar.tsx](components/shared/topbar.tsx)
  - Sources: ROADMAP.md (Goal 1)

### Phases 2–3 & 8 — Publishing Core (MVP → Multi-Platform → all adapters)
- [x] **Core schema + repos** — `enums`, `social_accounts`, `posts`, `post_targets`, `media_assets`, `schedules`; typed CRUD repos.
  - Evidence: [db/schema/post-targets.ts](db/schema/post-targets.ts), [db/schema/posts.ts](db/schema/posts.ts), [lib/repos/posts.ts:1](lib/repos/posts.ts)
  - Sources: PLAN.md, ROADMAP.md (Goal 2)
- [x] **`PlatformConnector` interface + registry + token crypto** — `getConnector()` with **no switch**; `AbstractConnector` refresh-on-expiry; AES-256-GCM at rest.
  - Evidence: [lib/platforms/types.ts:1](lib/platforms/types.ts), [lib/platforms/registry.ts:1](lib/platforms/registry.ts), [lib/platforms/base.ts:1](lib/platforms/base.ts), [lib/utils/crypto.ts:1](lib/utils/crypto.ts)
  - Sources: PLAN.md, ROADMAP.md (Goal 2)
- [x] **All 8 platform adapters** — LinkedIn, X, Facebook, Instagram, Pinterest, YouTube, TikTok, Discord, each with `publishNow` + capabilities, registered.
  - Evidence: [lib/platforms/x.ts](lib/platforms/x.ts), [lib/platforms/instagram.ts](lib/platforms/instagram.ts), [lib/platforms/tiktok.ts](lib/platforms/tiktok.ts), [lib/platforms/discord.ts](lib/platforms/discord.ts), [lib/platforms/facebook.ts](lib/platforms/facebook.ts), [lib/platforms/linkedin.ts](lib/platforms/linkedin.ts), [lib/platforms/pinterest.ts](lib/platforms/pinterest.ts), [lib/platforms/youtube.ts](lib/platforms/youtube.ts)
  - Sources: ROADMAP.md (Goals 2, 3, 8)
- [x] **OAuth start/callback** — signed state → exchange → multi-account upsert into encrypted `social_accounts`; comment-poll registration on connect.
  - Evidence: [app/api/oauth/[provider]/start/route.ts:1](app/api/oauth/[provider]/start/route.ts), [app/api/oauth/[provider]/callback/route.ts:1](app/api/oauth/[provider]/callback/route.ts), [lib/oauth/registry.ts](lib/oauth/registry.ts)
  - Sources: ROADMAP.md (Goals 2, 3)
- [x] **ImageKit upload + AI media variants** — signed upload params; platform-sized + branded transform URLs; SSRF-guarded URL builder; derived assets link via `media_assets.sourceAssetId`.
  - Evidence: [app/api/imagekit/auth/route.ts:1](app/api/imagekit/auth/route.ts), [lib/imagekit/transform.ts:1](lib/imagekit/transform.ts), [lib/imagekit/url.ts:7](lib/imagekit/url.ts), [app/(dashboard)/create/actions.ts:94](app/(dashboard)/create/actions.ts)
  - Sources: ROADMAP.md (Goals 2, 8)
- [x] **Composer** — platform multi-select (only connected), per-platform variant editor, timezone schedule-picker; creates post + N `post_targets`.
  - Evidence: [components/composer/composer.tsx:1](components/composer/composer.tsx), [components/composer/variant-editor.tsx](components/composer/variant-editor.tsx), [app/(dashboard)/create/actions.ts:155](app/(dashboard)/create/actions.ts)
  - Sources: ROADMAP.md (Goals 2, 3)
- [x] **Publish worker** — loads target+account in parallel, **fails fast if account not active**, `getConnector().publishNow()`, records `externalPostId`/`publishedAt`, 4 retries exponential backoff, deterministic `jobId`, schedules ledger.
  - Evidence: [worker/processors/publish.ts:1](worker/processors/publish.ts), [lib/queue/jobs.ts:22](lib/queue/jobs.ts)
  - Sources: PLAN.md, ROADMAP.md (Goal 2), REVIEW_FIX_PLAN.md (F-B5, F-D1)
- [x] **Per-target status rollup + retry/cancel** — `derivePostStatus` (published/partially_published/failed/publishing/scheduled); `cancelTarget`/`retryTarget`/`reschedulePost`.
  - Evidence: [lib/posts/status.ts:1](lib/posts/status.ts), [lib/repos/posts.ts:277](lib/repos/posts.ts), [app/(dashboard)/posts/actions.ts:36](app/(dashboard)/posts/actions.ts)
  - Sources: ROADMAP.md (Goal 3)
- [x] **Calendar — month grid + mobile agenda + accessible reschedule** — desktop drag-drop kept; `RescheduleDialog` keyboard/touch path; future-time guarded.
  - Evidence: [app/(dashboard)/calendar/page.tsx:1](app/(dashboard)/calendar/page.tsx), [components/calendar/calendar-grid.tsx:1](components/calendar/calendar-grid.tsx), [components/calendar/reschedule-dialog.tsx](components/calendar/reschedule-dialog.tsx)
  - Sources: ROADMAP.md (Goals 2, 10), FIX_PLAN.md (Goal 9)

### Phase 4 — AI Content Agent (Lyra StateGraph)
- [x] **LLM factory** — `getChatModel()` → LangChain model, Gemini default, OpenAI/Anthropic mirrors, `LLM_PROVIDER` switch.
  - Evidence: [lib/llm/factory.ts:14](lib/llm/factory.ts), [lib/llm/providers](lib/llm/providers)
  - Sources: PLAN.md, ROADMAP.md (Goal 4)
- [x] **Content StateGraph + nodes** — `research→digest→ideate→draft→critique→(refine|finalize)`; bounded `MAX_REVISIONS`; `runContentAgent`.
  - Evidence: [lib/agent/graph.ts:1](lib/agent/graph.ts), [lib/agent/state.ts:6](lib/agent/state.ts), [lib/agent/index.ts:13](lib/agent/index.ts), [lib/agent/nodes](lib/agent/nodes)
  - Sources: PLAN.md, ROADMAP.md (Goal 4)
- [x] **Parallel per-platform drafting + best-of-N synthesis (T15)** — `Promise.all` fan-out, `selectBestDraft` fan-in; `DRAFT_VARIANTS` (default 1).
  - Evidence: [lib/agent/select-draft.ts:7](lib/agent/select-draft.ts), [lib/agent/nodes/draft-per-platform.ts:16](lib/agent/nodes/draft-per-platform.ts)
  - Sources: AGENT_UPGRADE_PLAN.md (T15), research 2026-06-22 (card 1)
- [x] **Generate endpoint (JSON)** — `/api/generate` returns JSON; `generate-panel` consumes it.
  - Evidence: [app/api/generate/route.ts:24](app/api/generate/route.ts), [components/composer/generate-panel.tsx:34](components/composer/generate-panel.tsx)
  - Sources: ROADMAP.md (Goal 4), FIX_PLAN.md (Goal 7 / L4)
  - Notes: **Streaming was descoped.** ROADMAP/PLAN originally said "streaming"; FIX_PLAN Goal 7 corrected the docs to "returns JSON." See Conflicts #4.
- [x] **LangSmith tracing** — `isLangSmithEnabled` gate, deep-link builder, `langsmithRunId` captured onto `generated_content`/`agent_runs`.
  - Evidence: [lib/observability/langsmith.ts:4](lib/observability/langsmith.ts), [lib/agent/index.ts:31](lib/agent/index.ts)
  - Sources: ROADMAP.md (Goals 4, 9)

### Phase 5 — Niche Research Pipeline
- [x] **Research schema + web-search tool** — `research_topics`; Tavily behind an interface with graceful empty-fallback when unkeyed.
  - Evidence: [lib/agent/research.ts:16](lib/agent/research.ts), [lib/agent/tools/web-search.ts:8](lib/agent/tools/web-search.ts), [db/schema/research.ts:9](db/schema/research.ts)
  - Sources: ROADMAP.md (Goal 5)
- [x] **Research→generate chaining** — chaining relocated out of the research processor into an Orion handoff (Vega→Lyra); provenance via `posts.sourceContentId`.
  - Evidence: [worker/processors/research.ts](worker/processors/research.ts), [lib/agents/vega/index.ts:46](lib/agents/vega/index.ts)
  - Sources: ROADMAP.md (Goal 5), ORCHESTRATION.md / ORCHESTRATION_GOALS.md (A2)
- [x] **Research/Ideas UI** — Topics/Ideas tabs; status polling narrowed to id+status; "accept → composer" prefill.
  - Evidence: [app/(dashboard)/research/page.tsx](app/(dashboard)/research/page.tsx), [components/research/topic-list.tsx](components/research/topic-list.tsx), [components/research/idea-card.tsx](components/research/idea-card.tsx)
  - Sources: ROADMAP.md (Goal 5), REVIEW_FIX_PLAN.md (S-PERF-2)

### Phase 6 — Billing, Quotas & Rate Limiting
- [x] **Plans + entitlements** — `PLAN_LIMITS` Free/Pro/Premium; `can()`/`consumeQuota`/`releaseQuota` via Clerk `has()`; billing page w/ PricingTable.
  - Evidence: [lib/billing/plans.ts:16](lib/billing/plans.ts), [lib/billing/entitlements.ts:22](lib/billing/entitlements.ts), [app/(dashboard)/billing/page.tsx](app/(dashboard)/billing/page.tsx)
  - Sources: ROADMAP.md (Goal 6)
- [x] **Usage metering + enforcement + invariant test** — atomic conditional upsert (`setWhere count<limit`), `releaseUsage` floored at 0, daily + ai-generation caps, `free ≤ pro ≤ premium` guard test.
  - Evidence: [lib/repos/usage.ts:30](lib/repos/usage.ts), [lib/billing/plans.test.ts:7](lib/billing/plans.test.ts)
  - Sources: ROADMAP.md (Goal 6), REVIEW_FIXES.md (Goal 1)
- [x] **Postgres fixed-window rate limiter** — `takeRateLimit` (bails on `limit<=0`), applied to `/api/agents/run` + `/api/generate`.
  - Evidence: [lib/repos/rate-limits.ts:12](lib/repos/rate-limits.ts), [lib/rate-limit.ts:9](lib/rate-limit.ts)
  - Sources: REVIEW_FIXES.md (Goal 1), REVIEW_FIX_PLAN.md (S-CODE-4)
- [x] **Quota refund on cancel** — `posts.scheduleQuotaPeriod`/`scheduleQuotaHeld`; `cancelTarget` refunds the right window atomically; reschedule/retry re-consume.
  - Evidence: [db/schema/posts.ts:32](db/schema/posts.ts), [lib/repos/posts.ts](lib/repos/posts.ts), [lib/billing/period.ts](lib/billing/period.ts)
  - Sources: REVIEW_FIX_PLAN.md (F-C1)

### Phase 7 — Engagement / Auto-Reply
- [x] **Rules + UI** — `auto_reply_rules` (keywords, matchType, template, AI toggle, cooldownSec, maxPerDay); RuleForm/RuleTable.
  - Evidence: [db/schema/auto-reply.ts:25](db/schema/auto-reply.ts), [app/(dashboard)/auto-reply/page.tsx:70](app/(dashboard)/auto-reply/page.tsx)
  - Sources: ROADMAP.md (Goal 7)
- [x] **Comment ingestion** — repeatable comment-poll per account, batch insert into `comment_events` + watermark, Meta webhook with constant-time HMAC + `hub.verify_token`, dedupe `(socialAccountId, externalCommentId)`.
  - Evidence: [db/schema/comment-events.ts:22](db/schema/comment-events.ts), [worker/processors/comment-poll.ts:29](worker/processors/comment-poll.ts), [app/api/webhooks/comments/[provider]/route.ts:1](app/api/webhooks/comments/[provider]/route.ts), [lib/webhooks/meta.ts](lib/webhooks/meta.ts), [lib/webhooks/comments.ts](lib/webhooks/comments.ts)
  - Sources: ROADMAP.md (Goal 7), FIX_PLAN.md (Goal 1), REVIEW_FIX_PLAN.md (F-A2/F-A3/S-SEC-1)
  - Notes (v2 re-verify): the `comment_events` table and extracted `lib/webhooks/{comments,meta}.ts` verifiers (tests passing) are now cited directly — v1 only referenced the route. The table carries ingestion+reply-outcome fields **only** (no sentiment/category/urgency) → the "Sirius+" enrichment is genuine backlog (see Backlog).
- [x] **Reply matching + dispatch + race-safe slots** — lease-based `claimReply`; atomic `grantReplySlot`/`releaseReplySlot` upsert serializes per-rule cap/cooldown; pure `slot.ts` mirror + test.
  - Evidence: [worker/processors/reply.ts:27](worker/processors/reply.ts), [lib/repos/replies.ts:375](lib/repos/replies.ts), [lib/auto-reply/slot.ts:1](lib/auto-reply/slot.ts), [lib/auto-reply/match.ts](lib/auto-reply/match.ts)
  - Sources: ROADMAP.md (Goal 7), FIX_PLAN.md (Goal 4), REVIEW_FIX_PLAN.md (F-C2)

### Phase 9 — Observability & Hardening
- [x] **Structured logging + LangSmith deep links** — worker logger; run/step correlation to LangSmith.
  - Evidence: [worker/logger.ts](worker/logger.ts), [lib/observability/langsmith.ts:14](lib/observability/langsmith.ts)
  - Sources: ROADMAP.md (Goal 9)
- [x] **Queue health + ledger reconcile sweep** — token-guarded `/api/health/queues`; `reconcile` processor fails orphaned `pending` ledger rows + marks stuck targets failed.
  - Evidence: [app/api/health/queues/route.ts:41](app/api/health/queues/route.ts), [app/api/health/ready/route.ts](app/api/health/ready/route.ts), [worker/processors/reconcile.ts:29](worker/processors/reconcile.ts)
  - Sources: ROADMAP.md (Goal 9), FIX_PLAN.md (Goal 1), REVIEW_FIX_PLAN.md (S-CODE-3)
- [x] **Token-refresh + account health** — proactive refresh, expire only on definitive auth failure, synthetic future expiry; non-active status badged in UI; publish fails fast on dead accounts; **reconnect CTA present** on the dashboard "Needs attention" panel + accounts page.
  - Evidence: [worker/processors/token-refresh.ts:35](worker/processors/token-refresh.ts), [components/accounts/account-card.tsx:47](components/accounts/account-card.tsx), [app/(dashboard)/dashboard/page.tsx:154](app/(dashboard)/dashboard/page.tsx)
  - Sources: ROADMAP.md (Goal 9), REVIEW_FIX_PLAN.md (F-B4)
  - Notes (v2 re-verify): v1 claimed "no dedicated reconnect CTA" — **corrected**: unhealthy accounts render a `{status} · reconnect` action linking to `/accounts`. Only the compose-time pre-block is absent (publish-time fail-fast covers it).

### Phase 10 — Polish & Launch
- [x] **SEO/metadata + typography + icons** — `@tailwindcss/typography`; `metadataBase`/openGraph/twitter; code-generated OG + favicon + apple/twitter images.
  - Evidence: [app/layout.tsx:23](app/layout.tsx), [app/opengraph-image.tsx:1](app/opengraph-image.tsx), [app/apple-icon.tsx](app/apple-icon.tsx)
  - Sources: FIX_PLAN.md (Goal 7)
- [x] **Accessibility pass** — skip-to-content + focusable `<main>`, fieldset/legend on platform group, `SheetDescription`, real `<form onSubmit>`, progressbar/alert/status roles.
  - Evidence: [app/(dashboard)/layout.tsx](app/(dashboard)/layout.tsx), [components/composer/composer.tsx](components/composer/composer.tsx)
  - Sources: FIX_PLAN.md (Goal 8), REVIEW_FIXES.md (Goal 2)
- [x] **Final-QA scaffolding** — error boundaries (`error.tsx`/`global-error.tsx`), loading skeletons (`loading.tsx`), `not-found.tsx`, dark mode.
  - Evidence: [app/(dashboard)/error.tsx](app/(dashboard)/error.tsx), [app/(dashboard)/loading.tsx](app/(dashboard)/loading.tsx), [app/global-error.tsx](app/global-error.tsx)
  - Sources: ROADMAP.md (Goal 10)
- [~] **Engagement analytics pull-back + overview dashboard** — Rigel aggregates published counts/engagement and an operational overview dashboard exists (connected accounts, upcoming, failed/attention); a dedicated **metrics-fetch worker** writing `post_targets.metrics` (likes/comments/views) is **not present** (no metrics processor under `worker/processors/`).
  - Evidence: [lib/agents/rigel/queries.ts](lib/agents/rigel/queries.ts), [lib/agents/rigel/aggregate.ts](lib/agents/rigel/aggregate.ts), [app/(dashboard)/dashboard/page.tsx](app/(dashboard)/dashboard/page.tsx)
  - Missing: a scheduled per-target metrics fetch — needs a live platform to build/verify against.
  - Sources: ROADMAP.md (Goal 10.2)
- [~] **Onboarding** — a "Get started" first-run **checklist** is present on the dashboard (Connect account → Create first post → Set up auto-reply rule, with per-step done/links, hidden once complete); empty states + dark mode present. A dedicated **guided multi-step wizard** is not implemented.
  - Evidence: [app/(dashboard)/dashboard/page.tsx:44](app/(dashboard)/dashboard/page.tsx) (`onboarding` checklist, lines 44–114)
  - Missing: a guided wizard flow (vs. the lightweight checklist).
  - Sources: ROADMAP.md (Goal 10.3)
  - Notes (v2 re-verify): v1 said "wizard not found" and implied nothing exists — **corrected**: a real onboarding checklist affordance exists; only the heavier guided-wizard form is missing.

### Agent Orchestration Roster (ORCHESTRATION.md — Goals A0–A5)
- [x] **Agent contract + registry + schema spine (A0)** — `AgentName` enum, `AgentResult` discriminated union (handoff|control|terminal), `getAgent` (no switch); `agent_runs`/`agent_steps` + repos.
  - Evidence: [lib/agents/types.ts:16](lib/agents/types.ts), [lib/agents/registry.ts:63](lib/agents/registry.ts), [db/schema/agent-runs.ts:32](db/schema/agent-runs.ts)
  - Sources: ORCHESTRATION.md, ORCHESTRATION_GOALS.md (A0)
- [x] **Vega/Lyra/Atlas wrappers (A1)** — thin `AgentDefinition`s over `runResearch`/`runContentAgent`/`enqueuePublish` with handoff mapping.
  - Evidence: [lib/agents/vega/index.ts:46](lib/agents/vega/index.ts), [lib/agents/lyra/index.ts:38](lib/agents/lyra/index.ts), [lib/agents/atlas/index.ts](lib/agents/atlas/index.ts)
  - Sources: ORCHESTRATION_GOALS.md (A1)
- [x] **Orion orchestrator + agent-step queue (A2)** — `dispatch`/`startRun`/`resumeRun`/`settle`; `agent-step` queue + processor; idempotent `(runId, agent)` handoffs; `/api/agents/run` entry.
  - Evidence: [lib/agents/orchestrator.ts:120](lib/agents/orchestrator.ts), [worker/processors/agent-step.ts](worker/processors/agent-step.ts), [lib/queue/jobs.ts:121](lib/queue/jobs.ts)
  - Sources: ORCHESTRATION.md, ORCHESTRATION_GOALS.md (A2)
- [x] **Sirius engagement agent (A3)** — wraps comment-poll registration; publish completion hands off to Sirius (non-blocking).
  - Evidence: [lib/agents/sirius/index.ts:23](lib/agents/sirius/index.ts)
  - Sources: ORCHESTRATION_GOALS.md (A3)
- [x] **Rigel reporting agent (A4)** — scheduled `report` queue; read-only aggregations; feed-forward into the next plan + `learnedMemory`.
  - Evidence: [lib/agents/rigel/index.ts:45](lib/agents/rigel/index.ts), [lib/queue/jobs.ts:263](lib/queue/jobs.ts), [db/schema/reports.ts](db/schema/reports.ts)
  - Sources: ORCHESTRATION_GOALS.md (A4)
- [x] **Polaris seeding agent (A5)** — `supportsSeeding` capability + `seeding` queue/processor; non-capable platforms degrade gracefully.
  - Evidence: [lib/agents/polaris/index.ts:20](lib/agents/polaris/index.ts), [worker/processors/seeding.ts](worker/processors/seeding.ts), [lib/platforms/seeding.ts](lib/platforms/seeding.ts)
  - Sources: ORCHESTRATION_GOALS.md (A5)

### Agent-Layer Upgrade — Gate / Evals / Memory / Governance / Interop (AGENT_UPGRADE_PLAN.md, T1–T17)
- [x] **Castor brand-safety gate (T1–T6)** — `castor` agent + `awaiting_approval`/`rejected` states + `agent_steps.control`; Lyra hands to Castor (no auto-accept); per-tenant threshold; held→pause. *(= "Aegis #6" + "Sentry #7" + research P0 card 9.)*
  - Evidence: [lib/agents/castor/index.ts:65](lib/agents/castor/index.ts), [lib/agent/guardrails/brand-safety.ts:66](lib/agent/guardrails/brand-safety.ts), [lib/agent/guardrails/model-judge.ts](lib/agent/guardrails/model-judge.ts)
  - Sources: AGENT_UPGRADE_PLAN.md (T1–T6), AGENT_FEATURE_IDEAS.md (#6 Aegis, #7 Sentry), research 2026-06-22 (P0 card 9)
- [x] **Per-brand profile + voice + learned memory (T4/T10/T11)** — `brand_profiles` (voice/bannedTerms/autoPublish*/`learnedMemory`); voice threaded into prompts; Rigel `setLearnedMemory` feedback loop. *(= "Mnemosyne #1" core.)*
  - Evidence: [db/schema/brand-profiles.ts:33](db/schema/brand-profiles.ts), [lib/repos/brand-profiles.ts:30](lib/repos/brand-profiles.ts), [lib/brand/learned-notes.ts](lib/brand/learned-notes.ts), [lib/agents/rigel/index.ts:71](lib/agents/rigel/index.ts)
  - Sources: AGENT_UPGRADE_PLAN.md (T4/T10/T11), AGENT_FEATURE_IDEAS.md (#1 Mnemosyne), research 2026-06-22 (P1 card 3)
- [x] **Review persistence (T5)** — `generated_content.reviewStatus`(pending|held|approved|rejected)/`brandSafetyScore`/`reviewVerdict`/`reviewViolations`/`reviewedBy`/`agentRunId`. *(Deviation: consolidated onto `generated_content`, no separate `content_reviews` table — see Conflicts #3.)*
  - Evidence: [db/schema/generated-content.ts:40](db/schema/generated-content.ts), [lib/repos/content-reviews.ts](lib/repos/content-reviews.ts)
  - Sources: AGENT_UPGRADE_PLAN.md (T5)
- [x] **Offline evals + threshold calibration (T9)** — `recommendThreshold` with safety floor; labeled dataset + `npm run eval:brand-safety` (judge run deferred to live).
  - Evidence: [lib/evals/brand-safety-metrics.ts:37](lib/evals/brand-safety-metrics.ts), [evals/brand-safety/run.ts:1](evals/brand-safety/run.ts), [evals/brand-safety/dataset.ts](evals/brand-safety/dataset.ts)
  - Sources: AGENT_UPGRADE_PLAN.md (T9), AGENT_FEATURE_IDEAS.md (#16 Vetus), research 2026-06-22 (P0 card 8)
- [x] **Least-privilege capability matrix (T12)** — `AGENT_CAPABILITIES` + `hasCapability`/`assertCapability`; Castor review-only, only Atlas publishes; enforced by test + structural dep injection.
  - Evidence: [lib/agents/capabilities.ts:12](lib/agents/capabilities.ts), [lib/agents/capabilities.test.ts](lib/agents/capabilities.test.ts)
  - Sources: AGENT_UPGRADE_PLAN.md (T12), research 2026-06-22 (P1 cards 2, 11)
- [x] **Tamper-evident audit hash chain (T13)** — `agent_steps.prevHash`/`hash`; `recordAgentStep` chains sha256; `verifyRunAudit` returns first broken link.
  - Evidence: [db/schema/agent-steps.ts:40](db/schema/agent-steps.ts), [lib/audit/run-audit.ts:36](lib/audit/run-audit.ts)
  - Sources: AGENT_UPGRADE_PLAN.md (T13), research 2026-06-22 (P1 card 11)
- [x] **Supervisor routing (T14)** — optional `supervisor` dep can override a handoff (bounded recovery); a pause is never overridden; default linear.
  - Evidence: [lib/agents/orchestrator.ts:222](lib/agents/orchestrator.ts)
  - Sources: AGENT_UPGRADE_PLAN.md (T14), research 2026-06-22 (P2 card 1)
- [x] **MCP inward (T16)** — `listMcpTools`/`callMcpTool` over stateless HTTP; graceful no-op when `MCP_SERVER_URL` unset; pure JSON-RPC codec.
  - Evidence: [lib/mcp/client.ts:29](lib/mcp/client.ts), [lib/mcp/rpc.ts](lib/mcp/rpc.ts)
  - Sources: AGENT_UPGRADE_PLAN.md (T16), research 2026-06-22 (P2 card 5)
- [~] **A2A outward (T17)** — `/api/a2a` GET agent-card + POST `message/send`→`startRun` + `tasks/get`; bearer + `A2A_ENABLED` gate, **disabled by default**.
  - Evidence: [app/api/a2a/route.ts:45](app/api/a2a/route.ts), [lib/a2a/protocol.ts:1](lib/a2a/protocol.ts), [lib/a2a/agent-card.ts](lib/a2a/agent-card.ts)
  - Missing (scaffold caveats, by design): multi-tenant credential→tenant mapping (currently single `A2A_TENANT_ID`/body `clerkUserId`), `message/stream` SSE, full task lifecycle, `/.well-known/agent-card.json` rewrite. Productionizing = "Legate" (backlog). See Conflicts #1.
  - Sources: AGENT_UPGRADE_PLAN.md (T17), research 2026-06-22 (P2 card 6)

### Compliance & Disclosure
- [x] **Aletheia — provenance & AI-disclosure engine** — `disclosure_ledger`; `applyDisclosure` (text within `maxBodyLength` + platform AI-label flag for IG/FB/TikTok/YouTube); ledger written at schedule/publish via Atlas; `brand_profiles.disclosurePolicy`; settings controls + read-only `/compliance` ledger. *(= "Lex #20" productized.)*
  - Evidence: [db/schema/disclosure-ledger.ts:19](db/schema/disclosure-ledger.ts), [lib/compliance/disclosure.ts:42](lib/compliance/disclosure.ts), [lib/agents/atlas/index.ts:170](lib/agents/atlas/index.ts), [app/(dashboard)/compliance/page.tsx:9](app/(dashboard)/compliance/page.tsx), [app/(dashboard)/settings/disclosure-policy-form.tsx](app/(dashboard)/settings/disclosure-policy-form.tsx)
  - Missing (deferred, by design): C2PA Content Credentials / SynthID **cryptographic** signing + watermark; jurisdiction rule packs; "detect & auto-label" on imported media; regulator PDF export. See Conflicts #2.
  - Sources: AGENT_FEATURE_IDEAS_V2.md (#1), BUILD_PLAN_TOP3.md (PR2), research 2026-06-23 (P0), AGENT_FEATURE_IDEAS.md (#20 Lex)
- [x] **Praxis — platform policy/ToS linter** — curated per-platform rule packs (absolute/health/financial claims, engagement-bait, outbound-link) → warn/block; runs in Castor; violations shown in review queue.
  - Evidence: [lib/compliance/policy-linter.ts:31](lib/compliance/policy-linter.ts), [lib/agents/castor/index.ts:101](lib/agents/castor/index.ts), [app/(dashboard)/review/review-queue.tsx:124](app/(dashboard)/review/review-queue.tsx)
  - Missing (stretch): LLM-classifier layer + editable per-org rule packs + jurisdiction packs.
  - Sources: AGENT_FEATURE_IDEAS_V2.md (#2), research 2026-06-23

### Approval & Composer UX
- [x] **Triage — Agent Inbox (Accept/Edit/Respond/Ignore)** — true per-item actions + repo ops; `reviewerNote`; Respond triggers single-item Lyra refine; per-item run resume gated by a pure resolution helper (`stay`/`resume`/`reject`).
  - Evidence: [app/(dashboard)/review/review-queue.tsx:49](app/(dashboard)/review/review-queue.tsx), [app/(dashboard)/review/actions.ts:78](app/(dashboard)/review/actions.ts), [lib/reviews/resolve.ts:14](lib/reviews/resolve.ts), [lib/agent/refine-draft.ts:16](lib/agent/refine-draft.ts)
  - Sources: AGENT_FEATURE_IDEAS_V2.md (#3), BUILD_PLAN_TOP3.md (PR1), research 2026-06-23 (P1)
  - Notes (v2 re-verify): added `lib/reviews/resolve.ts` (+ test) — the run-completion gate (`heldCount>0 → stay`, else `accepted>0 → resume` else `reject`) — which v1 did not cite.
- [x] **TrueView — generative per-platform preview** — static native previews (char counts, fold/thread-split warnings) from capabilities; used in composer + review queue.
  - Evidence: [components/composer/platform-preview.tsx:31](components/composer/platform-preview.tsx), [lib/platforms/preview.ts:51](lib/platforms/preview.ts)
  - Missing (stretch): streamed/generative previews, carousel/thread builders, A/B preview.
  - Sources: AGENT_FEATURE_IDEAS_V2.md (#4), research 2026-06-23 (P1)

### Run Observability
- [x] **Lumen — glass-box run inspector** — `/runs/[runId]` step timeline (latency, summary, handoff), hash-chain integrity badge via `verifyChain`, LangSmith deep-link.
  - Evidence: [app/(dashboard)/runs/[runId]/page.tsx:24](app/(dashboard)/runs/[runId]/page.tsx), [lib/runs/timeline.ts:68](lib/runs/timeline.ts), [components/runs/step-list.tsx:38](components/runs/step-list.tsx)
  - Missing (stretch): live-streamed reasoning, cost/latency charts, re-run-from-step, share link.
  - Sources: AGENT_FEATURE_IDEAS_V2.md (#5), research 2026-06-23

### Team Roles & Workspaces
- [x] **Praetor — roles & approver-gated review** — `memberships` + `workspace_role` enum; `roles.ts` hierarchy (owner/admin/approver/creator/viewer) + `canApprove`/`canManageTeam`/`canCreate`; `requireRole("approver")` gates review actions; `/team` page + role assignment.
  - Evidence: [db/schema/memberships.ts:12](db/schema/memberships.ts), [lib/auth/roles.ts:5](lib/auth/roles.ts), [lib/auth/current-role.ts:12](lib/auth/current-role.ts), [app/(dashboard)/team/page.tsx:10](app/(dashboard)/team/page.tsx)
  - Missing (stretch): approval routing, approve-by SLA auto-decisions, per-brand approver matrices, full audit export.
  - Sources: AGENT_FEATURE_IDEAS_V2.md (#9), BUILD_PLAN_TOP3.md (PR3), research 2026-06-22 (P1)
- [ ] **Atrium — multi-brand workspaces** — `brands` table + nullable `brandId` backfilled across posts/accounts/runs/content/reports/profiles + brand switcher. **Explicitly deferred** in BUILD_PLAN_TOP3 as a large, live-DB-risky migration.
  - Evidence (negative, re-confirmed): no `db/schema/brands.ts`; zero `brandId` columns or brand-switcher component in the tree; `clerkOrgId` stored but no brand scoping.
  - Sources: AGENT_FEATURE_IDEAS_V2.md (#8), BUILD_PLAN_TOP3.md (PR3 — "Atrium deferred")

### Remediation & Hardening (FIX_PLAN.md + multi-axis review)
All 10 FIX_PLAN goals and the multi-axis review batches are implemented and on `main` (per IMPLEMENTATION_NOTES.md + fresh scan). Consolidated:
- [x] **Webhooks public + token-guarded health** (H1/M5) — Evidence: [proxy.ts:12](proxy.ts), [app/api/health/queues/route.ts:41](app/api/health/queues/route.ts). Sources: FIX_PLAN.md G1.
- [x] **Quota integrity / refund** (M1/L1/F-C1) — see Phase 6. Sources: FIX_PLAN.md G2, REVIEW_FIX_PLAN.md F-C1.
- [x] **Schedule future-time validation** (M8) — `assertFutureDate`/`isFutureDate`/`SCHEDULE_GRACE_MS`; server + client guards. Evidence: [lib/utils/schedule.ts:12](lib/utils/schedule.ts). Sources: FIX_PLAN.md G3.
- [x] **Reply rate-limit race / atomic slots** (M2) — see Phase 7. Sources: FIX_PLAN.md G4, REVIEW_FIX_PLAN.md F-C2.
- [x] **Worker pooled DB driver** (M3) — see Phase 0. Sources: FIX_PLAN.md G5.
- [x] **Backend test coverage + glob discovery** (M4) — glob `test` script (`tsx --test "lib/**/*.test.ts"`); `tests/integration/quota-concurrency.test.ts` (skips without DB). **Fresh run 2026-06-24: 62 suites / 248 tests, all pass; `tsc --noEmit` clean.** Evidence: [package.json](package.json), [tests/integration/quota-concurrency.test.ts](tests/integration/quota-concurrency.test.ts). Sources: FIX_PLAN.md G6, REVIEW_FIXES.md G3, REVIEW_FIX_PLAN.md F-C6.
- [x] **SEO/typography + a11y + calendar mobile + cleanup nits** (H2/H3/H4/M6/M7/M9/M10/L2–L11) — see Phases 1/10 + Calendar. Sources: FIX_PLAN.md G7–G10.
- [x] **Multi-axis review (PR-A…PR-H)** — A2A hardening (timing-safe, tenant-bound), Meta Graph pagination, comment-poll N+1 + index, media-URL SSRF guard, `ENCRYPTION_KEY` unconditional validation + HKDF PKCE key separation, publish account-status fail-fast, perf indexes, bounded list reads, stack-based ReDoS guard, single-query post load.
  - Evidence: [lib/platforms/_meta-graph.ts](lib/platforms/_meta-graph.ts), [lib/imagekit/url.ts:7](lib/imagekit/url.ts), [lib/auto-reply/regex-guard.ts](lib/auto-reply/regex-guard.ts), [lib/repos/posts.ts](lib/repos/posts.ts)
  - Sources: REVIEW_FIX_PLAN.md (PR-A…PR-H), REVIEW_FIXES.md (Goals 4–6)

---

## Backlog — Unbuilt / partial feature ideas (ideation menus, never committed)

From the two **ideation menus** (explicitly "not a commitment"): AGENT_FEATURE_IDEAS.md (original 20) and AGENT_FEATURE_IDEAS_V2.md (24 new). Items that map to shipped work are noted in the Dedup log; the rest are genuine backlog. Kept for traceability — none are obsolete.

### Partial (a built seam covers part of the idea)
| Idea | What exists | What's missing | Source |
|---|---|---|---|
| [~] **Mnemosyne** (versioned Voice Card) | `brand_profiles.voice` + `learnedMemory` | versioned card, diff timeline UI, pgvector exemplars | IDEAS #1 |
| [~] **Sirius+** (comment triage/lead escalation) | auto-reply agent + rules + `comment_events` ingestion | category/sentiment/urgency columns on `comment_events`, escalation inbox | IDEAS #5 |
| [~] **Orion-Strategist** (calendar planner) | Orion drives `agent_runs.plan` | dated planned-runs, PlanBoard UI, `plannedFor` | IDEAS #11 |
| [~] **Rigel-Brief** (insights narrator) | Rigel report + feed-forward | `reports.data` narrative + one-click `proposedRuns` | IDEAS #18 |
| [~] **Vigil / Vetus** (quality regression dashboard) | brand-safety evals + critique node | `eval_runs` table + `/quality` dashboard + golden-set tracking | IDEAS #16, V2 #6 |

### Not started
| Idea | Area | Source |
|---|---|---|
| [ ] **Echo** — pre-flight audience simulation | quality gate | IDEAS #2 |
| [ ] **Chronos** — self-optimizing send-times | scheduling | IDEAS #3 |
| [ ] **Prism** — source→campaign repurposer | repurposing | IDEAS #4 |
| [ ] **Pulse** — trend-jacking watcher | proactive | IDEAS #8 |
| [ ] **Bandit** — variant A/B bandit | experimentation | IDEAS #9 |
| [ ] **Spica** — competitor watch | intel | IDEAS #10 |
| [ ] **Pictor** — on-brand visual gen agent | multimodal | IDEAS #12 |
| [ ] **Index** — SEO/hashtag optimizer | discoverability | IDEAS #13 |
| [ ] **Lyra-Dialogue** — threaded multi-turn reply | engagement | IDEAS #14 |
| [ ] **Quaestor / Tally** — run cost & token governor + spend caps | FinOps | IDEAS #15, V2 #7 |
| [ ] **Medic** — self-healing publisher | reliability | IDEAS #17 |
| [ ] **Concord** — cross-platform consistency auditor | audit | IDEAS #19 |
| [ ] **Forum** — collaborative draft review threads | team | V2 #10 |
| [ ] **Envoy** — white-label client approval portal | agency | V2 #11 |
| [ ] **Relay** — outbound webhooks / event bus | automation | V2 #12 |
| [ ] **Conduit** — public REST API + keys + n8n/Zapier | automation | V2 #13 |
| [ ] **Gateway** — SocialFlow as an MCP *server* (outward) | interop | V2 #14 |
| [ ] **Legate** — multi-tenant inbound A2A (productionize `/api/a2a`) | interop | V2 #15 |
| [ ] **Cartographer** — per-platform algorithm coach | publishing intel | V2 #16 |
| [ ] **Protean** — format transformer (native artifacts) | repurposing | V2 #17 |
| [ ] **Phoenix** — evergreen recycler/atomizer | repurposing | V2 #18 |
| [ ] **Meridian** — campaigns as first-class objects | planning | V2 #19 |
| [ ] **Senate** — multi-agent strategy debate panel | strategy | V2 #20 |
| [ ] **Codex** — campaign template library | planning | V2 #21 |
| [ ] **Hermes** — DM & inbox agent | engagement | V2 #22 |
| [ ] **Bastion** — crisis & brand-risk radar | safety | V2 #23 |
| [ ] **Compass** — attribution & ROI tracker (UTM + conversions) | analytics | V2 #24 |

---

## Re-verification notes (what changed vs v1)
Per the "re-verify, don't trust" rule, every v1 status was re-derived from current code. Deltas found:
1. **Onboarding (Phase 10.3)** — v1: "wizard not found." **Corrected:** a first-run onboarding *checklist* exists on the dashboard ([app/(dashboard)/dashboard/page.tsx:44](app/(dashboard)/dashboard/page.tsx)). Still `[~]` (no guided wizard), but the affordance is real.
2. **Token-refresh reconnect CTA (Phase 9.3)** — v1: "no dedicated reconnect CTA." **Corrected:** the dashboard renders a `{status} · reconnect` action for unhealthy accounts ([app/(dashboard)/dashboard/page.tsx:154](app/(dashboard)/dashboard/page.tsx)). Item stays `[x]`.
3. **Comment ingestion (Phase 7)** — added direct evidence v1 omitted: the `comment_events` table ([db/schema/comment-events.ts:22](db/schema/comment-events.ts)) and extracted `lib/webhooks/{comments,meta}.ts` verifiers. Confirms Sirius+ enrichment is genuine backlog (table has no sentiment/category columns).
4. **Triage** — added `lib/reviews/resolve.ts` (+ test), the run-completion resolution gate v1 did not cite.
5. **Code-verified backbone** — upgraded the evidence from v1's "~45 test files" to a **fresh passing run: 62 suites / 248 tests, 0 failures, `tsc --noEmit` clean (2026-06-24)**.
6. **Negatives re-confirmed:** Atrium (no `brands` table / `brandId`), the per-target metrics-fetch worker, and the A2A multi-tenant productionization all remain unbuilt.
7. **Item count is re-derived (69 committed)**, not copied from v1's "71" — the difference is section→item granularity in the Remediation block (which cross-references earlier phases); **no work item was dropped.**

## Conflicts & decisions needed
1. **A2A productionization (open).** The shipped A2A is a single-tenant, default-disabled scaffold (`A2A_TENANT_ID`/body `clerkUserId`; no SSE; agent-card at `/api/a2a` not `/.well-known/...`). Productionizing = the "Legate" backlog item (multi-tenant credential→tenant mapping). **Recommend:** keep disabled until there's a named enterprise partner; both research docs rate inbound A2A marketplace as "hold pre-PMF." Decide before exposing externally.
2. **C2PA cryptographic signing (deferred).** Aletheia MVP ships text disclosure + per-platform AI-label flag + ledger; cryptographic C2PA/SynthID signing was deferred to keep the PR dep-light. **Recommend:** ship the MVP for the 2026-08-02 EU Art.50 deadline (text marking satisfies the text-content requirement); schedule C2PA image signing as a fast follow if EU/regulated customers need verifiable image credentials.
3. **`generated_content` vs `content_reviews` table (resolved, shipped).** AGENT_UPGRADE_PLAN T5 specified a separate `content_reviews` ledger; implementation consolidated review state onto `generated_content` (one source of truth; `agent_steps` provides audit history). The most-recent decision (IMPLEMENTATION_NOTES) governs — **no action**, noted for traceability.
4. **Generate streaming vs JSON (resolved by recency).** ROADMAP/PLAN (Goal 4) described streaming `/api/generate`; FIX_PLAN Goal 7 (later) corrected the docs to "returns JSON" and the code returns JSON. **Decision:** JSON is canonical; "streamed generative UI" lives in the TrueView/AG-UI backlog. **Recommend** updating ROADMAP Goal 4's wording to match (minor doc debt).
5. **PR/merge cadence conflict across docs (process, not code).** ROADMAP says "merge every goal"; ORCHESTRATION_GOALS says "batch every 3 goals"; REVIEW_FIXES says "merge only at the very end." Git history shows per-feature PRs merged to `main`. **Recommend** the global CLAUDE.md / BUILD_PLAN_TOP3 cadence (one non-draft PR per feature, drive to green, then merge) as the standing rule.

## Items marked [~]/[ ] that need human review
- [~] **Engagement analytics pull-back** (Goal 10.2) — Rigel aggregates + an operational dashboard exist, but a scheduled per-target metrics fetch into `post_targets.metrics` was not found. Verify/build once a platform is live.
- [~] **Onboarding** (Goal 10.3) — checklist present; decide whether a dedicated guided wizard is in scope for launch.
- [~] **A2A outward** (T17) — default-disabled single-tenant scaffold; see Conflict #1 before any external exposure.
- [ ] **Atrium — multi-brand workspaces** — deliberately deferred; large live-DB migration. Decide if/when to schedule.
- [?] **Whole project — live runtime** — code-verified only (tests + typecheck green today); nothing has run against real DB/Redis/LLM/social APIs. Migrations (0014–0024 especially) and the generate→gate→publish loop need a real environment to confirm. **This is the dominant residual risk, not any single feature.**

## Deduplication log
- **Brand-safety gate** — merged **Aegis** (IDEAS #6) + **Sentry** (IDEAS #7) + **Castor** (AGENT_UPGRADE T3/T6) + research-2026-06-22 P0 card 9 into one canonical "Castor brand-safety gate." Castor is the shipped name.
- **Compliance/disclosure** — merged **Lex** (IDEAS #20) into **Aletheia** (V2 #1 / BUILD_PLAN PR2); Aletheia is the shipped productization.
- **Per-brand memory/voice** — merged **Mnemosyne** (IDEAS #1) core into `brand_profiles` voice + `learnedMemory` (AGENT_UPGRADE T4/T10/T11 + research P1 card 3). Kept the *versioned Voice Card UI* as a distinct Partial backlog sub-item.
- **Evals** — split: **offline metrics + calibration** (AGENT_UPGRADE T9) = Done; the **productized quality dashboard** (Vetus IDEAS #16 + Vigil V2 #6) = Partial backlog.
- **Cost governor** — merged **Quaestor** (IDEAS #15) + **Tally** (V2 #7) into one Not-started backlog item.
- **Supervisor + parallel fan-out** — merged research-2026-06-22 P2 card 1 with AGENT_UPGRADE T14 (supervisor) + T15 (best-of-N); shipped as two code items, one theme.
- **MCP inward / A2A outward / least-privilege / audit** — research-2026-06-22 cards 2/5/6/11 map 1:1 onto AGENT_UPGRADE T12/T13/T16/T17; merged, evidence from code.
- **Triage** (V2 #3) explicitly *extends* Sentry (IDEAS #7) → folded the per-item-inbox scope under Triage (Done) and the gate under Castor.
- **Multi-axis review** — REVIEW_FIX_PLAN.md and REVIEW_FIXES.md describe overlapping batches of the same 2026-06-22 review; merged their findings into the single "Remediation & Hardening" section (kept both as sources).
- **Calendar reschedule** appears in both ROADMAP Goal 10.1 and FIX_PLAN Goal 9 — merged into one Calendar item.
- **Research trend docs** — the two `research/*.md` files are gap matrices, not task lists; their actionable items were already captured by AGENT_UPGRADE_PLAN (06-22) and AGENT_FEATURE_IDEAS_V2 (06-23). Listed as sources, not duplicated as items, and **left in place** (reference research, not archived).
- **v1 → v2** — the entire v1 plan is one source for v2; every v1 item is carried forward with status re-derived (see Re-verification notes). v1 stays in `docs/` as history.

## Source documents
| Doc | Last updated | Status |
|-----|-------------|--------|
| docs/MASTER_PLAN.md (v1) | 2026-06-24 | **superseded by this plan (v2)**; retained in `docs/` as history |
| docs/PLAN.md | 2026-06-20 | superseded → archived `docs/archive/` |
| docs/ROADMAP.md | 2026-06-19 | superseded → archived `docs/archive/` |
| docs/IMPLEMENTATION_NOTES.md | 2026-06-20 | merged (fix-plan execution log / evidence) → archived |
| docs/FIX_PLAN.md | 2026-06-20 | superseded → archived |
| docs/ORCHESTRATION.md | 2026-06-21 | superseded → archived |
| docs/ORCHESTRATION_GOALS.md | 2026-06-21 | superseded → archived |
| docs/REVIEW_FIXES.md | 2026-06-22 | superseded → archived |
| docs/REVIEW_FIX_PLAN.md | 2026-06-22 | superseded → archived |
| docs/AGENT_UPGRADE_PLAN.md | 2026-06-22 | superseded → archived |
| docs/AGENT_UPGRADE_IMPLEMENTATION_NOTES.md | 2026-06-22 | merged (T1–T17 evidence) → archived |
| docs/AGENT_FEATURE_IDEAS.md | 2026-06-22 | merged (ideation backlog — original 20) → archived |
| docs/AGENT_FEATURE_IDEAS_V2.md | 2026-06-23 | merged (ideation backlog — 24 new) → archived |
| docs/BUILD_PLAN_TOP3.md | 2026-06-23 | superseded (Triage/Aletheia/Praetor shipped; Atrium deferred) → archived |
| docs/research/ai-agent-trends-2026-06-22.md | 2026-06-22 | merged (gap matrix → AGENT_UPGRADE_PLAN); **kept in place** (reference research) |
| docs/research/ai-agent-trends-2026-06-22-refresh.md | 2026-06-23 | merged (gap matrix → AGENT_FEATURE_IDEAS_V2); **kept in place** (reference research) |

## Changelog
- **2026-06-24 (run #2)** — Re-verified against the current codebase. No new or changed source plans (the 13 originals now live in `docs/archive/`, skipped per Step 1) and no code changes since run #1 (`git status` shows only the doc moves; HEAD unchanged at `b295f91`), so the work-item set and **every status are unchanged** — 65 Done · 3 Partial · 1 Not started. No new version written (no material change); added this Changelog + the _Last updated_ line to adopt the in-place-update workflow.
- **2026-06-24 (run #1)** — Created. Consolidated 16 source docs (15 originals + v1) into v2; re-derived all statuses from a fresh scan (248/248 unit tests green, `tsc --noEmit` clean). 69 committed items: 65 Done · 3 Partial (engagement metrics-fetch, onboarding wizard, A2A outward) · 1 Not started (Atrium). Archived the 13 consolidated source plans to `docs/archive/`.
