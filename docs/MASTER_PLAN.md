# Master Implementation Plan (v5)

Consolidated on 2026-06-26 for `C:\Users\huuth\Desktop\langchain-project`.

This is the single current master plan and status contract. It supersedes the active root plan files and condenses the archived roadmap, orchestration plans, agent upgrade plans, review fix plans, feature ideation docs, and the 2026-06-26 AI-agent roadmap into one status source.

## Status Legend

- `[x] Completed`: implemented in repo code, surfaced through the relevant worker/API/UI path where applicable, and locally verifiable by targeted tests or typecheck.
- `[~] Partial`: repo implementation exists, but a live-service or product-governance dependency still gates full production use.
- `[blocked] External`: intentionally not implemented beyond safe local primitives because it needs credentials, provider APIs, marketplace approval, or an explicit opt-in/security design.

Global caveat: live runtime verification is still deferred. The codebase has not been proven against real DB/Redis/LLM/social-provider credentials in this pass. "Completed" means repo-implemented, not live-service certified.

## Sources Reviewed

Current docs:

- `docs/MASTER_PLAN.md` (prior v4)
- `docs/research/01-repo-intelligence.md`
- `docs/research/02-trends.md`
- `docs/research/03-feature-ideation.md`
- `docs/research/04-feasibility.md`
- `docs/research/ai-agent-trends-2026-06-22.md`
- `docs/research/ai-agent-trends-2026-06-22-refresh.md`

Archived plans:

- `docs/archive/AI_AGENT_FEATURE_ROADMAP_2026-06-26.md`
- `docs/archive/PLAN.md`
- `docs/archive/ROADMAP.md`
- `docs/archive/ORCHESTRATION.md`
- `docs/archive/ORCHESTRATION_GOALS.md`
- `docs/archive/AGENT_UPGRADE_PLAN.md`
- `docs/archive/AGENT_UPGRADE_IMPLEMENTATION_NOTES.md`
- `docs/archive/BUILD_PLAN_TOP3.md`
- `docs/archive/FIX_PLAN.md`
- `docs/archive/REVIEW_FIX_PLAN.md`
- `docs/archive/REVIEW_FIXES.md`
- `docs/archive/MASTER_PLAN_v2.md`
- `docs/archive/IMPLEMENTATION_NOTES.md`
- `docs/archive/AGENT_FEATURE_IDEAS.md`
- `docs/archive/AGENT_FEATURE_IDEAS_V2.md`
- `docs/archive/ROOT_FIX_PLAN_SUPERSEDED.md`
- `docs/archive/ROOT_MASTER_PLAN_v2_SUPERSEDED.md`

## Executive Status

The original product plan is complete at repo level. SocialFlow is implemented as a Next.js app with Clerk auth, Drizzle/Postgres schema, BullMQ workers, LangChain/LangGraph content generation, multi-agent orchestration, review gates, publishing adapters, analytics, quotas, team roles, compliance, and observability.

All repo-local `[~]` and `[ ]` roadmap items from v4 have now been either implemented or explicitly moved to an external/live-service blocker. The P0 operational gaps are complete at code level. The P1 expansion bets are implemented as safe MVPs: first-class campaigns, source-to-campaign repurposing, recommendations and experiments, signed webhooks, public approval links, read-only public API, read-only MCP server, and campaign workspace tooling.

Remaining work is live-product hardening, provider verification, and intentionally blocked external surfaces. No broad write-capable external-agent surface is marked complete unless scoped tokens, audit logging, and approval boundaries exist.

## Completed Product Foundation

### Core SaaS Roadmap (Goals 0-10)

- [x] Foundation, infra, CI, health checks, Drizzle schema, dual DB driver, BullMQ queues, durable schedule ledger.
- [x] Clerk auth, protected dashboard shell, marketing pages, pricing, legal stubs, theme support.
- [x] Publishing vertical slice, connected accounts, composer, scheduling, worker publishing.
- [x] Multi-platform publishing adapters: Facebook, Instagram, LinkedIn, X, Pinterest, YouTube, TikTok, Discord.
- [x] Media pipeline: ImageKit upload, platform transforms, AI variants, SSRF-safe media URL handling.
- [x] LangGraph/LangChain content agent: research, digest, ideate, draft, critique, refine, finalize.
- [x] Billing and quotas: plan limits, atomic usage, refunds, fixed-window rate limit.
- [x] Auto-reply: rules, comment ingestion, triage tags, safety blocks, reply slot/cooldown caps.
- [x] Observability and hardening: worker logs, queue health, reconcile sweep, token refresh, LangSmith links, CI gates.
- [x] Polish and launch scaffolding: SEO metadata, generated icons/OG images, accessibility pass, loading/error/not-found states, onboarding wizard.

