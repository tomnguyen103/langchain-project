# Implementation Plan: AI Social Content Automation SaaS

## Context

**Why this is being built.** Creating and posting niche content across many social platforms by hand is slow and burns people out. The goal is an app where a user connects their social accounts, the system researches a niche, an AI agent digests that research into platform-tailored content (captions, posts, ideas, variations), the user schedules it (up to ~7 posts/day), and the system auto-publishes at the right time on the right platforms — plus auto comment-replies by keyword. The user focuses on strategy; the agent handles execution.

**Intended outcome.** A production-grade, Dribbble-quality SaaS with a marketing landing page, an authenticated dashboard (composer, calendar, accounts, research/ideas, auto-reply, billing), a LangGraph-driven content agent, native multi-platform publishing, and premium billing tiers.

**This is a true greenfield build.** The project began from an empty directory. Per-phase execution is driven by the Goal prompts in [ROADMAP.md](ROADMAP.md).

---

## Locked Architecture Decisions

1. **Native platform APIs** (not a unified aggregator). Each platform is a pluggable `PlatformConnector` adapter handling OAuth + publish + comments.
2. **LangGraph-only orchestration.** The LangChain/LangGraph/LangSmith ecosystem is the centerpiece. **n8n is dropped from the critical path** (may return as an optional later integration). LangGraph owns the AI pipeline; BullMQ owns scheduling.
3. **MVP-first vertical slicing.** Ship a thin end-to-end loop early, then layer features. Every phase leaves the system shippable.
4. **Google Gemini** is the default LLM via `@langchain/google-genai`, behind a provider-agnostic factory so OpenAI/Anthropic swap with one env var.

**Key simplifying insight — scheduling is owned by BullMQ, not the platforms.** We schedule every post via a BullMQ *delayed job* and call the adapter's `publishNow()` at the fire time. This means platforms with **no native scheduling API** (YouTube, TikTok, X, Discord) are no harder than the ones that do — each adapter only needs `publishNow()` + OAuth token management.

### Deployment topology (forced by BullMQ)

BullMQ needs a persistent Redis connection + a long-running worker, which **cannot run on Vercel serverless**. The system is therefore split:

```text
Next.js app   → Vercel        (enqueues jobs only; never runs a Worker)
BullMQ worker → Railway/Render (always-on `node worker/index.ts`)
Redis broker  → Upstash       (BullMQ requires maxRetriesPerRequest: null)
Postgres      → Neon
```

Both the app and the worker import the same `db/` + `lib/` via TS path aliases — one repo, two process entrypoints, zero schema duplication.

### Orchestration division of labor

| Concern | Owner |
|---|---|
| AI content generation (research → digest → ideate → draft → critique → refine) | **LangGraph** (`lib/agent/`) |
| Time-based publishing, retries, comment polling | **BullMQ** (`worker/`) |
| LLM provider abstraction | **`lib/llm/factory.ts`** (Gemini default) |
| Tracing / evals / prompt versions | **LangSmith** (env-var wired, both processes) |
| Per-platform publish/OAuth/comments | **`PlatformConnector` adapters** (`lib/platforms/`) |

---

## Prerequisites (accounts + env vars)

Collect keys into `.env.local` (app) and the worker host's env; `lib/env.ts` validates them.

- **Clerk** — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET` (enable Billing for Goal 6)
- **Neon** — `DATABASE_URL`
- **Upstash Redis** — `REDIS_URL`
- **ImageKit** — `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`
- **Google AI Studio (Gemini)** — `GOOGLE_API_KEY` (+ optional `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- **LangSmith** — `LANGCHAIN_TRACING_V2=true`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT=social-saas`, `LANGCHAIN_ENDPOINT=https://api.smith.langchain.com`
- **Token encryption** — `ENCRYPTION_KEY` (32-byte, for encrypting social tokens at rest)
- **Per social platform developer app** (as each adapter is built): client id/secret + redirect URI for LinkedIn, X, Facebook/Instagram (Meta), Pinterest, YouTube (Google), TikTok, Discord. Meta + TikTok require app review — start early.
- **Web research** (Goal 5) — `TAVILY_API_KEY` (or SerpAPI/Bing).

---

## Target Folder Structure

```text
social-saas/
├─ app/
│  ├─ (marketing)/         # PUBLIC: landing, pricing, legal
│  ├─ (dashboard)/         # AUTH: dashboard, create, calendar, accounts, research, auto-reply, settings, billing
│  └─ api/                 # route handlers
├─ components/             # ui/ (ShadCN), composer/, calendar/, accounts/, research/, auto-reply/, shared/
├─ lib/
│  ├─ env.ts  clerk.ts
│  ├─ queue/               # connection.ts, queues.ts, jobs.ts
│  ├─ agent/               # LangGraph: graph.ts, state.ts, nodes/, tools/, prompts.ts
│  ├─ platforms/           # types.ts, registry.ts, base.ts, <platform>.ts adapters
│  ├─ llm/                 # factory.ts, providers/{gemini,openai,anthropic}.ts
│  ├─ imagekit/  billing/  repos/  utils/
├─ db/                     # index.ts, schema.ts, schema/, migrations/
├─ worker/                 # index.ts, logger.ts, processors/
└─ docs/                   # PLAN.md, ROADMAP.md
```

---

## Data Model (Drizzle / Neon)

Clerk owns `users` + `organizations`. App tables store `clerkUserId text` (indexed) + optional `clerkOrgId`. Each table: `id uuid pk`, `createdAt`/`updatedAt timestamptz`.

