# Research Task 1 — Repo Intelligence (Capability Map)

**Date:** 2026-06-24
**Repo:** `langchain-project` (on disk) — product codename **SocialFlow**
**Scope:** Read-only capability map. Evidence cited as `path:LINE`. No code changed.

> The repo name is misleading: this is **not** LangChain core. It is an **AI social-content automation SaaS** that *uses* LangChain/LangGraph as one dependency. Confirmed from product surfaces (composer, accounts, auto-reply, billing) and the multi-platform publish pipeline below.

---

## Product purpose (derived from code)

A multi-tenant SaaS that **researches a niche, generates platform-tailored social posts with an AI agent pipeline, gates them through brand-safety + compliance review, schedules/publishes them to social platforms, and auto-replies to comments** — with analytics that feed back into the next cycle.

Evidence:
- Platform enum (the product's target surfaces): `db/schema/enums.ts:3-12` — instagram, youtube, tiktok, facebook, linkedin, pinterest, discord, x.
- Autonomous run entry: "research (Vega) → content (Lyra) → scheduled posts (Atlas)" — `app/api/agents/run/route.ts:26-30,77-80`.
- Dashboard surfaces: `app/(dashboard)/` has `create` (composer), `research`, `posts/[id]`, `accounts`, `auto-reply`, `calendar`, `review`, `compliance`, `runs`, `team`, `billing`, `settings` (from the `app/**/*.tsx` glob).
- Marketing/pricing/legal pages exist: `app/(marketing)/pricing/page.tsx`, `legal/privacy`, `legal/terms` → a commercial SaaS.

**Stack** (`package.json`): Next.js `16.2.9` App Router + React `19.2.4` + TS 5 + Tailwind 4 (`:35-39,48-58`); LangGraph `^1.4.4` / `@langchain/core ^1.2.0` with Anthropic/OpenAI/Google providers (`:23-27`); Drizzle ORM `^0.45.2` + Neon serverless (`:28,33`); BullMQ `^5.79.0` (`:29`); Clerk `^7.5.7` (`:22`); Zod `^4.4.3` (`:44`). Scripts: `worker` (`tsx worker/index.ts`), `eval:brand-safety`, `db:*` drizzle-kit (`:11-19`).

---

## Current capabilities (what exists, with evidence)

### 1. Two distinct AI-agent layers

There are **two** agent systems. Don't conflate them.

**(a) The LangGraph content-generation graph** — `lib/agent/` (singular).
- Graph: `analyze → draftPerPlatform → critique → (refine ↩ up to 2 | finalize) → END` — `lib/agent/graph.ts:20-39`. `MAX_REVISIONS = 2` (`:10`); conditional edge loops `refine→critique` while `needsRevision && revisionCount < 2` (`:29-37`).
- State shape (`Annotation.Root`): inputs `topic`, `platforms`, `userId`; brand context `brandVoice`, `bannedTerms`, `learnedNotes`; working `digest`, `drafts: Record<platform,string>`, `needsRevision`, `revisionCount`, `critiqueNotes`; output `savedContentIds` — `lib/agent/state.ts:6-52`.
- Nodes (each calls an LLM via the factory):
  - `digest` — temp 0.4, summarizes topic w/ voice+learnedNotes — `lib/agent/nodes/digest.ts:7-15`.
  - `draftPerPlatform` — temp 0.8, fans out per platform (Promise.all), `DRAFT_VARIANTS = 1`, picks best via `selectBestDraft`, hard-truncates to `PLATFORM_META.maxBodyLength` — `lib/agent/nodes/draft-per-platform.ts:9-42`.
  - `critique` — temp 0.2, flags revision if output starts with `REVISE` — `lib/agent/nodes/critique.ts:6-22`.
  - `refine` (exists `lib/agent/nodes/refine.ts`), `finalize` — persists drafts to `generated_content` and returns ids — `lib/agent/nodes/finalize.ts:7-22`.
- Invoked by `runContentAgent` which captures the root LangSmith run id and stamps it onto generated rows; **fails loudly** if drafts produced but nothing persisted — `lib/agent/index.ts:13-60`.
- A separate research mini-pipeline `runResearch(niche)`: web search (Tavily) → ideation prompt (temp 0.9) → parse up to 6 ideas — `lib/agent/research.ts:16-43`; web search is Tavily-only, returns `[]` (graceful fallback to model knowledge) when `TAVILY_API_KEY` unset — `lib/agent/tools/web-search.ts:8-37`.
- LLM provider is pluggable; **default Gemini**, switch via `LLM_PROVIDER` (gemini|openai|anthropic) — `lib/llm/factory.ts:14-24`; provider files `lib/llm/providers/{anthropic,gemini,openai}` (referenced `:4-6`).

**(b) The multi-agent orchestration roster ("constellation")** — `lib/agents/` (plural). **This is the bigger, more important surface and the orientation under-described it.**
- Roster (stable wire ids): `orion` (orchestrator), `vega` (research), `lyra` (generation), `atlas` (autopost/schedule), `sirius` (engagement/auto-reply), `polaris` (group seeding), `rigel` (reporting), `castor` (brand-safety gate) — `lib/agents/types.ts:16-25`; enum mirrored in DB `db/schema/enums.ts:80-89`.
- Core contract: every agent implements `AgentDefinition.run(input, ctx) → AgentResult`, a discriminated union of **handoff | pause(awaiting_approval) | terminal** — `lib/agents/types.ts:46-87`.
- **Orion orchestrator** (`createOrchestrator`, dependency-injected, no db/env imports so it unit-tests): `dispatch`, `startRun`, `resumeRun` — `lib/agents/orchestrator.ts:120-324`. Key properties:
  - Idempotent per `(runId, agent)`: a re-dispatch of an already-completed step **re-delivers the stored handoff instead of re-running** the (possibly non-idempotent) agent — `:159-188`. Explicitly notes this assumes each agent runs at most once per run (`:165-168`).
  - Two failure domains: step is committed *with its handoff* **before** delivery (`:233-251`).
  - Optional **supervisor** dynamic-routing hook that can override a handoff but **never** a pause (`:59-71,221-231`) — present but **not wired** in the runtime root (see Missing).
  - Feed-forward: `startRun` seeds the plan with the user's latest report (`priorReport`) — `:264-269`.
- Runtime composition root wires real repos/queues: `lib/agents/orchestrator.runtime.ts:21-30`; registry injects per-agent deps (structural least-privilege) and is the ONLY lookup (no switch) — `lib/agents/registry.ts:63-125`.
- **Capability matrix** (declared least-privilege, with a test that fails if e.g. `publish` is granted wrongly) — `lib/agents/capabilities.ts:12-40`.
- Execution path: app/API → `orchestrator.startRun` → BullMQ `agent-step` queue → `agentStepProcessor` validates payload (Zod) and calls `orchestrator.dispatch` → records step + enqueues next handoff — `worker/processors/agent-step.ts:17-94`.

Agent-by-agent (all in `lib/agents/<name>/index.ts`):
- **Vega** (`vega/index.ts:46-107`): wraps `runResearch`, persists ideas to `generated_content` (idempotent `replaceIdeasForTopic`), owns the `research_topics` row, hands off to **Lyra**.
- **Lyra** (`lyra/index.ts:38-63`): loads brand profile (voice, banned terms, learned memory), runs the content graph, hands off to **Castor**. Comment explicitly: "It does not auto-accept."
- **Castor** (`castor/index.ts:65-153`): brand-safety gate. Scores each draft; a draft auto-publishes **only** if tenant opted in AND verdict `pass` AND score ≥ threshold; otherwise **held**. Merges Praxis policy-lint findings; a `block`-level lint finding overrides `pass` → forces hold. If anything held → **pauses run (awaiting_approval)**; else hands off to **Atlas**. Fails closed (no review result ⇒ held).
- **Atlas** (`atlas/index.ts:121-259`): turns accepted content into a `post` + one `post_target` per active account, applies **Aletheia disclosure** (appends text within platform limit, writes `disclosure_ledger`), schedules each via `enqueuePublish` (per-target failure isolation), hands off to **Sirius**.
- **Sirius** (`sirius/index.ts:23-43`): ensures each relevant account has an active comment poll (`registerCommentPoll`, idempotent). Terminal.
- **Rigel** (`rigel/index.ts:45-89`): read-only report builder (top topics by published+engagement, run success rate, failed-publish count); persists `reports` row AND writes `learnedMemory.topTopics` (feed-forward into Lyra). Terminal.
- **Polaris** (`polaris/index.ts:20-33`): activates/deactivates per-account group-seeding job. Terminal.

### 2. Approval / human-in-the-loop (mostly wired, real)

- **Castor pause** is the gate: run status flips to `awaiting_approval` and persists `control:{pause}` on the step row — `lib/agents/orchestrator.ts:148-157`, schema `db/schema/agent-steps.ts:35-36`, enum `db/schema/enums.ts:92-100`.
- **Praetor (workspace roles + approver gate):** review server actions require role `approver` AND the run still `awaiting_approval` before any decision — `app/(dashboard)/review/actions.ts:32-44`. Per-draft actions: accept/reject/ignore/edit/respond (respond re-drafts via `refineDraftWithFeedback`), plus bulk approve/reject — `:78-210`. On approve, `orchestrator.resumeRun` enqueues Atlas with **only accepted ids**; reject finalizes run rejected; failed resume restores held drafts — `:65-69,183-201`. Roles enum `workspace_role` owner/admin/approver/creator/viewer — `db/schema/enums.ts:123-129`; membership table `db/schema/memberships.ts:12-25` (solo users fall back to `DEFAULT_ROLE`).
- **Aletheia (AI-content disclosure):** per-tenant policy (`labelAiContent`, `disclosureText`, `jurisdiction`) on `brand_profiles` — `db/schema/brand-profiles.ts:20-24,44-46`; engine `lib/compliance/disclosure.ts:42-64` (never truncates body to fit; flags native AI label on ig/fb/tiktok/youtube `:13-22`); append-only audit `db/schema/disclosure-ledger.ts:14-39` (cites EU AI Act Art.50, CA SB 942). Disclosure-policy form `app/(dashboard)/settings/disclosure-policy-form.tsx`.
- **Praxis (per-platform policy/ToS linter):** deterministic regex rule pack (absolute/health/financial claims = block; engagement-bait/outbound-link = warn), ReDoS-safe, no LLM — `lib/compliance/policy-linter.ts:31-99`. Wired into Castor at the gate (`registry.ts:84`).
- **Castor brand-safety engine** itself: banned-term hard-block (score 0), linear PII/secret detectors (soft → review), injected `judge` for voice fit, fails closed to `review` — `lib/agent/guardrails/brand-safety.ts:66-129`.

### 3. Publishing / platform integrations (real HTTP, MVP-scoped)

- **8 platform connectors** registered: facebook, instagram, linkedin, tiktok, discord, youtube, pinterest, x — `lib/platforms/registry.ts:14-23` (resolved polymorphically, no switch).
- Connectors are **real** API calls, not stubs — e.g. LinkedIn posts to `api.linkedin.com/rest/posts` with 15s timeout, parses `x-restli-id` — `lib/platforms/linkedin.ts:25-74`. Base class centralizes token decryption and throws `UnsupportedOperationError` for unimplemented ops (text-only MVP; image upload deferred) — `lib/platforms/base.ts:23-78`, `linkedin.ts:18-22`.
- **Publish path:** `Atlas/create-post → enqueuePublish (BullMQ delayed job, deterministic id, ledger-first) → publishProcessor → connector.publishNow`. Publish worker: marks publishing, fails fast on inactive account (don't burn retries), persists external id/url, recomputes post rollup status, registers comment poll (best-effort), dead-letters on exhausted retries — `worker/processors/publish.ts:18-146`. Enqueue: `lib/queue/jobs.ts:22-60` (4 attempts, exp backoff 30s).
- **OAuth** providers: linkedin, tiktok, pinterest, youtube, meta, x — `lib/oauth/providers/*` + `lib/oauth/registry.ts`. Routes `app/api/oauth/[provider]/{start,callback}/route.ts`. Tokens stored **encrypted at rest** (`access_token`/`refresh_token` encrypted, `ENCRYPTION_KEY` ≥32 chars) — `db/schema/social-accounts.ts:27-28`, `lib/platforms/base.ts:74-77`, `lib/env.ts:34-36`.

### 4. Engagement / auto-reply (real, idempotent)

- Poll loop: `registerCommentPoll` (BullMQ Job Scheduler, every 5 min) — `lib/queue/jobs.ts:165-186`; `commentPollProcessor` ingests comments idempotently (unique `(account, externalCommentId)`), classifies against rules in memory, bulk-enqueues replies in 2 phases so a failed enqueue can't orphan a match — `worker/processors/comment-poll.ts:29-124`.
- Reply: `replyProcessor` re-checks rule/cooldown/daily-cap via an **atomic slot grant** (serializes concurrent jobs), composes templated OR AI reply (AI failure falls back to template), atomically claims before posting (no double public reply), releases claim+slot on failure — `worker/processors/reply.ts:27-137`.
- Rules: keyword match types any/all/exact/regex; `useAi`, cooldown, `maxPerDay`, per-account or platform-wide — `db/schema/auto-reply.ts:25-65`; atomic per-rule slot ledger `auto_reply_slots` `:78-86`. Comment lifecycle enum `db/schema/enums.ts:69-77`.
- Webhook ingestion also exists: `app/api/webhooks/comments/[provider]/route.ts`, `lib/webhooks/{comments,meta}.ts`.

### 5. Analytics / observability

- **Lumen (Glass-Box Run Inspector):** `/runs` and `/runs/[runId]` render a verifiable timeline — `app/(dashboard)/runs/[runId]/page.tsx:24-104`. Timeline derived purely from `agent_steps` (`lib/runs/timeline.ts:68-81`).
- **Tamper-evident hash chain (T13):** each step `hash = sha256(prevHash + canonical(step))`; `verifyChain` returns first broken index; UI shows "Integrity verified" / "Integrity check failed at step N" — `lib/audit/run-audit.ts:36-105`, schema `db/schema/agent-steps.ts:41-44`, UI `runs/[runId]/page.tsx:73-83`.
- **LangSmith:** tracing gate + best-effort deep-link builder (needs `LANGSMITH_ORG_ID`+`PROJECT_ID`) — `lib/observability/langsmith.ts:4-22`; run ids captured in graph/research and stamped onto `generated_content`/`agent_runs`.
- **Rigel reports** persisted to `reports` table; `ReportData` = period, totalPublished, topTopics[], runSuccessRate, failedPublishCount — `db/schema/reports.ts:5-39`.
- **Engagement metrics:** `post_targets.metrics` jsonb + `metricsUpdatedAt` (`db/schema/post-targets.ts:48-49`); connectors expose `fetchMetrics` (unimplemented by default in base — `lib/platforms/base.ts:52-57`). A `reconcile` queue exists for ledger sweeps.
- **Health endpoints:** `app/api/health/{route,queues,ready}` (queue-depth scrape gated by optional `HEALTH_CHECK_TOKEN` — `lib/env.ts:89-92`).

### 6. Automation / workflow engine (BullMQ)

- Worker boots 10 workers — `worker/index.ts:69-79`: `publish`(5), `generate`(stub, 2 — real work is the streaming `/api/generate` route, see `:51-67`), `research`(2), `agent-step`(3), `comment-poll`(5), `reply`(5), `report`(1), `seeding`(2), `token-refresh`(1), `reconcile`(1).
- **Repeatable schedulers** (idempotent `upsertJobScheduler`): comment-poll 5min, seeding 30min, token-refresh 30min, reconcile 10min, report **daily** — `lib/queue/jobs.ts:165-278`. Boot ensures token-refresh/report/reconcile schedulers with retry-on-Redis-blip backoff — `worker/index.ts:85-142`.
- **Durable ledger** (`schedules` table) mirrors BullMQ jobs by deterministic id — source of truth for idempotency that survives Redis eviction — `db/schema/schedules.ts:19-44`; `enqueueWithLedger` records-then-enqueues with rollback — `lib/queue/jobs.ts:32-57`, `lib/queue/with-ledger.ts`. Default job opts: 3 attempts, exp backoff 5s — `lib/queue/queues.ts:36-42`.
- Graceful shutdown on SIGTERM/SIGINT closes workers then DB pool — `worker/index.ts:144-167`.

### 7. Billing / quotas / usage

- Plans **free/pro/premium** with hard limits (postsPerDay, aiPerMonth, accounts, research bool, autoReply bool) — `lib/billing/plans.ts:16-41`. Plan membership from **Clerk Billing** (`has({plan})`) — `lib/billing/entitlements.ts:22-31`.
- **Atomic quota** consume/release via conditional upsert on `usage` (per user/metric/period) — `lib/billing/entitlements.ts:44-93`, schema `db/schema/usage.ts:6-24` (metrics `posts_scheduled` daily | `ai_generations` monthly). Refund-on-failure pattern in `/api/generate` and `/api/agents/run` (`:54-74` / `:67-87`).
- **Rate limiting** (`rate_limits` fixed-window, Postgres-backed, serverless-safe) — `db/schema/rate-limits.ts:18-28`, used in routes (`agents-run` 10/60s, `generate` 15/60s).
- Autonomous runs are Pro+ gated (`limits.research`) — `app/api/agents/run/route.ts:52-58`.

### 8. Media (transform only — no generative media)

- ImageKit-backed: `media_assets` table (image/video/gif, dimensions, `sourceAssetId` self-ref for derived assets) — `db/schema/media-assets.ts:15-41`.
- "AI" here = **ImageKit URL transforms** (smart crop `fo-auto`, `e-bgremove`, `e-upscale`) — NOT image generation — `lib/imagekit/transform.ts:1-94`. Auth route `app/api/imagekit/auth/route.ts`, client/server/url helpers in `lib/imagekit/`.

### 9. Interop surfaces (MCP + A2A) — present, env-gated

- **A2A (outward):** exposes the agent over Agent2Agent JSON-RPC (`message/send` starts a run, `tasks/get` reads status) + Agent Card discovery; constant-time bearer auth; **acts as exactly ONE configured tenant** (`A2A_TENANT_ID`, never from request body) to remove impersonation — `app/api/a2a/route.ts:25-104`. Disabled unless `A2A_ENABLED=true` + token + tenant.
- **MCP (inward):** minimal stateless-HTTP client lets agents call tools on a configured MCP server; graceful when unconfigured (returns `[]`) — `lib/mcp/client.ts:29-63`, RPC helpers `lib/mcp/rpc.ts`. **Not yet called by any agent in the roster** (see Missing).

---

## Data model (every table in `db/schema/`)

Multi-tenancy is **Clerk-id based**: nearly every table carries `clerkUserId` (+ optional `clerkOrgId`). No row-level DB enforcement — tenancy is enforced in app/repo queries. 19 schema modules, **25 migrations** (`0000`–`0024`).

| Table | Purpose / key columns | Key relationships |
|---|---|---|
| `social_accounts` | Connected accounts; encrypted `accessToken`/`refreshToken`, `tokenExpiresAt`, `scopes`, `status` (active/expired/revoked) | unique `(user,platform,platformAccountId)`; FK target of post_targets, comments, auto-reply |
| `posts` | Canonical platform-agnostic post; `baseBody`, `status`, `scheduledAt`, `sourceContentId` (provenance), schedule-quota accounting | parent of `post_targets` |
| `post_targets` | Per-platform variant — the publish unit; `body`, `mediaAssetIds[]`, `status`, `bullJobId`, `externalPostId/Url`, `attemptCount`, `metrics` jsonb | FK→posts (cascade), FK→social_accounts; unique `(post,account)` |
| `generated_content` | AI drafts/ideas pre-post; `kind`, `platform`, `content`, `accepted`, **review fields** (`reviewStatus`, `brandSafetyScore` [0,1 check], `reviewVerdict`, `reviewViolations`, `reviewedBy`, `reviewerNote`), `agentRunId`, `langsmithRunId` | FK→research_topics (set null) |
| `research_topics` | A niche research run; `niche`, `status`, `findings` jsonb (`{title,url,snippet}[]`), `langsmithRunId` | parent of generated_content |
| `brand_profiles` | **Per-tenant settings** (unique clerkUserId): `voice`, `bannedTerms[]`, `autoPublishEnabled` (default OFF), `autoPublishThreshold` (default 0.8, [0,1] check), `learnedMemory` jsonb (Rigel↔Lyra), `disclosurePolicy` jsonb (Aletheia) | — |
| `agent_runs` | One row per pipeline run (the spine); `runId` (unique correlation id), `status` (incl. `awaiting_approval`/`rejected`), `plan` jsonb, `currentAgent`, `langsmithRunId` | unique `run_id` backs agent_steps FK |
| `agent_steps` | One row per agent invocation; `agent`, `status`, `input`/`summary`/`handoff`/`control` jsonb, `error`, **`prevHash`/`hash`** (tamper chain) | FK→agent_runs.runId (cascade) |
| `reports` | Rigel insight per user/period; `data` jsonb (`ReportData`) | — |
| `disclosure_ledger` | Append-only AI-disclosure audit; `platformLabelApplied`, `disclosureText`, `jurisdiction`, `policyVersion` | FK→post_targets (set null → audit survives) |
| `memberships` | Workspace role per `(org,user)` (Praetor); `role` enum | — |
| `auto_reply_rules` | Keyword rules; `keywords[]`, `matchType`, `replyTemplate`, `useAi`, `cooldownSec`, `maxPerDay` (checks) | FK→social_accounts (null = all accounts of platform) |
| `auto_reply_slots` | Atomic per-rule rate ledger; `periodStart`, `usedCount`, `lastReplyAt` | PK = ruleId, FK→auto_reply_rules |
| `comment_events` | Ingested comment + reply outcome; `externalCommentId`, `text`, `status`, `matchedRuleId`, `replied`, `replyExternalId` | FK→social_accounts, post_targets, auto_reply_rules; unique `(account,externalCommentId)` |
| `media_assets` | ImageKit assets; `type`, `url`, dimensions, `sourceAssetId` (derived) | self-ref FK |
| `schedules` | Durable BullMQ job ledger; `queue`, `bullJobId`, `refType`, `refId`, `status`, attempts | unique `(queue,bullJobId)` |
| `usage` | Quota counters; `metric`, `periodStart`, `count` | unique `(user,metric,period)` |
| `rate_limits` | Fixed-window limiter; `bucket`, `windowStart`, `count` | unique `(bucket,window)` |
| `enums` | All pgEnums (platform, statuses, agent_name, review_status, workspace_role, …) | — |

---

## Tests & evals

- **45 `*.test.ts`** (`tsx --test`) — strong unit coverage of the agent/business logic. Each roster agent has a test (`lib/agents/*/index.test.ts`), the orchestrator has 17+ cases incl. idempotency/resume/pause (`lib/agents/orchestrator.test.ts`), plus brand-safety, policy-linter, disclosure, run-audit (hash chain), roles, auto-reply match/slot/regex-guard, billing period/plans, queue job-ids/with-ledger, reviews/resolve, runs/timeline, crypto, a2a, mcp/rpc, webhooks.
- **Eval harness:** `evals/brand-safety/run.ts` (npm `eval:brand-safety`) + `lib/evals/brand-safety-metrics.test.ts`.
- **Integration:** only **one** — `tests/integration/quota-concurrency.test.ts` (needs a real DB).

**Not covered (no tests found):** platform connector HTTP logic (the actual `publishNow`/`fetchComments` request shaping), the worker processors (`worker/processors/*` — publish/reply/comment-poll/seeding), API routes, OAuth callback flows, and the LangGraph nodes/graph wiring (`lib/agent/nodes/*`, `graph.ts`).

---

## Missing surfaces (notable absences, with evidence of absence)

1. **Supervisor / dynamic re-routing is defined but NOT wired.** `OrchestratorDeps.supervisor` exists (`lib/agents/orchestrator.ts:66-71`) but `orchestrator.runtime.ts:21-30` omits it → runs are strictly linear (Vega→Lyra→Castor→Atlas→Sirius). No bounded-regenerate/recovery policy in production.
2. **Orion has no `run()` implementation.** It's the orchestrator concept but is **not in the registry** (`lib/agents/registry.ts:63-109` registers Vega/Lyra/Castor/Atlas/Sirius/Rigel/Polaris — not Orion); `getAgent(Orion)` would throw. Orion = the `createOrchestrator` machinery, not an `AgentDefinition`.
3. **MCP client is never called by an agent.** `lib/mcp/client.ts` exists and is env-gated, but no roster agent imports `callMcpTool`/`listMcpTools` (grep of registry/agents shows no MCP import) → tool-use-by-agents is plumbing-only.
4. **No generative media.** "AI" media is ImageKit transforms only (`lib/imagekit/transform.ts`); no text-to-image/video generation anywhere.
5. **No DB-level multi-tenancy (RLS).** Tenancy is app-query-enforced via `clerkUserId`; a repo query that forgets the filter would leak. No Postgres RLS policies in migrations.
6. **`generate` BullMQ queue is a stub** — real generation streams via `/api/generate` (`worker/index.ts:51-70`); the queue exists but does no work.
7. **Single agent-per-run-per-name constraint.** Idempotency keys on `(runId, agent)` (`orchestrator.ts:165-168`) — a plan invoking the same agent twice would need a per-step key (not implemented).
8. **Metrics/seeding are capability-gated and largely default-unsupported** — `fetchMetrics`/`listGroupPosts`/`interactWithPost` throw in the base (`lib/platforms/base.ts:52-72`); which connectors override them was not exhaustively verified per-platform.
9. **Image/video upload not implemented for connectors** (LinkedIn explicitly text-only MVP — `lib/platforms/linkedin.ts:18-22`).

---

## High-leverage extension points (exact seams for new agent features)

1. **Add a roster agent** — implement `AgentDefinition` in `lib/agents/<name>/index.ts`, add its enum value to `lib/agents/types.ts:16-25` **and** `db/schema/enums.ts:80-89` (additive migration), declare caps in `lib/agents/capabilities.ts:12-22`, and register (with injected deps) in `lib/agents/registry.ts:63-109`. The processor and persistence are generic — no other wiring needed.
2. **Insert a pipeline step** — change a handoff target (e.g. Lyra→`castor/index.ts:55-60`, or Castor→Atlas `castor/index.ts:133-138`). The orchestrator delivers any handoff generically (`orchestrator.ts:122-141`).
3. **Turn on dynamic routing / recovery** — pass a `supervisor` fn into `createOrchestrator` at `lib/agents/orchestrator.runtime.ts:21-30`; the override hook already exists (`orchestrator.ts:221-231`) and is pause-safe.
4. **Give agents tools** — call `callMcpTool` (`lib/mcp/client.ts:58-63`) from inside an agent's `run`, or add a LangChain tool alongside `lib/agent/tools/web-search.ts` and use it in a graph node.
5. **Extend the content graph** — add a node in `lib/agent/graph.ts:20-39` (e.g. a fact-check or SEO node between `critique` and `finalize`); state channels are additive in `lib/agent/state.ts:6-52`.
6. **Add a compliance/safety check at the gate** — extend the Praxis rule pack (`lib/compliance/policy-linter.ts:31-70`) or pass a richer `judge`/`lintPolicy` dep through `registry.ts:74-85`; Castor already merges findings and fails closed.
7. **New background automation** — add a `QueueName` (`lib/queue/queues.ts:6-22`), a processor (`worker/processors/`), register a scheduler in `lib/queue/jobs.ts` and `worker/index.ts`. The ledger/idempotency pattern is reusable via `enqueueWithLedger`.
8. **New platform** — add a connector extending `AbstractConnector` and register it in `lib/platforms/registry.ts:14-23` (+ `PLATFORM_META` and the `platform` enum); publish/poll/reply pick it up polymorphically.
9. **Per-run provenance / audit features** — the tamper-evident chain (`lib/audit/run-audit.ts`) and `agent_steps.summary` jsonb are the natural attach points for richer run analytics surfaced at `runs/[runId]`.

---

## Important files (annotated)

**Orchestration (primary surface)**
- `lib/agents/types.ts` — agent contract + roster enum + AgentResult union.
- `lib/agents/orchestrator.ts` — Orion: dispatch/startRun/resumeRun, idempotency, pause, supervisor hook.
- `lib/agents/orchestrator.runtime.ts` — composition root (real deps injected here).
- `lib/agents/registry.ts` — per-agent dependency injection + `getAgent`.
- `lib/agents/capabilities.ts` — least-privilege matrix (+ enforced by test).
- `lib/agents/{vega,lyra,castor,atlas,sirius,rigel,polaris}/index.ts` — the agents.
- `worker/processors/agent-step.ts` — the single generic dispatch processor.

**Content generation (LangGraph)**
- `lib/agent/graph.ts`, `state.ts`, `index.ts`, `nodes/{digest,draft-per-platform,critique,refine,finalize}.ts`, `research.ts`, `tools/web-search.ts`, `refine-draft.ts`.
- `lib/llm/factory.ts` (+ `providers/*`) — pluggable LLM (default Gemini).
- `lib/agent/guardrails/{brand-safety,model-judge,parse-judge-response}.ts` — safety scoring.

**Publishing / engagement**
- `lib/platforms/{registry,base,constants,types}.ts` + 8 connectors; `worker/processors/{publish,comment-poll,reply,seeding,token-refresh,reconcile}.ts`.
- `lib/queue/{queues,jobs,with-ledger,job-ids,connection}.ts` — BullMQ + durable ledger.
- `lib/oauth/{registry,providers/*}.ts` + `app/api/oauth/[provider]/*`.

**Compliance / governance / observability**
- `lib/compliance/{disclosure,policy-linter}.ts`; `db/schema/disclosure-ledger.ts`.
- `lib/auth/roles.ts` + `app/(dashboard)/review/actions.ts` (Praetor gate).
- `lib/audit/run-audit.ts` + `lib/runs/timeline.ts` + `app/(dashboard)/runs/[runId]/page.tsx` (Lumen).
- `lib/observability/{langsmith,report-error}.ts`.

**Billing / data / interop**
- `lib/billing/{plans,entitlements,period}.ts`; `db/schema/{usage,rate-limits}.ts`.
- `db/schema/*` (19 modules), `db/migrations/0000–0024`.
- `app/api/agents/run/route.ts` (UI run trigger), `app/api/a2a/route.ts` (A2A), `lib/mcp/{client,rpc}.ts` (MCP).
- `lib/env.ts` — validated env (secrets surface).

---

## Risks & constraints

- **Serverless execution limits.** `/api/generate` sets `maxDuration = 60` and fans out per platform to stay in budget (`app/api/generate/route.ts:17`, `draft-per-platform.ts:14-16`); agent/A2A routes force `runtime = "nodejs"` because they touch Redis+LangGraph (`agents/run/route.ts:15-17`). Long agent work is correctly pushed to the BullMQ worker, but the **worker is a separate long-running process** (pooled Neon via `DB_DRIVER=pool`, `lib/env.ts:22-23`) — it must be deployed/operated outside serverless; if it's down, runs queue but never progress.
- **Secrets handling is sound but app-enforced.** OAuth tokens encrypted at rest (`ENCRYPTION_KEY` ≥32, `lib/utils/crypto.ts`); env validated at import and fails fast (`lib/env.ts:113-128`); `.gitignore` likely excludes `.env.local` (worker loads it via `worker/load-env`). I did **not** find committed secrets. No `.env*` was read.
- **Tenancy depends on query discipline** (no RLS) — a missing `clerkUserId` predicate in any repo would cross tenants. A2A endpoint mitigates its own vector by binding to one tenant.
- **Idempotency assumes one-shot agents per run** (`orchestrator.ts:165-168`) — fine for the current linear plan; a loop/retry plan would double-act without a per-step key.
- **Coverage gap = integration/runtime.** Logic is well-tested; connectors, processors, OAuth callbacks, routes, and graph wiring have **no automated tests** — the parts most likely to break against live platform APIs.
- **Praxis linter is heuristic regex** (no LLM, English-only literals) — will miss paraphrased violations; documented as MVP (`policy-linter.ts:24-30`).
- **Many platform capabilities throw by default** (metrics, group posts, seeding interactions in `base.ts`) — features depending on them work only for connectors that override them; this was not verified connector-by-connector.
- **AGENTS.md warns Next.js 16 has breaking changes vs. training data** — App-Router conventions here (e.g. `params: Promise<...>` awaited in `runs/[runId]/page.tsx:24-30`) reflect that; assume the in-repo `node_modules/next/dist/docs/` is authoritative before extending UI/routes.

---

## Self-check

Every capability claim above traces to a cited `path:LINE` opened during this pass. Files read in full: all 19 `db/schema/*` modules, the agent graph + all 5 nodes + research + factory, all 7 roster agents + orchestrator + registry + runtime + types + capabilities, all queue modules, 6 of 9 worker processors (publish, agent-step, comment-poll, reply, seeding; report/research/token-refresh/reconcile inferred from worker/index + queue jobs), compliance (disclosure, policy-linter), audit/run-audit, runs/timeline, billing (entitlements, plans), env, A2A route, MCP client, review actions, brand-safety guardrail, imagekit transform, web-search tool, LinkedIn connector + base, generate + agents/run routes, run inspector page.

**Could NOT fully verify (treat as open):**
- Per-connector capability coverage (which of the 8 connectors actually implement `fetchComments`/`fetchMetrics`/`listGroupPosts`/`interactWithPost`) — only LinkedIn + base read in full; others (facebook, instagram, tiktok, x, pinterest, youtube, discord) inferred from the registry + base defaults, not opened line-by-line.
- The exact content of migrations `0000`–`0024` (counted via glob, not read) — schema described from the live `db/schema/*.ts` source, which is authoritative over historical SQL.
- `report`/`research`/`token-refresh`/`reconcile` processors not opened individually (behavior inferred from `worker/index.ts` + `lib/queue/jobs.ts` + the agents they back).
- `lib/llm/providers/{anthropic,gemini,openai}.ts` not opened (existence confirmed via imports in `factory.ts:4-6`); exact model ids/params unverified.
- `lib/auth/roles.ts` not opened (role behavior inferred from `enums.ts` + `review/actions.ts` usage).
- Whether `.env.local` is gitignored was not confirmed by reading `.gitignore` (no secrets found in code; no env file read).