### Agent Orchestration and Governance

- [x] A0-A5 agents, Orion orchestrator, durable handoffs, idempotent agent-step queue, pause/resume.
- [x] Castor review gate and `awaiting_approval` run state.
- [x] Brand-safety guardrail, banned terms, PII/secret hold logic, deterministic evals.
- [x] Brand profiles, brand voice, banned terms, learned memory.
- [x] Review persistence, queue actions, edit/respond/accept/reject workflow.
- [x] Least-privilege agent capability matrix.
- [x] Tamper-evident audit hash chain.
- [x] Parallel per-platform drafting and best-of-N synthesis.
- [x] MCP inward client for configured external MCP servers.
- [x] A2A route for agent-card discovery, `message/send`, `tasks/get`, and `tasks/sendSubscribe`, gated by scoped tenant tokens.

### Compliance, Approval, Team, and Workspace

- [x] Aletheia provenance and AI-disclosure ledger.
- [x] Praxis platform policy linter plus editable per-org literal policy rules.
- [x] Selectable industry policy packs for regulated/common verticals.
- [x] Triage Agent Inbox for held drafts.
- [x] TrueView per-platform preview in composer and review queue.
- [x] Lumen run inspector with timeline, hash-chain integrity, cost, and LangSmith links.
- [x] Praetor roles and delegated approval gates.
- [x] Atrium multi-brand workspaces, brand switcher, brand-scoped core entities.
- [x] Client approval portal with short-lived token links for campaign decisions.
- [x] Collaborative draft review comments on held review items.

### Scheduling, Analytics, Repurposing, and Quality

- [x] Chronos best-time-to-post optimizer and posting-window refresh worker.
- [x] Pulse engagement metrics polling and dashboard summary.
- [x] Rigel daily reports, learned-memory feedback, and dashboard insights.
- [x] Phoenix/Evergreen repurposing with recurring evergreen preferences and queue automation.
- [x] Scheduled Trend Watch worker with due-watch sweep, idempotent run ledger, enqueue, and next-run advancement.
- [x] Approval analytics and reviewer SLA summary in the quality dashboard.
- [x] Vigil/Vetus deterministic brand-safety CI gate.
- [x] Quality dashboard: verdict counts, average safety score, held count, recent flagged content, SLA, reviewer history.
- [x] Run Doctor plus Medic self-healing publisher repair sweep for safe transient publish failures.

## 2026 Roadmap Top 10 Status

| Rank | Feature | Status | Current repo evidence / gap |
|---:|---|---|---|
| 1 | Run Doctor Command Center | [x] Completed | Publish-target failure classifier, dashboard triage, account/media/policy/transient classes, gated safe retry. |
| 2 | Platform Constraint Coach | [x] Completed | Shared platform validation powers composer warnings and server-side create-post validation. |
| 3 | Social Account Health Agent | [x] Completed | Account health findings, badges, reconnect CTA, dashboard/account/composer warnings. |
| 4 | Brand Memory Manager | [x] Completed | Settings can view/edit/clear learned memory; voice history is shown; Lyra consumes learned notes. |
| 5 | Cross-Platform Consistency Auditor | [x] Completed | Deterministic checks detect price/date/link/disclosure drift and Castor stores findings. |
| 6 | Live Agent Run Control Room | [x] Completed | Internal run SSE endpoint and live status component show state, pause reason, cost, and integrity. |
| 7 | Campaign Simulation Gate | [x] Completed | Campaign scorecard plus audience simulation/risk toolkit surfaces campaign readiness. |
| 8 | Scheduled Trend Watch Agent | [x] Completed | Due-watch worker, idempotent run ledger, research enqueue, source status, and next-run advancement. |
| 9 | Evergreen Content Recycler 2.0 | [x] Completed | Recyclable winners, source-linked refresh drafts, recurring preferences, and evergreen worker automation. |
| 10 | Agent Spend and Budget Governor | [x] Completed | Run start estimates spend, stores budget cap, pauses before over-budget handoff, and supports approval. |

## Completed Roadmap Implementations

### P0 - Operational Features