| Table | Purpose / key columns |
|---|---|
| **enums** | `platform`, `postStatus`, `targetStatus`, `mediaType`, `contentKind`, `jobStatus` |
| **social_accounts** | OAuth per account; `platform`, `platformAccountId`, `accessToken`(encrypted), `refreshToken`, `tokenExpiresAt`, `scopes[]`, `metadata jsonb`, `status`. Unique `(clerkUserId, platform, platformAccountId)` |
| **posts** | canonical post; `baseBody`, `status`, `scheduledAt`, `timezone`, `sourceContentId?` |
| **post_targets** | **the unit BullMQ publishes**; `postId`, `socialAccountId`, `platform`, `body`, `mediaAssetIds uuid[]`, `status`, `scheduledAt?`, `bullJobId?`, `externalPostId`, `externalUrl`, `attemptCount`, `lastError`, `platformOptions jsonb` |
| **media_assets** | ImageKit-backed; `type`, `imagekitFileId`, `url`, `thumbnailUrl`, dims, `transformations jsonb`, `sourceAssetId?` |
| **schedules** | durable job ledger; `queue`, `bullJobId`, `refType`, `refId`, `status`, `runAt`, `attempts`, `lastError`. Unique `(queue, bullJobId)` |
| **research_topics** | `niche`, `query`, `status`, `findings jsonb`, `langsmithRunId?` |
| **generated_content** | `researchTopicId?`, `kind`, `platform?`, `content`, `variants jsonb`, `model`, `promptVersion`, `langsmithRunId`, `accepted` |
| **auto_reply_rules** | `socialAccountId?`, `platform`, `keywords[]`, `matchType`, `replyTemplate`, `useAi`, `enabled`, `cooldownSec`, `maxPerDay?` |
| **comment_events** | `externalCommentId`, `text`, `matchedRuleId?`, `replied`, `replyExternalId`. Unique `(socialAccountId, externalCommentId)` |
| **usage** | `metric`, `periodStart`, `periodEnd`, `count`, `limit`. Unique `(clerkUserId, metric, periodStart)` |

---

## Core Contracts

**`PlatformConnector`** (`lib/platforms/types.ts`) — every adapter implements `getAuthUrl`, `exchangeCode`, `refreshToken`, **`publishNow`** (only hard requirement for MVP), `fetchComments`, `postReply`, and a `capabilities` descriptor. `registry.ts` exposes `getConnector(platform)` so the worker publishes polymorphically with **no platform `switch` anywhere**. `base.ts` centralizes "refresh-if-expired then retry".

**LangGraph `ContentState`** (`lib/agent/state.ts`): inputs `niche`/`topic`/`platforms[]`; accumulators `researchFindings[]` (concat), `digest`, `ideas[]`, `drafts: Record<Platform, Draft>` (merge), `critiques`, `revisionCount` (bounded ≤2). Topology: `research → digest → ideate → draftPerPlatform → critique → (conditional refine↩ or finalize) → END`.

---

## Phases → Goals

The build is sequenced as 11 phases (Goal 0 → Goal 10), MVP-first, each a shippable vertical slice. The runnable per-phase prompts, run order, dependency rationale, and the per-goal Definition of Done (CI green → PR → CodeRabbit → merge) live in [ROADMAP.md](ROADMAP.md).

- **Goal 0 — Foundation** — scaffold, design system, DB/queue wiring, CI + CodeRabbit, deploy skeleton.
- **Goal 1 — Auth & App Shell** — Clerk auth, landing page, dashboard shell.
- **Goal 2 — First Vertical Slice (MVP)** — connect 1 platform → compose → upload → schedule → auto-publish → calendar.
- **Goal 3 — Multi-Platform Publishing** — more adapters, multi-select, per-platform variants, per-target status.
- **Goal 4 — LangGraph Content Agent** — LLM factory (Gemini), StateGraph, streaming generate, LangSmith.
- **Goal 5 — Niche Research Pipeline** — research tool, research→generate chaining, research/ideas UI.
- **Goal 6 — Billing & Feature Gating** — Clerk Billing plans, entitlements, usage quotas (7/day cap).
- **Goal 7 — Auto Comment-Reply** — rules, comment ingestion, keyword/AI auto-replies.
- **Goal 8 — Remaining Platforms + Media AI** — TikTok + Discord adapters, ImageKit AI transforms.
- **Goal 9 — Observability & Hardening** — LangSmith deep links, queue health/alerts, token-refresh monitoring.
- **Goal 10 — Polish & Launch** — drag-reschedule, analytics, onboarding, a11y/perf QA.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Serverless can't run jobs/scheduling | High | Always-on worker owns ALL scheduling via delayed jobs; `schedules` ledger gives idempotency + survives Redis eviction |
| OAuth token sprawl/expiry across 8 platforms | High | Encrypted at rest; `AbstractConnector` centralizes refresh-on-expiry + retry; account health surfaced (Goal 9) |
| Platform app-review delays (Meta, TikTok) | High | Start review submissions as soon as the adapter exists; sequence easy platforms first (LinkedIn/X) so the MVP doesn't block |
| Platform API quirks leaking into core | Med | `PlatformConnector` + `registry`; worker is fully polymorphic; `capabilities` drive graceful degradation |
| LLM cost / latency / non-determinism | Med | Heavy runs async (`generate` queue, concurrency 2); short runs stream; bounded refine loop; usage caps; LangSmith traces |
| Double-/lost-publish under retries | High | Deterministic `jobId` per target (dedupe), target state machine, `externalPostId` on success, retryable-vs-fatal classification |
