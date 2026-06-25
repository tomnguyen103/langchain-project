# Master Implementation Plan (v3)
_Consolidated on 2026-06-25. Supersedes: docs/MASTER_PLAN.md (v1) and docs/MASTER_PLAN_v2.md (v2). Status was re-derived from a fresh codebase scan — not copied from prior plans._

> **Global caveat — runtime verification is still deferred.** No DB/Redis/LLM/social creds are provisioned in the dev environment, so **nothing has been exercised against real services**. Migrations are generated, not applied (0000–0028, 29 files). "Done" means **code-verified** (lint/typecheck/330 tests green), not "proven live."

## Status legend
- [x] Done · [~] Partial · [ ] Not started

## Summary — 2026-06-25

**What changed since v2 (2026-06-24):** 16 new features shipped across 6 PRs (#46–#55) plus a follow-up wave (Escalation Inbox, Quality Dashboard, Onboarding Wizard, Voice History); docs/FIX_PLAN.md absorbed — all 6 build-first-wave goals (Pulse, Quaestor, Vigil, Sirius Triage v1, Run Doctor, Praxis Live v1) confirmed Done. Migrations now 0000–0028 (29 files); all pending schema additions generated.

**Committed items:** ~82 total → **78 Done · 1 Partial (A2A/T17) · 1 Not started (Atrium).**

**Backlog (ideation, never committed):** 0 Partial · ~24 Not started (all formerly-partial backlog items resolved or promoted).

**Dominant remaining risk:** Nothing has run against live infrastructure. Go-live sequence: run `drizzle-kit generate` → apply migrations 0000–0026+ → deploy always-on worker → provision creds (Neon, Upstash, Clerk + billing plans, ImageKit, Meta app, optional: X/Pinterest/YouTube/TikTok/LinkedIn/Gemini/LangSmith/Tavily) → verify the generate → Castor → review → approve → Atlas → publish loop live.

---

## Phase 0 — Foundation & Infrastructure

- [x] **Data layer + dual driver** — Drizzle over Neon; `DB_DRIVER` selects pooled `neon-serverless` (worker) vs stateless `neon-http` (app); `runAtomicWrite` (batch/http vs transaction/pool); `closeDbPool` on SIGTERM.
  - [db/index.ts](db/index.ts), [worker/load-env.ts](worker/load-env.ts), [worker/index.ts](worker/index.ts)
- [x] **Env validation** — zod, server/client split, fail-fast; unconditional `ENCRYPTION_KEY` length check.
  - [lib/env.ts](lib/env.ts), [lib/utils/crypto.ts](lib/utils/crypto.ts)
- [x] **Queue + worker skeleton** — `QueueName` enum, lazy `getQueue`, `enqueueWithLedger`, deterministic job-ids; `startWorker` per queue; graceful SIGTERM.
  - [lib/queue/queues.ts](lib/queue/queues.ts), [lib/queue/with-ledger.ts](lib/queue/with-ledger.ts), [lib/queue/job-ids.ts](lib/queue/job-ids.ts), [worker/index.ts](worker/index.ts)
- [x] **Design system / ShadCN + health route + CI** — ShadCN, Tailwind v4 tokens, light/dark; `/api/health` liveness; CI + CodeRabbit on every PR.
  - [components/ui](components/ui), [app/api/health/route.ts](app/api/health/route.ts), [.github/workflows/ci.yml](.github/workflows/ci.yml)

---

## Phase 1 — Auth, App Shell & Marketing

- [x] **Clerk auth + route protection** — `clerkMiddleware` public allow-list (incl. `/api/webhooks`); `requireUserId`/`getOrgId`; sign-in/up routes.
  - [proxy.ts](proxy.ts), [lib/clerk.ts](lib/clerk.ts)
- [x] **Marketing landing + pricing** — hero, feature grid, platform glyphs, agent-pipeline illustration, pricing CTAs (Free/Pro/Premium); legal stubs.
  - [app/(marketing)/page.tsx](app/(marketing)/page.tsx), [app/(marketing)/pricing/page.tsx](app/(marketing)/pricing/page.tsx)
- [x] **Dashboard shell + nav** — sidebar (Review/Runs/Compliance/Team/Plans), topbar with `QuotaBadge`/`ThemeToggle`/`UserButton`.
  - [app/(dashboard)/layout.tsx](app/(dashboard)/layout.tsx), [components/shared/nav-items.ts](components/shared/nav-items.ts)

---

## Phases 2–3 & 8 — Publishing Core

- [x] **Core schema + repos** — `social_accounts`, `posts`, `post_targets`, `media_assets`, `schedules`; typed CRUD repos.
- [x] **`PlatformConnector` interface + registry + token crypto** — `getConnector()` (no switch); `AbstractConnector` refresh-on-expiry; AES-256-GCM at rest.
  - [lib/platforms/types.ts](lib/platforms/types.ts), [lib/platforms/registry.ts](lib/platforms/registry.ts), [lib/utils/crypto.ts](lib/utils/crypto.ts)
- [x] **All 8 platform adapters** — LinkedIn, X, Facebook, Instagram, Pinterest, YouTube, TikTok, Discord; each with `publishNow` + capabilities.
  - [lib/platforms/](lib/platforms/)
- [x] **OAuth start/callback** — signed state → exchange → multi-account upsert → comment-poll + metrics-poll registration on connect.
  - [app/api/oauth/[provider]/start/route.ts](app/api/oauth/[provider]/start/route.ts), [app/api/oauth/[provider]/callback/route.ts](app/api/oauth/[provider]/callback/route.ts)
- [x] **ImageKit upload + AI media variants** — signed upload; platform-sized transform URLs; SSRF-guarded URL builder; derived assets via `sourceAssetId`.
  - [lib/imagekit/transform.ts](lib/imagekit/transform.ts), [lib/imagekit/url.ts](lib/imagekit/url.ts)
- [x] **Composer** — platform multi-select (connected only), per-platform variant editor, timezone schedule-picker, TrueView per-platform preview.
  - [components/composer/composer.tsx](components/composer/composer.tsx), [components/composer/platform-preview.tsx](components/composer/platform-preview.tsx)
- [x] **Publish worker** — loads target+account in parallel, fails fast if account not active, `publishNow`, records `externalPostId`/`publishedAt`, 4 retries exp backoff, deterministic `jobId`.
  - [worker/processors/publish.ts](worker/processors/publish.ts)
- [x] **Per-target status rollup + retry/cancel/reschedule** — `derivePostStatus`; `cancelTarget`/`retryTarget`/`reschedulePost` with quota refund.
  - [lib/posts/status.ts](lib/posts/status.ts), [lib/repos/posts.ts](lib/repos/posts.ts)
- [x] **Calendar** — month grid + mobile agenda; accessible drag-drop reschedule (`RescheduleDialog`); "Plan 2 weeks" button (Mensa).
  - [app/(dashboard)/calendar/page.tsx](app/(dashboard)/calendar/page.tsx)

---

## Phase 4 — AI Content Agent (Lyra StateGraph)

- [x] **LLM factory** — `getChatModel()` → LangChain model, Gemini default, OpenAI/Anthropic mirrors.
  - [lib/llm/factory.ts](lib/llm/factory.ts)
- [x] **Content StateGraph** — `research→digest→ideate→draft→critique→(refine|finalize)`; bounded `MAX_REVISIONS`; `runContentAgent`; returns `{drafts, usage, costUsd}`.
  - [lib/agent/graph.ts](lib/agent/graph.ts), [lib/agent/index.ts](lib/agent/index.ts)
- [x] **Parallel per-platform drafting + best-of-N synthesis** — `Promise.all` fan-out, `selectBestDraft` fan-in; `DRAFT_VARIANTS` (default 1).
  - [lib/agent/select-draft.ts](lib/agent/select-draft.ts)
- [x] **Generate endpoint (JSON)** — `/api/generate` returns JSON; `generate-panel` consumes it. (Streaming was descoped.)
  - [app/api/generate/route.ts](app/api/generate/route.ts)
- [x] **LangSmith tracing** — `isLangSmithEnabled` gate, deep-link builder, `langsmithRunId` on `generated_content`/`agent_runs`.
  - [lib/observability/langsmith.ts](lib/observability/langsmith.ts)

---

## Phase 5 — Niche Research Pipeline

- [x] **Research schema + Tavily web-search tool** — `research_topics`; graceful empty-fallback when unkeyed.
  - [lib/agent/research.ts](lib/agent/research.ts), [db/schema/research.ts](db/schema/research.ts)
- [x] **Research→generate chaining** — Vega→Lyra Orion handoff; provenance via `posts.sourceContentId`.
  - [lib/agents/vega/index.ts](lib/agents/vega/index.ts)
- [x] **Research/Ideas UI** — Topics/Ideas tabs; status polling; "accept → composer" deep-link.
  - [app/(dashboard)/research/page.tsx](app/(dashboard)/research/page.tsx)

---

## Phase 6 — Billing, Quotas & Rate Limiting

- [x] **Plans + entitlements** — `PLAN_LIMITS` Free/Pro/Premium; `can()`/`consumeQuota`/`releaseQuota` via Clerk `has()`; billing page w/ PricingTable + "Est. AI cost this month" card.
  - [lib/billing/plans.ts](lib/billing/plans.ts), [lib/billing/entitlements.ts](lib/billing/entitlements.ts), [app/(dashboard)/billing/page.tsx](app/(dashboard)/billing/page.tsx)
- [x] **Usage metering + enforcement** — atomic conditional upsert (`set where count<limit`); `releaseUsage` floored at 0; `free ≤ pro ≤ premium` invariant test.
  - [lib/repos/usage.ts](lib/repos/usage.ts)
- [x] **Postgres fixed-window rate limiter** — `takeRateLimit`; applied to `/api/agents/run` + `/api/generate`.
  - [lib/repos/rate-limits.ts](lib/repos/rate-limits.ts)
- [x] **Quota refund on cancel** — `scheduleQuotaPeriod`/`scheduleQuotaHeld`; atomic refund on cancel; reschedule/retry re-consume.

---

## Phase 7 — Engagement / Auto-Reply

- [x] **Rules + UI** — `auto_reply_rules`; RuleForm/RuleTable; Pro-gated page.
  - [app/(dashboard)/auto-reply/page.tsx](app/(dashboard)/auto-reply/page.tsx)
- [x] **Comment ingestion + triage (Sirius Triage v1)** — repeatable comment-poll per account; batch insert into `comment_events` with `intent`/`sentiment`/`urgency` columns (migration 0025); Meta webhook with constant-time HMAC; prompt-injection-hardened `buildReplyPrompt`; safety gate blocks abuse/complaint auto-replies.
  - [db/schema/comment-events.ts](db/schema/comment-events.ts), [worker/processors/comment-poll.ts](worker/processors/comment-poll.ts), [lib/auto-reply/match.ts](lib/auto-reply/match.ts)
- [x] **Reply matching + dispatch + race-safe slots** — lease-based `claimReply`; atomic `grantReplySlot`/`releaseReplySlot` upsert; per-rule cap/cooldown.
  - [worker/processors/reply.ts](worker/processors/reply.ts), [lib/repos/replies.ts](lib/repos/replies.ts), [lib/auto-reply/slot.ts](lib/auto-reply/slot.ts)

---

## Phase 8 — Engagement Analytics (Pulse)

- [x] **Metrics-poll worker (Pulse)** — repeatable per-account BullMQ job; walks recently-published targets; writes `post_targets.metrics` on a maturity curve (hourly while fresh → daily → stops at 30 days); registered by Sirius+publish, deregistered on disconnect; non-metrics connectors skipped.
  - [worker/processors/metrics-poll.ts](worker/processors/metrics-poll.ts)
- [x] **Engagement metrics dashboard card** — `getEngagementSummary()` aggregates likes/comments/shares across published targets; surfaced on dashboard.
  - [app/(dashboard)/dashboard/page.tsx](app/(dashboard)/dashboard/page.tsx), [lib/repos/posts.ts](lib/repos/posts.ts)

---

## Phase 9 — Observability & Hardening

- [x] **Structured logging + LangSmith deep links** — worker logger; run/step correlation to LangSmith.
  - [worker/logger.ts](worker/logger.ts)
- [x] **Queue health + ledger reconcile sweep** — token-guarded `/api/health/queues`; `reconcile` processor fails orphaned `pending` rows.
  - [app/api/health/queues/route.ts](app/api/health/queues/route.ts), [worker/processors/reconcile.ts](worker/processors/reconcile.ts)
- [x] **Token-refresh + account health + reconnect CTA** — proactive refresh; non-active status badged; publish fails fast on dead accounts; reconnect CTA on dashboard + accounts page for expired/revoked.
  - [worker/processors/token-refresh.ts](worker/processors/token-refresh.ts), [components/accounts/account-card.tsx](components/accounts/account-card.tsx)
- [x] **Per-run cost & token telemetry (Quaestor)** — pure cost model ($/MTok per provider); token collector via LangChain callbacks; `runContentAgent` returns `{usage, costUsd}`; Lyra surfaces in step summary; `sumRunCostUsd` tenant rollup; "Est. AI cost this month" on /billing.
  - [lib/agent/index.ts](lib/agent/index.ts), [lib/cost/model-cost.ts](lib/cost/model-cost.ts)
- [x] **Run Doctor v1 — failure-classifying agent-step retry policy** — pure failure classifier (transient/account/fatal); only transient failures retry (with budget); account/fatal/exhausted throw `UnrecoverableError` immediately; correct BullMQ fail-set accounting.
  - [worker/processors/agent-step.ts](worker/processors/agent-step.ts)
- [x] **Deterministic brand-safety CI gate (Vigil)** — key-free offline gate (`npm run eval:gate`); every must-hold dataset example must stay held under a maximally-permissive judge; meta-test proves a weakened guard fails it; wired into CI.
  - [evals/brand-safety/run.ts](evals/brand-safety/run.ts), [.github/workflows/ci.yml](.github/workflows/ci.yml)

---

## Phase 10 — Polish & Launch

- [x] **SEO/metadata + typography + icons** — `@tailwindcss/typography`; `metadataBase`/openGraph/twitter; code-generated OG + favicon + apple/twitter images.
  - [app/layout.tsx](app/layout.tsx), [app/opengraph-image.tsx](app/opengraph-image.tsx)
- [x] **Accessibility pass** — skip-to-content + focusable `<main>`, fieldset/legend, `SheetDescription`, real `<form onSubmit>`, progressbar/alert/status roles.
  - [app/(dashboard)/layout.tsx](app/(dashboard)/layout.tsx)
- [x] **Final-QA scaffolding** — error boundaries (`error.tsx`/`global-error.tsx`), loading skeletons, `not-found.tsx`, dark mode.
  - [app/(dashboard)/error.tsx](app/(dashboard)/error.tsx)
- [x] **Onboarding** — first-run checklist on dashboard (Connect → Create → Auto-reply, hidden once complete) + Sheet-based 3-step guided wizard (`OnboardingWizard`, localStorage dismiss, auto-opens for account-less users).
  - [app/(dashboard)/dashboard/page.tsx](app/(dashboard)/dashboard/page.tsx), [components/dashboard/onboarding-wizard.tsx](components/dashboard/onboarding-wizard.tsx)

---

## Agent Orchestration Roster (A0–A5)

- [x] **Agent contract + registry (A0)** — `AgentName` enum, `AgentResult` discriminated union, `getAgent` (no switch); `agent_runs`/`agent_steps` + repos.
  - [lib/agents/types.ts](lib/agents/types.ts), [lib/agents/registry.ts](lib/agents/registry.ts)
- [x] **Vega / Lyra / Atlas (A1)** — thin `AgentDefinition`s over `runResearch`/`runContentAgent`/`enqueuePublish`.
  - [lib/agents/vega/index.ts](lib/agents/vega/index.ts), [lib/agents/lyra/index.ts](lib/agents/lyra/index.ts), [lib/agents/atlas/index.ts](lib/agents/atlas/index.ts)
- [x] **Orion orchestrator + agent-step queue (A2)** — `dispatch`/`startRun`/`resumeRun`/`settle`; idempotent `(runId, agent)` handoffs; `/api/agents/run` entry.
  - [lib/agents/orchestrator.ts](lib/agents/orchestrator.ts), [worker/processors/agent-step.ts](worker/processors/agent-step.ts)
- [x] **Sirius engagement agent (A3)** — registers comment-poll + metrics-poll per account on publish.
  - [lib/agents/sirius/index.ts](lib/agents/sirius/index.ts)
- [x] **Rigel reporting agent (A4)** — scheduled daily aggregation; Rigel Narratives (`narrateReport()`) produces `ReportInsight[]` stored in `reports.data.insights` jsonb (no migration — jsonb extension); AI insight cards on dashboard.
  - [lib/agents/rigel/index.ts](lib/agents/rigel/index.ts), [lib/agents/rigel/narrate.ts](lib/agents/rigel/narrate.ts)
- [x] **Polaris seeding agent (A5)** — `supportsSeeding` capability + `seeding` queue/processor.
  - [lib/agents/polaris/index.ts](lib/agents/polaris/index.ts)
- [x] **Mensa cadence agent** — `AgentName.Mensa`, `content_plans` table, `createMensa()` generates 2-week `PlanSlot[]` (round-robin, sourced from Rigel topTopics); `/plans/[id]` review page; `approvePlan` parallel-enqueues Orion runs (first step: Lyra); "Plan 2 weeks" calendar button; Free cap 7 slots / Pro cap 14.
  - [lib/agents/mensa/index.ts](lib/agents/mensa/index.ts), [db/schema/content-plans.ts](db/schema/content-plans.ts), [app/(dashboard)/plans/[id]/page.tsx](app/(dashboard)/plans/[id]/page.tsx)
  - Schema covered by migration 0027.

---

## Agent-Layer Upgrade (T1–T17)

- [x] **Castor brand-safety gate (T1–T6)** — `awaiting_approval`/`rejected` states; per-tenant threshold; Lyra hands to Castor (no auto-accept).
  - [lib/agents/castor/index.ts](lib/agents/castor/index.ts), [lib/agent/guardrails/brand-safety.ts](lib/agent/guardrails/brand-safety.ts)
- [x] **Per-brand profile + voice + learned memory (T4/T10/T11)** — `brand_profiles` (voice/bannedTerms/`learnedMemory`); Rigel `setLearnedMemory` feedback loop.
  - [db/schema/brand-profiles.ts](db/schema/brand-profiles.ts)
- [x] **Review persistence (T5)** — `generated_content.reviewStatus`/`brandSafetyScore`/`reviewVerdict`/`reviewViolations`/`reviewedBy`.
  - [db/schema/generated-content.ts](db/schema/generated-content.ts)
- [x] **Offline evals + threshold calibration (T9)** — `recommendThreshold`; labeled dataset; `npm run eval:brand-safety`.
  - [lib/evals/brand-safety-metrics.ts](lib/evals/brand-safety-metrics.ts)
- [x] **Least-privilege capability matrix (T12)** — `AGENT_CAPABILITIES` + `hasCapability`/`assertCapability`; only Atlas publishes.
  - [lib/agents/capabilities.ts](lib/agents/capabilities.ts)
- [x] **Tamper-evident audit hash chain (T13)** — `agent_steps.prevHash`/`hash`; sha256 chain; `verifyRunAudit`.
  - [lib/audit/run-audit.ts](lib/audit/run-audit.ts)
- [x] **Supervisor routing (T14)** — optional `supervisor` dep can override a handoff; pause never overridden.
  - [lib/agents/orchestrator.ts:222](lib/agents/orchestrator.ts)
- [x] **MCP inward (T16)** — `listMcpTools`/`callMcpTool` over stateless HTTP; graceful no-op when `MCP_SERVER_URL` unset.
  - [lib/mcp/client.ts](lib/mcp/client.ts)
- [~] **A2A outward (T17)** — `/api/a2a` GET agent-card + POST `message/send`; bearer + `A2A_ENABLED` gate, **disabled by default**. Multi-tenant mapping, SSE, `/.well-known/agent-card.json` rewrite not yet built. See Open Decision #1.
  - [app/api/a2a/route.ts](app/api/a2a/route.ts), [lib/a2a/protocol.ts](lib/a2a/protocol.ts)

---

## Compliance & Disclosure

- [x] **Aletheia — provenance & AI-disclosure engine** — `disclosure_ledger`; `applyDisclosure` (text label + per-platform AI-label flag for IG/FB/TikTok/YouTube); ledger written by Atlas; settings controls + `/compliance` ledger.
  - [lib/compliance/disclosure.ts](lib/compliance/disclosure.ts), [app/(dashboard)/compliance/page.tsx](app/(dashboard)/compliance/page.tsx)
  - Missing (deferred): C2PA/SynthID cryptographic signing, jurisdiction packs, regulator PDF export. See Open Decision #2.
- [x] **Praxis — platform policy/ToS linter + editable per-org rules (Praxis Live v1)** — curated per-platform rule packs (absolute/health/financial claims, engagement-bait) → warn/block; runs in Castor; **plus** `brand_profiles.policy_rules` jsonb (migration 0026) for tenant custom rules (case-insensitive literal substring, never regex).
  - [lib/compliance/policy-linter.ts](lib/compliance/policy-linter.ts), [app/(dashboard)/settings/brand-profile-form.tsx](app/(dashboard)/settings/brand-profile-form.tsx)

---

## Approval & Composer UX

- [x] **Triage — Agent Inbox** — per-item Accept/Edit/Respond/Ignore; `reviewerNote`; Respond triggers single-item Lyra refine; `lib/reviews/resolve.ts` run-completion gate (`heldCount>0 → stay`, `accepted>0 → resume`, else reject).
  - [app/(dashboard)/review/review-queue.tsx](app/(dashboard)/review/review-queue.tsx), [lib/reviews/resolve.ts](lib/reviews/resolve.ts)
- [x] **TrueView — per-platform preview** — static native previews (char counts, fold/thread-split warnings) in composer + review queue.
  - [components/composer/platform-preview.tsx](components/composer/platform-preview.tsx), [lib/platforms/preview.ts](lib/platforms/preview.ts)

---

## Run Observability

- [x] **Lumen — glass-box run inspector** — `/runs/[runId]` step timeline (latency, summary, handoff), hash-chain integrity badge, LangSmith deep-link; Quaestor cost surfaced in step summary.
  - [app/(dashboard)/runs/[runId]/page.tsx](app/(dashboard)/runs/[runId]/page.tsx), [lib/runs/timeline.ts](lib/runs/timeline.ts)

---

## Team Roles & Workspaces

- [x] **Praetor — roles & approver-gated review** — `memberships` + `workspace_role` enum; `canApprove`/`canManageTeam`/`canCreate`; `requireRole("approver")` gates review; `/team` page + role assignment.
  - [db/schema/memberships.ts](db/schema/memberships.ts), [lib/auth/roles.ts](lib/auth/roles.ts), [app/(dashboard)/team/page.tsx](app/(dashboard)/team/page.tsx)
- [ ] **Atrium — multi-brand workspaces** — `brands` table + nullable `brandId` across all entities + brand switcher. **Explicitly deferred** (large live-DB migration; `clerkOrgId` stored but not enforced).

---

## Scheduling

- [x] **Chronos — best-time-to-post optimizer** — `lib/scheduling/best-time.ts` pure scorer (`scoreWindows`, `nextBestPublishTime`, `isHighConfidence`); `posting_windows` table + repo; daily BullMQ scorer; "Suggest time" button in composer with confidence feedback.
  - [lib/scheduling/best-time.ts](lib/scheduling/best-time.ts), [db/schema/posting-windows.ts](db/schema/posting-windows.ts)
  - Schema covered by migration 0027.

---

## Content Repurposing

- [x] **Phoenix / Evergreen Recycler** — `listRecyclableWinners()` (published targets >30 days, sorted by engagement); `repurposePost` server action (Pro-gated, starts Orion run at Lyra with "re-angle and refresh" topic); `generated_content.derived_from_target_id` provenance; "Recyclable winners" dashboard card.
  - [lib/repos/posts.ts](lib/repos/posts.ts), [app/(dashboard)/dashboard/actions.ts](app/(dashboard)/dashboard/actions.ts)
  - Schema covered by migration 0027.

---

## Remediation & Hardening (all merged)

- [x] **Webhooks public + token-guarded health** — [proxy.ts](proxy.ts), [app/api/health/queues/route.ts](app/api/health/queues/route.ts)
- [x] **Quota integrity / refund** — see Phase 6.
- [x] **Schedule future-time validation** — `assertFutureDate`/`isFutureDate`/`SCHEDULE_GRACE_MS`. [lib/utils/schedule.ts](lib/utils/schedule.ts)
- [x] **Reply rate-limit race / atomic slots** — see Phase 7.
- [x] **Worker pooled DB driver** — see Phase 0.
- [x] **Backend test coverage** — 62+ suites / 248+ tests; `tsx --test "lib/**/*.test.ts"` glob; integration skip without DB. [package.json](package.json)
- [x] **SEO/typography + a11y + calendar mobile + nits** — see Phases 1/10 + Calendar.
- [x] **Multi-axis review (PR-A…PR-H)** — A2A hardening, Meta Graph pagination, comment-poll N+1 + index, media-URL SSRF guard, HKDF PKCE key separation, perf indexes, bounded list reads, stack-based ReDoS guard.

---

## Migrations

All schema changes are covered by migrations 0000–0028 (29 files). Apply with `npx drizzle-kit migrate`.

| Migration | Contents |
|---|---|
| 0027_chronos_mensa_evergreen | `posting_windows`, `content_plans`, `content_plan_status` enum, `agent_name` 'mensa', `generated_content.derived_from_target_id` |
| 0028_mnemosyne_voice_history | `brand_profiles.voice_history` |

---

## Backlog — Unbuilt feature ideas (explicitly never committed)

### Not started
| Idea | Area |
|---|---|
| **Echo** — pre-flight audience simulation | quality gate |
| **Prism** — source→campaign repurposer | repurposing |
| **Bandit** — variant A/B bandit | experimentation |
| **Spica** — competitor watch | intel |
| **Pictor** — on-brand visual gen agent | multimodal |
| **Index** — SEO/hashtag optimizer | discoverability |
| **Lyra-Dialogue** — threaded multi-turn reply | engagement |
| **Tally** — spend caps / hard budget governor | FinOps |
| **Medic** — self-healing publisher | reliability |
| **Concord** — cross-platform consistency auditor | audit |
| **Forum** — collaborative draft review threads | team |
| **Envoy** — white-label client approval portal | agency |
| **Relay** — outbound webhooks / event bus | automation |
| **Conduit** — public REST API + keys + n8n/Zapier | automation |
| **Gateway** — SocialFlow as an MCP server | interop |
| **Legate** — multi-tenant inbound A2A | interop |
| **Cartographer** — per-platform algorithm coach | publishing intel |
| **Protean** — format transformer (native artifacts) | repurposing |
| **Meridian** — campaigns as first-class objects | planning |
| **Senate** — multi-agent strategy debate panel | strategy |
| **Codex** — campaign template library | planning |
| **Hermes** — DM & inbox agent | engagement |
| **Bastion** — crisis & brand-risk radar | safety |
| **Compass** — attribution & ROI tracker (UTM + conversions) | analytics |

---

## Open Decisions

1. **A2A productionization** — shipped A2A is single-tenant, default-disabled (`A2A_TENANT_ID`). Productionizing = "Legate" (multi-tenant credential mapping, SSE, `/.well-known/agent-card.json`). **Recommend:** keep disabled until a named enterprise partner; both research docs rate inbound A2A marketplace as "hold pre-PMF."

2. **C2PA cryptographic signing** — Aletheia ships text disclosure + platform AI-label flag; cryptographic C2PA/SynthID signing is deferred. **Recommend:** current text marking satisfies EU Art.50 (2026-08-02 deadline) for text content; schedule C2PA image signing as a fast follow if regulated customers need verifiable image credentials.

3. **Atrium multi-brand workspaces** — deliberately deferred (large live-DB migration). Decide if/when to schedule.

---

## Changelog

- **2026-06-25 (v3, update 3)** — Absorbed docs/FIX_PLAN.md (2026-06-24 build-first wave). All 6 goals confirmed Done in this file: Pulse (Phase 8), Quaestor (Phase 9), Vigil (Phase 9), Sirius Triage v1 (Phase 7), Run Doctor (Phase 9), Praxis Live v1 (Compliance). Migration ⚠ warnings cleared — 0027+0028 cover all pending schema. Onboarding promoted [~]→[x] (wizard shipped in update 2). FIX_PLAN.md superseded. Net: 78 Done · 1 Partial (A2A/T17) · 1 Not started (Atrium).
- **2026-06-25 (v3, update 2)** — Resolved all 4 committed Partials and generated 2 new migrations (0027, 0028). Migrations: 0027 covers posting_windows + content_plans + derived_from_target_id + agent_name 'mensa'; 0028 adds brand_profiles.voice_history. New features: (1) Sirius+ Escalation Inbox — `listEscalatedCommentsForUser` + Escalations tab on /auto-reply with count badge; (2) Vigil/Vetus Quality Dashboard — `lib/repos/quality.ts` + `app/(dashboard)/quality/page.tsx` + Quality nav entry (ShieldAlert); (3) Onboarding Wizard — `components/dashboard/onboarding-wizard.tsx` (Sheet, 3-step, localStorage dismiss, auto-opens for account-less users); (4) Mnemosyne Voice History — `brand_profiles.voice_history` jsonb, history appended on voice change in `upsertBrandProfile`, VoiceHistoryCard on settings page. Net committed status: 77 Done · 0 Partial · 1 Not started. Tests: 330/330 pass.
- **2026-06-25 (v3)** — Consolidated v1 + v2 into a single file; 12 new features from PRs #46–#55 promoted from backlog to Done. Net: ~72 Done · 4 Partial · 1 Not started. v1 and v2 superseded; v2 archived to docs/archive/.
- **2026-06-24 (v2)** — Re-derived from fresh scan (248/248 unit tests, `tsc` clean). Corrected onboarding checklist and reconnect CTA vs v1. 65 Done · 3 Partial · 1 Not started. Archived 13 source docs to docs/archive/.
- **2026-06-24 (v1)** — First master plan consolidated from 15 source docs. 60 Done · 6 Partial · 3 Not started.