| Feature | Status | Evidence |
|---|---|---|
| Scheduled Trend Watch worker | [x] Completed | `research_watch_runs`, due-list repo, `worker/processors/research-watch.ts`, scheduler registration. |
| Approval Analytics and Reviewer SLA | [x] Completed | `lib/quality/approval-analytics.ts`, quality repo aggregation, SLA panels on `/quality`. |
| Industry Policy Packs | [x] Completed | `INDUSTRY_POLICY_PACKS`, brand profile persistence, settings UI, Castor integration, policy tests. |
| Reply Copilot Inbox | [x] Completed | `reply_copilot_drafts`, deterministic suggestions, edit/dismiss/send actions, connector send guardrails. |
| Agent Run Templates | [x] Completed | Code-defined templates, run form template picker, template tests. |
| Medic / self-healing publisher | [x] Completed | Failed-target repair query, safe recovery decision, publish-repair worker and scheduler. |
| Production A2A / Legate hardening | [x] Completed | DB-backed scoped tokens, token lifecycle UI, audit logs, scope checks in A2A route. |
| Evergreen automation | [x] Completed | Recurring preferences, dashboard controls, due worker, source selection, duplicate guard. |

### P1 - Product Expansion

| Feature | Status | Evidence |
|---|---|---|
| Source-to-campaign repurposer | [x] Completed | Campaign sources, pasted-text ingestion, grounded source summary, Lyra run start from source. |
| Metrics-driven recommendations and experiments | [x] Completed | Engagement recommendations, experiment persistence, campaign workspace UI. |
| External event webhooks | [x] Completed | Endpoint UI, encrypted signing secrets, signed deliveries, retry ledger, worker. |
| Client approval portal | [x] Completed | Short-lived approval links, public portal, approve/request-changes action. |
| Campaign objects and brief workspace | [x] Completed | `campaigns`, sources, experiments, attribution links, nav/page workspace. |

### Additional Local Roadmap Features

| Feature | Status | Evidence |
|---|---|---|
| Pre-flight audience simulation | [x] Completed | Deterministic audience reactions in campaign toolkit and workspace. |
| Competitor watch setup | [x] Completed | Competitor watch model/repo/UI; live monitoring remains externally blocked. |
| SEO/hashtag optimizer | [x] Completed | Deterministic hashtag suggestions in campaign toolkit. |
| Format transformer | [x] Completed | Platform transformer in campaign toolkit. |
| Per-platform algorithm coach | [x] Completed | Platform coaching tips in campaign workspace. |
| Multi-agent strategy debate panel | [x] Completed | Deterministic strategy debate panel in campaign workspace. |
| Campaign template library | [x] Completed | Code-defined campaign templates and one-click campaign creation. |
| Crisis and brand-risk radar | [x] Completed | Deterministic risk radar in campaign workspace. |
| Attribution tracker MVP | [x] Completed | UTM tracked links, stored clicks/conversions/revenue fields, campaign UI. |
| Public API and Zapier/n8n foundation | [x] Completed | Read-only `/api/public/campaigns`, public API tokens, signed webhooks for automation tools. |
| SocialFlow MCP server foundation | [x] Completed | Read-only `/api/mcp` JSON-RPC tool listing/call with scoped MCP tokens and audit logs. |

## Blocked or Partial by External Requirement

| Feature | Status | Exact blocker / required service |
|---|---|---|
| On-brand visual generation agent | [blocked] External | Requires an image generation provider/model credential, brand asset authorization policy, moderation policy, and storage/cost controls. Existing ImageKit variants are not generative visuals. |
| Threaded multi-turn reply agent | [blocked] External | Requires provider thread/conversation APIs and account scopes for each supported platform. Local reply copilot is single-comment and approval-gated. |
| DM and inbox agent | [blocked] External | Requires platform DM/inbox APIs, scopes, webhook subscriptions, and safety policy for private-message handling. |
| Competitor live monitoring | [~] Partial | Watch configuration is implemented. Live collection requires a search/social/scraping provider, legal/citation policy, and rate-limit controls. |
| Attribution and ROI live tracker | [~] Partial | UTM link storage and counters exist. Live click/conversion/ROI needs a redirect or pixel domain/service and conversion ingestion. |
| Automatic bandit allocation | [blocked] External | Experiment objects and recommendations exist. Autonomous allocation needs live traffic/sample-size thresholds and guardrails to avoid noisy optimization. |
| Public Zapier/n8n marketplace package | [~] Partial | Read-only API and webhooks exist. Official app/package publication requires external marketplace/app registration and docs. |
| Write-capable SocialFlow MCP tools | [blocked] External | Read-only MCP server exists. Write tools require per-tool permissions, approval prompts, audit display, and admin governance before exposure. |
| Public A2A marketplace / open inbound third-party agents | [blocked] External | Tenant-scoped A2A exists. Marketplace exposure needs buyer-driven enablement, app listing, abuse controls, and stronger public admin UX. |
| C2PA/SynthID signing | [blocked] External | Requires signing credentials/provider SDK and a customer requirement for cryptographic provenance. Text disclosure and AI label metadata already exist. |
| Browser/computer-use posting automation | [blocked] External | Requires explicit opt-in design, audited per-action approvals, credential isolation, and a safe fallback path. Official API connectors remain the default. |
| Broad write-capable MCP/A2A/external-agent surfaces | [blocked] External | Current implementation has scoped tokens and audit logs. Broader writes still need admin controls, action-level approval boundaries, and live verification. |

## Current Backlog

### Repo-Local Work

No repo-local `[~]` or `[ ]` roadmap item remains open in this plan. Future repo-local work should be created from fresh product requirements, not from the superseded v4 backlog.

### Live Verification

1. Apply migrations to the target database.
2. Run an always-on worker with Redis/BullMQ.
3. Provision Clerk, Neon/Postgres, Upstash/Redis, ImageKit, LLM, Tavily, and social provider credentials.
4. Verify generate -> review -> approve -> schedule -> publish against sandbox or test provider accounts.
5. Verify webhook delivery against a receiver and validate signatures.
6. Verify public API and MCP routes with issued scoped tokens.
7. Verify A2A route with tenant token scopes and audit-log visibility.

### External/Product Decisions

1. Decide whether to ship official Zapier/n8n packages or keep generic API/webhooks only.
2. Decide which image generation provider and policy would satisfy on-brand visual generation.
3. Decide whether live competitor monitoring uses a licensed search/social provider or customer-supplied source feeds.
4. Decide whether ROI tracking should use first-party redirect links, pixel/conversion events, or third-party analytics imports.
5. Decide whether browser/computer-use posting automation is acceptable under an explicit opt-in risk model.

## Verification Notes

Representative implementation evidence:

- Scheduled trend watch: `lib/repos/research-watches.ts`, `db/schema/roadmap.ts`, `worker/processors/research-watch.ts`, `lib/queue/jobs.ts`.
- Approval analytics: `lib/quality/approval-analytics.ts`, `lib/repos/quality.ts`, `app/(dashboard)/quality/page.tsx`.
- Policy packs: `lib/compliance/policy-linter.ts`, `lib/brand/profile-input.ts`, `app/(dashboard)/settings/brand-profile-form.tsx`, `lib/agents/castor/index.ts`.
- Reply copilot: `lib/auto-reply/copilot.ts`, `lib/repos/reply-copilot.ts`, `app/(dashboard)/auto-reply/actions.ts`, `app/(dashboard)/auto-reply/page.tsx`.
- Agent templates: `lib/agents/run-templates.ts`, `components/runs/start-run-form.tsx`, `app/(dashboard)/runs/actions.ts`.
- Medic publisher: `lib/repos/posts.ts`, `worker/processors/publish-repair.ts`.
- Integration hardening: `lib/integrations/tokens.ts`, `lib/repos/integrations.ts`, `app/api/a2a/route.ts`, `app/(dashboard)/settings/integration-tokens-form.tsx`.
- Evergreen automation: `lib/evergreen/automation.ts`, `lib/repos/evergreen.ts`, `worker/processors/evergreen.ts`, `app/(dashboard)/dashboard/page.tsx`.
- Campaign workspace: `db/schema/roadmap.ts`, `lib/repos/campaigns.ts`, `app/(dashboard)/campaigns/page.tsx`.
- Webhooks: `lib/webhooks/signing.ts`, `lib/repos/webhooks.ts`, `worker/processors/webhook-delivery.ts`, `app/(dashboard)/settings/webhook-endpoints-form.tsx`.
- Approval portal: `lib/approval-links/tokens.ts`, `lib/repos/approval-links.ts`, `app/approve/[token]/page.tsx`.
- Public API/MCP: `app/api/public/campaigns/route.ts`, `app/api/mcp/route.ts`, `lib/integrations/public-campaigns.ts`, `lib/integrations/mcp-server.ts`.

## Changelog

- 2026-06-26 (v5): Implemented all repo-local in-progress and incomplete roadmap items from v4. Completed P0 operational gaps, P1 campaign/integration expansion, local campaign toolkit features, read-only public API, read-only MCP server, collaborative draft comments, and campaign templates. Moved live-provider and broad write-capable external surfaces to exact blocked/partial status.
- 2026-06-26 (v4): Condensed all active and archived plan docs into this master plan. Reconciled the 2026-06-26 AI-agent roadmap against current code. Marked Scheduled Trend Watch, Approval Analytics/SLA, Industry Policy Packs, Reply Copilot Inbox, Medic self-healing, Agent Run Templates, production A2A, and evergreen automation as in progress. Kept external surfaces, campaign objects, source-to-campaign, bandit, visual agent, client portal, public API, MCP server, and browser automation as not implemented or hold.
