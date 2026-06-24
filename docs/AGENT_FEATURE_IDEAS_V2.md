# SocialFlow — 23 New AI-Agent Feature Ideas (additive to the existing 20)

> **Not a commitment or plan** — a grounded, repo-specific ideation menu. Companion to
> [AGENT_FEATURE_IDEAS.md](AGENT_FEATURE_IDEAS.md) (the original 20), [ORCHESTRATION.md](ORCHESTRATION.md),
> and the trend basis [research/ai-agent-trends-2026-06-22-refresh.md](research/ai-agent-trends-2026-06-22-refresh.md).
> Compiled 2026-06-23. Sources verified live the same day (see end).

**Grounding.** SocialFlow is an autonomous social-content agent platform. The built loop, verified in code:
**Vega** (research) → **Orion** (orchestrate/plan) → **Lyra** (`lib/agent/` graph: digest→draftPerPlatform→critique→refine→finalize)
→ **Castor** (brand-safety LLM judge, `brandSafetyScore`/verdict) → **Atlas** (publish via BullMQ)
→ **Sirius** (comment auto-reply) ┊ **Polaris** (seeding) → **Rigel** (reports, feeds back into `agent_runs.plan`).
Stack: Next.js 16 / React 19, Clerk (auth + orgs), Neon+Drizzle, BullMQ+Upstash, LangChain/LangGraph,
LLM factory (Gemini default), ImageKit, Tavily, LangSmith, MCP inward (`lib/mcp`), A2A outward (`/api/a2a`),
tamper-evident `agent_steps` hash chain, quota metering (`lib/billing`).

**Why these 23 are new.** The repo already has `docs/AGENT_FEATURE_IDEAS.md` (Mnemosyne, Echo, Chronos, Prism,
Aegis, Sentry, Pulse, Bandit, Spica, Pictor, Index, Quaestor, Vetus, Medic, Rigel Brief, Concord, Lex…). This set
**avoids re-listing those** and instead attacks the **confirmed open gaps**: review is *whole-run approve/reject only*;
**no team/workspace UI** (clerkOrgId is stored everywhere but unused in product); **no content provenance/disclosure**
(the deadline-driven P0); **no outbound automation** (only inbound Meta webhooks + single-tenant A2A); **no in-app
run/cost/quality observability**. Where an idea touches an existing codename, it is marked **extends**; otherwise **NEW**.

### New ideas at a glance

| # | Idea (codename) | Priority area | New/Extends | Lead trend |
|---|---|---|---|---|
| 1 | Provenance & AI-Disclosure Engine (**Aletheia**) | Compliance | NEW (P0) | C2PA/SynthID + EU Art.50 |
| 2 | Platform Policy/ToS Linter (**Praxis**) | Compliance | NEW | Guardrails/rule-packs |
| 3 | Agent Inbox: Accept/Edit/Respond/Ignore (**Triage**) | Approval | NEW (ext. Sentry) | Agent-Inbox HITL |
| 4 | Generative Per-Platform Preview (**TrueView**) | Platform UX | NEW | Generative UI / AG-UI |
| 5 | Glass-Box Run Inspector (**Lumen**) | Observability | NEW | Streamed reasoning + audit |
| 6 | Eval & Quality Regression Dashboard (**Vigil**) | Quality scoring | NEW (ext. Vetus) | Trace-based evals / LLM-judge |
| 7 | Cost Meter, Spend Caps & Outcome Packaging (**Tally**) | Cost/packaging | NEW (ext. Quaestor) | Usage/outcome pricing |
| 8 | Multi-Brand Workspaces (**Atrium**) | Team/agency | NEW | Multi-tenant agent ops |
| 9 | Roles & Delegated Approvals (**Praetor**) | Team | NEW | Enterprise governance |
| 10 | Collaborative Draft Review (**Forum**) | Team | NEW | HITL collaboration |
| 11 | White-Label Client Approval Portal (**Envoy**) | Agency | NEW | Approval inbox, externalized |
| 12 | Outbound Webhooks & Event Bus (**Relay**) | External automation | NEW | Agent eventing |
| 13 | Public API + n8n Node + Zapier App (**Conduit**) | External automation | NEW | Agents as nodes |
| 14 | SocialFlow MCP Server (**Gateway**) | Interop | NEW | MCP Apps (outward) |
| 15 | Inbound A2A Campaign Delegation (**Legate**) | Interop/enterprise | NEW (ext. /api/a2a) | A2A inbound |
| 16 | Per-Platform Algorithm Coach (**Cartographer**) | Publishing intel | NEW | Self-improving + RAG rule-packs |
| 17 | Format Transformer (**Protean**) | Repurposing | NEW | Structured multi-artifact output |
| 18 | Evergreen Recycler & Atomizer (**Phoenix**) | Repurposing | NEW | Content flywheel |
| 19 | Campaigns as First-Class Objects (**Meridian**) | Campaign planning | NEW | Hierarchical planning |
| 20 | Multi-Agent Strategy Debate Panel (**Senate**) | Multi-agent strategy | NEW | Supervisor + judge panel |
| 21 | Campaign Template Library (**Codex**) | Campaign planning | NEW | Plan blueprints |
| 22 | DM & Inbox Agent (**Hermes**) | Comment/reply | NEW | Conversational triage agent |
| 23 | Crisis & Brand-Risk Radar (**Bastion**) | Reply + safety | NEW | Ambient monitoring + interrupts |
| 24 | Attribution & ROI Tracker (**Compass**) | Analytics | NEW (ext. Rigel Brief) | Outcome measurement |

---

## 1 — Provenance & AI-Disclosure Engine (**Aletheia**) · *Compliance · NEW · P0*

1. **Feature:** Embed C2PA Content Credentials + watermark on AI media, set each platform's AI-label flag at publish, and keep a per-tenant disclosure ledger.
2. **User problem:** From **2 Aug 2026** EU AI Act Art. 50 mandates machine-readable marking of synthetic audio/image/video/**text**; TikTok/Meta/LinkedIn already auto-detect-and-label. Unmarked AI content = non-compliant and risks platform down-ranking.
3. **Persona:** EU/CA brands, regulated niches, agencies posting on behalf of clients.
4. **Agent behavior:** A publish-time gate stamps C2PA manifests/watermarks on Pictor/ImageKit media, sets connector AI-content flags (e.g., TikTok/Meta "AI-generated" toggle), appends a brand-configured text disclosure if policy requires, and writes an immutable ledger row per published target.
5. **UX workflow:** Per-brand "Disclosure policy" in `/settings` (jurisdiction, label style, always/never/auto); a green "Credentialed & labeled" badge on each post; an exportable compliance ledger in a new `/compliance` page.
6. **Backend/data:** New `disclosure_ledger` (postTargetId, c2paManifestHash, platformLabelApplied, jurisdiction, policyVersion); `media_assets` already has provenance (`sourceAssetId`) to mark AI-derived.
7. **Integrations:** C2PA signing lib + SynthID/watermark, ImageKit transform, each `PlatformConnector.publishNow` extended with label flags, Clerk org for policy scope.
8. **Trend:** AI-content provenance is now table-stakes — EU AI Act Art. 50 (applies 2 Aug 2026), CA SB 942, C2PA Content Credentials + platform enforcement.
9. **MVP:** Text disclosure injection + per-platform AI flag on the 3 platforms that expose it + ledger; image C2PA manifest on ImageKit assets.
10. **Stretch:** Full SynthID/C2PA 2.x signing, jurisdiction rule packs, "detect & auto-label" on imported media, regulator-ready PDF export.
11. **Files:** `lib/compliance/provenance.ts`, `lib/platforms/types.ts` + adapters (`publishNow` label flags), `worker/processors/publish.ts`, `db/schema/disclosure-ledger.ts`, `app/(dashboard)/settings/page.tsx`, new `app/(dashboard)/compliance/page.tsx`.
12. **Monetization:** High — "Compliance-ready autopilot" is a deadline-driven enterprise/EU upsell; gate ledger + jurisdiction packs to Team/Enterprise.
13. **Risks:** Platform label-API coverage is uneven; over-labeling clutters posts; C2PA stripping by platforms. Mitigate with per-platform capability gating + policy defaults.
14. **Validation:** Publish 30 AI posts across platforms; success = each carries the correct label/credential where supported and a complete ledger entry; spot-check C2PA survives upload on TikTok/LinkedIn.

## 2 — Platform Policy / ToS Linter (**Praxis**) · *Compliance · NEW*

1. **Feature:** A pre-publish linter that checks each draft against per-platform policy rule packs (banned claims, prohibited link patterns, format/length, restricted topics).
2. **User problem:** Each platform has different landmines (health "cure" claims, financial promises, outbound-link penalties, banned hashtags); violations cause shadowbans or takedowns no one notices.
3. **Persona:** Regulated niches, agencies, high-volume autonomous users.
4. **Agent behavior:** Runs alongside Castor in `finalize`; returns pass/warn/block per rule with a one-line fix, can auto-rewrite minor issues via Lyra's bounded refine, hard-blocks the rest into review.
5. **UX workflow:** Inline lint chips on each platform variant in composer/review ("LinkedIn: move link to first comment", "TikTok: avoid 'guaranteed'"); editable rule packs per org.
6. **Backend/data:** `policy_rule_packs` (platform, jurisdiction, rules jsonb), reuse `generated_content.reviewViolations`.
7. **Integrations:** LLM factory (classifier), platform capabilities, ties to Aletheia (#1) and Cartographer (#16).
8. **Trend:** Guardrails/rule-pack layers around autonomous agents; HITL gating before external comms.
9. **MVP:** 1 curated rule pack per platform + LLM classifier; warn/block surfaced in review.
10. **Stretch:** Jurisdiction packs, regulated-industry templates, learn from takedowns, community-shared packs.
11. **Files:** `lib/compliance/policy-linter.ts`, `lib/agent/nodes/finalize.ts`, `db/schema/policy-rule-packs.ts`, `app/(dashboard)/review/review-queue.tsx`, `components/composer/variant-editor.tsx`.
12. **Monetization:** Medium-high; custom rule packs = Team/Enterprise gate.
13. **Risks:** Stale rules; false blocks. Mitigate with versioned packs + tunable strictness + audit.
14. **Validation:** 100 drafts incl. known violations → ≥90% flagged correctly, <5% false-block on a clean control.

## 3 — Agent Inbox: Accept / Edit / Respond / Ignore (**Triage**) · *Approval · NEW (extends Sentry)*

1. **Feature:** Replace whole-run approve/reject with a per-item inbox implementing the four canonical HITL actions.
2. **User problem:** Today `/review` approves or rejects an *entire run*; users can't fix one bad draft, send feedback to re-draft, or snooze — so they reject good runs over one weak post.
3. **Persona:** Every active reviewer; power users running many autonomous runs.
4. **Agent behavior:** Each held draft becomes an interrupt with allowed actions: **Accept** (schedule as-is), **Edit** (inline edit → accept), **Respond** (free-text feedback → Lyra re-drafts that one item via bounded refine), **Ignore** (snooze/skip). Orion resumes per-item, reusing the idempotent `(runId, agent)` guard.
5. **UX workflow:** Keyboard-driven inbox (j/k, a/e/r/i), bulk-accept, per-item status, "respond" opens a feedback box that triggers a single-item refine.
6. **Backend/data:** `generated_content.reviewStatus` already supports held/approved/rejected; add `reviewerNote` + per-item resume; `agent_steps.control` already encodes pause.
7. **Integrations:** Orchestrator resume path, Lyra single-item refine, notifications.
8. **Trend:** LangChain Agent Inbox — Accept/Edit/Respond/Ignore over `interrupt` is the emerging standard for HITL agents.
9. **MVP:** Per-draft Accept/Edit/Reject + Respond-to-redraft; replace run-level buttons.
10. **Stretch:** Ignore/snooze with SLA, bulk ops, mobile push approvals, "approve-by" auto-decision.
11. **Files:** `app/(dashboard)/review/review-queue.tsx`, `app/(dashboard)/review/actions.ts`, `lib/agents/orchestrator.ts` (per-item resume), `lib/repos/generated-content.ts`, `lib/agents/lyra/index.ts`.
12. **Monetization:** Medium directly; major retention/usability unlock that makes higher-autonomy tiers safe to adopt.
13. **Risks:** Partial-run resume races; stuck items. Mitigate with idempotency guard + timeouts.
14. **Validation:** Run with 5 held drafts; edit 1, respond-redraft 1, accept 2, reject 1 → exactly the accepted items publish, the redrafted one re-enters review, `agent_steps` shows no duplicates.

## 4 — Generative Per-Platform Preview (**TrueView**) · *Platform UX · NEW*

1. **Feature:** Render true platform-native previews — X thread, IG carousel, LinkedIn card, TikTok caption+script, Pinterest pin — instead of a plain textarea.
2. **User problem:** Users approve text blind to how it actually looks; truncation, broken threads, and bad carousels only surface after publishing.
3. **Persona:** Every reviewer/composer user.
4. **Agent behavior:** The agent streams typed UI per platform (not text), overlaying live char/format-limit compliance from `PlatformCapabilities` and Cartographer (#16) hints.
5. **UX workflow:** Tabbed native previews in composer and the Agent Inbox; toggle light/dark, mobile/desktop; "fix to fit" button.
6. **Backend/data:** Pure render from `post_targets.body` + `platformOptions` + capabilities; no new tables.
7. **Integrations:** Generative-UI streaming (AI SDK-style typed parts), platform capability model.
8. **Trend:** Generative UI / AG-UI — agents stream structured UI; the chat box is no longer the unit of review.
9. **MVP:** Static native previews for X/IG/LinkedIn driven by capabilities + char counts.
10. **Stretch:** Streamed generative previews, carousel/thread builders, video-thumbnail mock, A/B preview.
11. **Files:** `components/composer/*` (new `platform-preview/*`), `app/(dashboard)/review/review-queue.tsx`, `lib/platforms/types.ts` (capabilities for preview).
12. **Monetization:** Medium; strong demo/conversion asset, reduces failed posts.
13. **Risks:** Preview drift vs real platform rendering. Mitigate by binding to capability data + periodic calibration.
14. **Validation:** Preview 50 posts; success = char/format warnings match actual publish outcomes (no surprise truncation/thread breaks).

## 5 — Glass-Box Run Inspector (**Lumen**) · *Observability · NEW*

1. **Feature:** A user-facing run timeline: every agent step with input/summary/handoff, latency, token+cost, LangSmith deep-link, and a tamper-evident **hash-chain verified** badge.
2. **User problem:** Autonomous runs are a black box; when output is wrong or a run stalls, users (and support) can't see what happened — fueling the "agent washing" distrust.
3. **Persona:** Power users, agencies, operator/support.
4. **Agent behavior:** Reads `agent_runs`/`agent_steps`; verifies the SHA-256 chain (`lib/audit/run-audit.ts`); optionally streams live step events during a run.
5. **UX workflow:** `/runs/[runId]` timeline (Vega→Lyra→Castor→Atlas…), expandable step cards, "verify integrity" check, "re-run from step", LangSmith link.
6. **Backend/data:** All present — `agent_runs`, `agent_steps` (hash chain, control), `langsmithRunId`.
7. **Integrations:** LangSmith (`lib/observability/langsmith.ts`), audit verifier, optional WS streaming.
8. **Trend:** Observability is the #1 production agent investment (LangChain State of Agent Engineering); tamper-evident audit is enterprise governance.
9. **MVP:** Read-only timeline + per-step summary + integrity badge + LangSmith link.
10. **Stretch:** Live-streamed reasoning (AG-UI), cost/latency charts, re-run-from-step, share link.
11. **Files:** new `app/(dashboard)/runs/[runId]/page.tsx`, `components/runs/*`, `lib/repos/agent-runs.ts`, `lib/audit/run-audit.ts`, `lib/observability/langsmith.ts`.
12. **Monetization:** Medium; trust/transparency feature, Team/Enterprise audit export.
13. **Risks:** Exposing raw prompts/PII. Mitigate with redaction + role-gated detail.
14. **Validation:** Tamper a step row → integrity badge fails; normal run shows every hop with accurate timing/cost.

## 6 — Eval & Quality Regression Dashboard (**Vigil**) · *Quality scoring · NEW (extends Vetus)*

1. **Feature:** Productize the existing `evals/brand-safety` script into a tracked golden-set + dashboard that catches quality regressions when prompts/models change.
2. **User problem:** At autonomous scale, content quality drifts silently after a prompt tweak or model swap; nobody notices until engagement drops.
3. **Persona:** Operator/admin; Pro users wanting a quality SLA.
4. **Agent behavior:** LLM-as-judge scores drafts on a rubric (hook, clarity, on-brand, CTA, platform-fit); aggregates `brandSafetyScore`, block rate, refine-loop rate over time; runs the golden set on each prompt/model change and flags regressions.
5. **UX workflow:** Quality dashboard (score trend by platform/brand, block/refine rates), "run eval suite" button, regression alerts.
6. **Backend/data:** `generated_content.brandSafetyScore` exists; add `eval_runs`/`eval_cases`; reuse `evals/brand-safety/run.ts`.
7. **Integrations:** LLM factory (judge), LangSmith (Align-Evals style on prod traces), CI hook.
8. **Trend:** Trace-based evals / LLM-as-judge on production runs; quality is the top blocker to agent adoption.
9. **MVP:** Persist per-draft scores + a dashboard trend + manual golden-set run.
10. **Stretch:** Auto-eval gate in CI on prompt/model PRs, per-niche rubrics, calibrate judge against real engagement.
11. **Files:** `evals/brand-safety/run.ts`, `lib/evals/*`, `db/schema/eval-runs.ts`, `lib/agents/rigel/queries.ts`, new `app/(dashboard)/quality/page.tsx`.
12. **Monetization:** Medium (operator margin protection) + Pro "quality assurance" tier.
13. **Risks:** Judge bias/reward-hacking. Mitigate with human spot-checks + calibration.
14. **Validation:** Inject a deliberately worse prompt → suite flags a score regression before merge.

## 7 — Cost Meter, Spend Caps & Outcome Packaging (**Tally**) · *Cost/packaging · NEW (extends Quaestor)*

1. **Feature:** Per-run/per-org token-and-dollar ledger, customer spend caps, prompt caching, and a "price per published on-brand post" packaging option.
2. **User problem:** Multi-agent runs can quietly rack up cost; 78% of buyers report surprise AI charges — bill-shock kills trust, and flat subscription erodes margin.
3. **Persona:** Operator (margin) + cost-conscious customers/agencies.
4. **Agent behavior:** A metering wrapper on the LLM factory records tokens/cost per `agent_step`; orchestrator consults budget before each step (soft-warn → downgrade model → hard-stop); enables prompt caching on stable system prompts.
5. **UX workflow:** Cost column in the run inspector (#5), per-org budget + spend-cap settings, usage dashboard, "this run cost $X" summary; optional outcome metric "published on-brand posts."
6. **Backend/data:** Add cost fields to `agent_steps`; model pricing table; `usage` table already meters; add `spend_caps`.
7. **Integrations:** `lib/llm/factory.ts` + providers, LangSmith token data, Clerk entitlements, prompt caching.
8. **Trend:** Usage/outcome-based pricing (hybrid 43%→61% by end-2026) + spend caps to prevent bill-shock.
9. **MVP:** Record tokens/est-cost per step+run; show in run view; hard per-run cap.
10. **Stretch:** Auto model-downgrade near cap, org/period budgets + alerts, outcome metering & billing, margin dashboard.
11. **Files:** `lib/llm/factory.ts`, `lib/llm/providers/*`, `lib/agents/orchestrator.ts`, `db/schema/agent-steps.ts`, `lib/billing/entitlements.ts`, `app/(dashboard)/billing/page.tsx`.
12. **Monetization:** High — protects gross margin, powers usage/outcome tiers + overage billing.
13. **Risks:** Cross-provider cost inaccuracy; over-aggressive caps. Mitigate with maintained pricing table + soft-warn.
14. **Validation:** Run a known pipeline; recorded tokens match LangSmith within margin; a low cap halts cleanly with a clear reason.

## 8 — Multi-Brand Workspaces (**Atrium**) · *Team/agency · NEW*

1. **Feature:** Turn the already-stored `clerkOrgId` into real workspaces: multiple brands per org, a brand switcher, per-brand profiles/accounts/voice, and agency rollups.
2. **User problem:** Agencies/teams manage many brands but the product is single-user; `clerkOrgId` is captured everywhere yet has **no UI**, so brands collide in one namespace.
3. **Persona:** Agencies, multi-brand marketers, social teams.
4. **Agent behavior:** All agents already accept `clerkOrgId` in `AgentContext`; scope runs, content, accounts, reports, and brand profiles by an explicit `brandId` within the org.
5. **UX workflow:** Brand switcher in the topbar; per-brand dashboards; an agency rollup showing all brands' health/queues; per-brand settings.
6. **Backend/data:** New `brands` (orgId, name, …); add `brandId` FK to posts/accounts/runs/reports/brand_profiles; `brand_profiles.clerkOrgId` already exists.
7. **Integrations:** Clerk orgs/memberships, all repos (add brand scope), middleware.
8. **Trend:** Multi-tenant agent operations — Fortune-500-scale agent governance presumes org/tenant isolation.
9. **MVP:** `brands` table + switcher + brand-scoped dashboard/accounts/runs for one org.
10. **Stretch:** Agency rollup analytics, cross-brand templates, per-brand billing, brand-level data isolation.
11. **Files:** `db/schema/brands.ts` (+ `brandId` migrations), `lib/repos/*` (scope), `lib/clerk.ts`, `components/shared/topbar.tsx`, dashboard layout.
12. **Monetization:** High — per-brand pricing and an Agency tier; the clearest path to higher ACV.
13. **Risks:** Migration of existing single-tenant rows; query-scope leaks. Mitigate with a default brand backfill + scoped repo tests.
14. **Validation:** Two brands in one org → content/accounts/runs never cross-leak; switcher isolates every list.

## 9 — Roles & Delegated Approvals (**Praetor**) · *Team · NEW*

1. **Feature:** RBAC (owner/manager/creator/approver/viewer) plus approval routing and "approve-by" SLAs.
2. **User problem:** Teams need separation of duties — creators draft, approvers sign off — but everyone currently has full power; `reviewedBy` exists but no roles enforce it.
3. **Persona:** Marketing teams, agencies with client sign-off.
4. **Agent behavior:** When a run pauses for approval, it routes to the assigned approver(s); auto-decision on SLA per policy; records who approved each item.
5. **UX workflow:** Org members page with roles; per-brand approver assignment; "needs your approval" filter in the Agent Inbox (#3); audit of approvals.
6. **Backend/data:** `memberships` (orgId, userId, role, brandScope), approval-routing config; `generated_content.reviewedBy` already present.
7. **Integrations:** Clerk org memberships, orchestrator pause/resume, notifications.
8. **Trend:** Enterprise governance — least-privilege identity + human-oversight (EU AI Act Art. 14).
9. **MVP:** 3 roles + approver-only approve in the inbox + reviewedBy audit.
10. **Stretch:** Per-brand approver matrices, approve-by auto-rules, delegated/temporary approvers, full audit export.
11. **Files:** `db/schema/memberships.ts`, `lib/clerk.ts` (role guard), `app/(dashboard)/review/actions.ts`, new `app/(dashboard)/team/page.tsx`.
12. **Monetization:** High — classic Team/Enterprise gate.
13. **Risks:** Permission gaps/over-restriction. Mitigate with a tested permission matrix + owner override.
14. **Validation:** A creator cannot approve; an approver can; every approval logs the user — verified end-to-end.

## 10 — Collaborative Draft Review (**Forum**) · *Team · NEW*

1. **Feature:** Internal comment threads, @mentions, and change requests on drafts inside the Agent Inbox.
2. **User problem:** Teams review content in Slack/email/screenshots; feedback is detached from the draft and lost.
3. **Persona:** Content teams, agency↔client.
4. **Agent behavior:** Optional — an agent can summarize a thread into a single revision instruction and trigger Lyra's refine ("apply the team's feedback").
5. **UX workflow:** Comment sidebar per draft, @mention to notify, resolve/unresolve, "send thread to agent to revise."
6. **Backend/data:** `draft_comments` (contentId, authorId, body, resolved, parentId).
7. **Integrations:** Clerk users, notifications, Lyra refine.
8. **Trend:** HITL collaboration — humans steering agents collaboratively, not one-shot approval.
9. **MVP:** Comments + @mention + resolve on a draft.
10. **Stretch:** Agent-summarized feedback→refine, Slack mirror, suggestion mode.
11. **Files:** `db/schema/draft-comments.ts`, `lib/repos/draft-comments.ts`, `app/(dashboard)/review/review-queue.tsx`, `components/review/comment-thread.tsx`.
12. **Monetization:** Medium — Team-plan stickiness.
13. **Risks:** Notification noise. Mitigate with digest + mention-only defaults.
14. **Validation:** Two users comment/mention/resolve on one draft; mentions notify; "revise from thread" produces a coherent edit.

## 11 — White-Label Client Approval Portal (**Envoy**) · *Agency · NEW*

1. **Feature:** A magic-link external portal where an agency's client approves/edits/comments on a campaign's drafts without a paid seat.
2. **User problem:** Agencies need client sign-off but won't buy seats for clients; today there's no external review surface.
3. **Persona:** Agencies and their clients.
4. **Agent behavior:** Surfaces held drafts (per brand/campaign) to an authenticated-by-link client; their Accept/Edit/Respond maps to the same orchestrator resume as the internal inbox (#3).
5. **UX workflow:** "Share for approval" generates a branded link; client sees native previews (#4), approves/edits/comments; agency sees status.
6. **Backend/data:** `approval_links` (token, brandId, runId/campaignId, scope, expiry); reuse review actions.
7. **Integrations:** Tokened access (no Clerk seat), email, Multi-Brand (#8), Campaigns (#19).
8. **Trend:** Externalized approval inbox — HITL gate as a shareable, brandable surface.
9. **MVP:** Read+approve/reject by link for one campaign, white-labeled.
10. **Stretch:** Client edits/comments, per-client branding, audit trail, scheduled reminders.
11. **Files:** new `app/(client)/approve/[token]/page.tsx`, `db/schema/approval-links.ts`, `app/(dashboard)/review/actions.ts`, `lib/repos/approval-links.ts`.
12. **Monetization:** High — a headline Agency-tier differentiator; few competitors do client portals well.
13. **Risks:** Link security/leakage. Mitigate with scoped, expiring, revocable tokens + rate limits.
14. **Validation:** Client link approves only its scope, expires correctly, cannot access other brands; approval resumes the run.

## 12 — Outbound Webhooks & Event Bus (**Relay**) · *External automation · NEW*

1. **Feature:** Emit lifecycle events (`post.published`, `run.awaiting_approval`, `publish.failed`, `comment.lead_detected`, `report.ready`) to user-configured webhook endpoints.
2. **User problem:** SocialFlow only receives webhooks (Meta) and can't push events out, so it can't plug into users' n8n/Zapier/Make/Slack automations.
3. **Persona:** Ops-savvy teams, agencies, automation builders.
4. **Agent behavior:** A reliable dispatcher fires signed, retried webhook deliveries on domain events from the queue lifecycle.
5. **UX workflow:** `/settings/webhooks` to add endpoints, pick events, see delivery logs + retries; HMAC secret per endpoint.
6. **Backend/data:** `webhook_endpoints`, `webhook_deliveries`; emit from `worker/processors/*` and orchestrator transitions; reuse the ledger pattern for at-least-once delivery.
7. **Integrations:** BullMQ (a `webhook` queue), HMAC signing.
8. **Trend:** Agent eventing — agents as event producers in a wider automation graph.
9. **MVP:** 4 events + signed delivery + retry + log.
10. **Stretch:** Event filtering, replay, per-brand routing, transform templates.
11. **Files:** `db/schema/webhook-endpoints.ts`, `lib/queue/queues.ts` (+Webhook), `worker/processors/webhook.ts`, hooks in `publish.ts`/`orchestrator.ts`, `app/(dashboard)/settings/webhooks/page.tsx`.
12. **Monetization:** Medium-high; an automation/Pro+ capability and a retention moat.
13. **Risks:** Delivery reliability, SSRF to internal hosts. Mitigate with retries/DLQ + egress allowlist + signing.
14. **Validation:** Trigger each event → endpoint receives a correctly-signed payload; a failing endpoint retries then dead-letters.

## 13 — Public API + n8n Node + Zapier App (**Conduit**) · *External automation · NEW*

1. **Feature:** An API-key REST surface (start run, fetch reports, push a source, list posts) plus a published n8n community node and a Zapier app.
2. **User problem:** Users want SocialFlow as a step in their own workflows ("when a blog publishes → repurpose → schedule"), but there's no programmatic, API-key access (only Clerk-session routes + single-tenant A2A).
3. **Persona:** Developers, ops teams, technical agencies.
4. **Agent behavior:** API-key requests invoke the same `Orion.startRun`/Rigel/Atlas paths with per-key scoping and quotas.
5. **UX workflow:** API-keys page (create/scope/revoke, usage), docs, official n8n/Zapier listings.
6. **Backend/data:** `api_keys` (hashed, scopes, brandId, rate limit); reuse `/api/agents/run`, `reports`, `generate`.
7. **Integrations:** n8n node + Zapier app wrapping the REST API; Relay (#12) for triggers.
8. **Trend:** Agents exposed as nodes/tools in automation platforms (the Zapier/n8n ecosystem).
9. **MVP:** API keys + 4 REST endpoints + a Zapier "Start run / New report" trigger-action pair.
10. **Stretch:** Full OpenAPI, n8n node, per-key analytics, OAuth client-credentials.
11. **Files:** `db/schema/api-keys.ts`, `app/api/v1/*` (key-auth variants), `lib/auth/api-key.ts`, `app/(dashboard)/settings/api-keys/page.tsx`, `integrations/n8n/*`.
12. **Monetization:** High — a metered API tier; expands TAM to builders.
13. **Risks:** Abuse, key leakage. Mitigate with hashed keys, scopes, per-key rate limits.
14. **Validation:** A key with "run" scope starts a run and is rate-limited; revoked keys 401; a Zapier zap fires end-to-end.

## 14 — SocialFlow MCP Server (**Gateway**) · *Interop · NEW*

1. **Feature:** Expose SocialFlow capabilities as an **MCP server** (the inverse of the existing inward MCP client) so external agents (Claude, Cursor, ChatGPT) can "draft a post", "schedule", "get analytics".
2. **User problem:** AI-native users live in their assistant; they want to command SocialFlow from there, not context-switch.
3. **Persona:** AI power users, prosumers, developers.
4. **Agent behavior:** Publishes MCP tools (`create_draft`, `schedule_post`, `get_report`, `start_run`) backed by the same services, behind per-tenant auth and HITL (high-impact actions still gate to the inbox).
5. **UX workflow:** "Connect to your AI assistant" page issuing an MCP server URL + token; actions appear in the user's MCP client; approvals still route to SocialFlow's inbox.
6. **Backend/data:** Reuse `lib/mcp/rpc.ts` patterns for server side; map tools→services; auth via API keys (#13).
7. **Integrations:** MCP transport (stateless 2026), Aletheia/Castor gates remain in force.
8. **Trend:** MCP Apps / MCP server roadmap — being a tool for other agents.
9. **MVP:** Read tools (`get_report`, `list_posts`) + `create_draft` (lands in review).
10. **Stretch:** `schedule_post`/`start_run` with HITL, MCP Apps in-client UI, tool search.
11. **Files:** new `app/api/mcp/route.ts`, `lib/mcp/server.ts`, reuse `lib/mcp/rpc.ts`, `lib/auth/api-key.ts`.
12. **Monetization:** Medium; differentiator and acquisition channel; Pro+ gate.
13. **Risks:** Prompt-injection driving real account actions. Mitigate by keeping publish behind HITL + least-privilege tokens.
14. **Validation:** From an MCP client, `create_draft` produces a held draft visible in review; write actions require approval.

## 15 — Inbound A2A Campaign Delegation (**Legate**) · *Interop/enterprise · NEW (extends /api/a2a)*

1. **Feature:** Productize the existing single-tenant `/api/a2a` into multi-tenant inbound A2A with a discoverable Agent Card, so enterprise marketing-ops agents can delegate campaigns to SocialFlow's roster.
2. **User problem:** Enterprises run their own orchestration agents and want to *call* SocialFlow as a specialist content agent; today A2A is bound to one hard-coded tenant/token.
3. **Persona:** Enterprise marketing-ops, platform partners.
4. **Agent behavior:** Authenticated A2A `message/send` starts a scoped campaign run; `tasks/get` returns live status; the Agent Card advertises skills (research, draft, schedule, report).
5. **UX workflow:** Enterprise admin issues scoped A2A credentials, sees inbound delegated runs in the run inspector (#5).
6. **Backend/data:** Multi-tenant key resolution replacing `A2A_TENANT_ID`; map runs to caller; reuse `lib/a2a/*`.
7. **Integrations:** Existing `lib/a2a/protocol.ts` + `agent-card.ts`, Multi-Brand (#8), RBAC (#9).
8. **Trend:** A2A v1.0, 150+ orgs, Linux Foundation — complementary to MCP, native in major clouds.
9. **MVP:** Multi-tenant inbound auth + scoped run + status; published Agent Card.
10. **Stretch:** Capability negotiation, per-skill scopes, signed task results, partner directory.
11. **Files:** `app/api/a2a/route.ts`, `lib/a2a/protocol.ts`, `lib/a2a/agent-card.ts`, `lib/auth/api-key.ts`.
12. **Monetization:** High (enterprise) but later-stage; partner/Enterprise tier.
13. **Risks:** Premature before PMF; inbound marketplace is "hold". Keep to known partners first.
14. **Validation:** Two tenants' A2A keys start isolated runs; `tasks/get` returns each caller's status only.

## 16 — Per-Platform Algorithm Coach (**Cartographer**) · *Publishing intelligence · NEW*

1. **Feature:** A knowledge-backed agent that restructures each draft to current platform best-practices and learns which patterns drive reach.
2. **User problem:** Generic captions ignore platform "meta" (X hook+thread, LinkedIn hook+whitespace+no outbound links, TikTok 2-second hook script, IG carousel cover, Pinterest keyword titles); reach suffers.
3. **Persona:** Growth-focused creators, agencies, all autonomous users.
4. **Agent behavior:** Applies versioned per-platform rule packs during/after `draftPerPlatform`, suggests structure (thread split, hook, CTA placement, first-comment link), and biases future suggestions from Rigel's reach data.
5. **UX workflow:** "Optimized for LinkedIn ✓" chips with rationale, one-click restructure, a per-platform "what works now" panel.
6. **Backend/data:** `platform_playbooks` (platform, version, heuristics jsonb); learns from `post_targets.metrics`.
7. **Integrations:** LLM factory, platform capabilities, Rigel queries, ties to Praxis (#2) and TrueView (#4).
8. **Trend:** Self-improving agents + RAG-grounded, updatable domain knowledge (vs. static prompts).
9. **MVP:** Curated playbook per platform applied in drafting + rationale chips.
10. **Stretch:** Reach-driven learning loop, A/B of structures, niche-specific playbooks, auto-update from performance.
11. **Files:** `lib/agent/nodes/draft-per-platform.ts` (or new `enrich` node), `db/schema/platform-playbooks.ts`, `lib/agents/rigel/queries.ts`, `components/composer/variant-editor.tsx`.
12. **Monetization:** High — measurable reach lift; flagship optimization tier.
13. **Risks:** Platform rules shift fast; over-formulaic output. Mitigate with versioned packs + variety constraints.
14. **Validation:** Restructure 50 posts per playbook; success = higher median reach vs. baseline over 4 weeks, all within platform limits.

## 17 — Format Transformer (**Protean**) · *Repurposing · NEW*

1. **Feature:** Turn one concept into platform-**native artifacts** (X thread, IG carousel frames, short-video script, LinkedIn article, Pinterest pin), not just length-trimmed captions.
2. **User problem:** `draftPerPlatform` currently produces one caption per platform; users still manually convert a concept into the *right format* for each surface.
3. **Persona:** Creators repurposing across formats; agencies.
4. **Agent behavior:** Extends Lyra to emit typed, structured artifacts per platform (array of thread tweets, array of carousel slides w/ Pictor images, a scripted hook→beats→CTA for video) from a shared `ContentState`.
5. **UX workflow:** Choose target formats; see a campaign board of native artifacts; accept/edit per artifact.
6. **Backend/data:** `generated_content.kind` already has variation/post/caption; add structured `artifact` jsonb + `campaignId` (ties to #19).
7. **Integrations:** Lyra graph, Pictor (visuals), TrueView (#4) previews.
8. **Trend:** One input → many typed artifacts (structured multi-output agent pipelines).
9. **MVP:** Thread + carousel + short-video-script generation from one concept.
10. **Stretch:** Auto carousel images, video storyboard, format A/B, evergreen re-formatting (#18).
11. **Files:** `lib/agent/state.ts`, `lib/agent/nodes/draft-per-platform.ts`, `lib/agent/prompts.ts`, `db/schema/generated-content.ts`, `components/composer/*`.
12. **Monetization:** High — "1 idea → a week of native content"; meter by artifacts.
13. **Risks:** Format quality variance. Mitigate with per-format rubric (Vigil #6) + previews.
14. **Validation:** 10 concepts → each yields a valid thread, carousel, and script that pass format checks and a quality bar.

## 18 — Evergreen Recycler & Atomizer (**Phoenix**) · *Repurposing · NEW*

1. **Feature:** Continuously recycle top-performing past posts and atomize long content into a steady fill-the-calendar queue.
2. **User problem:** Best content is posted once and forgotten; calendars have gaps; users re-do work they've already done.
3. **Persona:** High-cadence creators, agencies keeping channels alive.
4. **Agent behavior:** Rigel surfaces evergreen winners; an agent re-angles/refreshes them (new hook, updated stats) and atomizes long sources into many posts, queueing into open calendar slots (with Chronos-style timing) under brand/quality gates.
5. **UX workflow:** "Evergreen queue" with recycle candidates + freshness score; "atomize this" on a long post/source; auto-fill empty slots toggle.
6. **Backend/data:** Reuse `generated_content`, `post_targets.metrics`; add `recycle_candidates`/`campaignId`.
7. **Integrations:** Rigel, Atlas scheduling, Lyra refine, originality check.
8. **Trend:** Content flywheel / closed-loop reuse driven by performance data.
9. **MVP:** Surface top-5 evergreen winners + one-click "refresh & reschedule."
10. **Stretch:** Auto fill-gaps, atomize long sources, dedupe/cool-down so it doesn't repeat too soon.
11. **Files:** `lib/agents/rigel/queries.ts`, `lib/agents/atlas/index.ts`, `db/schema/generated-content.ts`, `app/(dashboard)/calendar/page.tsx`.
12. **Monetization:** Medium-high; "never run out of content" retention hook.
13. **Risks:** Repetition fatigue / stale facts. Mitigate with cool-down windows + freshness refresh + variety.
14. **Validation:** Seed 20 past posts → recycler proposes sensible refreshes with no near-duplicate reposts inside the cool-down.

## 19 — Campaigns as First-Class Objects (**Meridian**) · *Campaign planning · NEW*

1. **Feature:** A `campaigns` entity grouping runs/posts/targets toward a goal, with a theme, date range, KPI, and per-campaign ROI reporting.
2. **User problem:** Users think in campaigns ("launch in 3 weeks") but the product only does one-off runs/posts — there's no campaign layer to plan or measure against.
3. **Persona:** Marketers, agencies, anyone running launches.
4. **Agent behavior:** Orion plans a campaign (pillars, cadence, platform mix) as a set of dated runs; Rigel rolls up performance per campaign vs. its KPI; feed-forward adjusts remaining slots.
5. **UX workflow:** "New campaign" wizard (goal/dates/KPI/pillars) → campaign board of planned runs/posts → a campaign analytics view.
6. **Backend/data:** New `campaigns` (brandId, goal, kpi, startsAt/endsAt, pillars jsonb); add `campaignId` to posts/runs/generated_content/reports.
7. **Integrations:** Orchestrator planning, Rigel queries, calendar, ties to #17/#18/#21/#24.
8. **Trend:** Hierarchical agentic planning (goal → plan → steps) with measurable objectives.
9. **MVP:** Create a campaign, attach runs/posts, see grouped performance.
10. **Stretch:** Goal-driven auto-plan, pacing alerts, milestones, campaign templates (#21).
11. **Files:** `db/schema/campaigns.ts`, `lib/repos/campaigns.ts`, `lib/agents/orchestrator.ts`, `lib/agents/rigel/queries.ts`, new `app/(dashboard)/campaigns/*`.
12. **Monetization:** High — anchors the strategy/top tier; the backbone for ROI selling.
13. **Risks:** Scope creep across many features. Mitigate by shipping the entity + grouping first, planning later.
14. **Validation:** Create a campaign, attach 3 runs → analytics aggregates only its posts and measures against the KPI.

## 20 — Multi-Agent Strategy Debate Panel (**Senate**) · *Multi-agent strategy · NEW*

1. **Feature:** Before a campaign, run a panel of specialist strategist personas (growth, brand, conversion, audience) that independently propose, then a synthesizer converges on a content strategy.
2. **User problem:** Single-shot AI plans are bland and one-dimensional; users want a *considered* strategy, not one model's first idea.
3. **Persona:** Strategists, agencies, premium users.
4. **Agent behavior:** Supervisor fans out N strategist personas in parallel (each with a distinct lens + the niche/Rigel data), a judge scores proposals, a synthesizer merges the best into pillars/angles/cadence written to `agent_runs.plan`.
5. **UX workflow:** "Generate strategy" → see each strategist's take + the synthesized recommendation + rationale; edit and accept into a campaign (#19).
6. **Backend/data:** Reuse `agent_runs.plan`; persist panel transcript in `agent_steps.summary`.
7. **Integrations:** Orchestrator parallel fan-out, LLM factory, Rigel context, Spica competitor data (if built).
8. **Trend:** Supervisor + parallel fan-out + judge panel — the default multi-agent pattern.
9. **MVP:** 3 personas + synthesizer producing a pillar/cadence plan shown with rationale.
10. **Stretch:** Debate rounds (critique each other), data-grounded personas from real audience, score-vs-outcome calibration.
11. **Files:** `lib/agents/strategy/*` (or Orion mode), `lib/agents/orchestrator.ts`, `lib/agent/prompts.ts`, `app/(dashboard)/campaigns/*`.
12. **Monetization:** High — a premium "AI strategy team" headline; metered by strategy runs.
13. **Risks:** Cost/latency, confident-but-generic output. Mitigate with caps (Tally #7) + grounding in real data + judge gate.
14. **Validation:** For a sample niche, the panel yields a strategy that respects pillar ratios/cadence and beats a single-shot plan in blind user rating.

## 21 — Campaign Template Library (**Codex**) · *Campaign planning · NEW*

1. **Feature:** Pre-built multi-week campaign blueprints (product launch, webinar, evergreen authority, seasonal/holiday, re-engagement) instantiated as a plan of runs.
2. **User problem:** Blank-page paralysis; users don't know how to structure a campaign.
3. **Persona:** SMBs, new users, agencies standardizing delivery.
4. **Agent behavior:** Selecting a template seeds a campaign (#19) with dated runs, pillar mix, and per-platform cadence that Orion fills with on-niche content.
5. **UX workflow:** Template gallery → pick → customize dates/goal → generates the campaign board.
6. **Backend/data:** `campaign_templates` (blueprint jsonb); instantiates `campaigns` + planned runs.
7. **Integrations:** Meridian (#19), Orion planning, calendar.
8. **Trend:** Reusable plan blueprints / agent "recipes."
9. **MVP:** 3 built-in templates → instantiate a campaign with planned runs.
10. **Stretch:** Custom/savable templates, agency template sharing, niche-tuned blueprints, marketplace.
11. **Files:** `db/schema/campaign-templates.ts`, `lib/agents/orchestrator.ts`, `app/(dashboard)/campaigns/new/page.tsx`.
12. **Monetization:** Medium-high; quick activation win + agency template sharing as a Team feature.
13. **Risks:** One-size-fits-all blandness. Mitigate with niche customization + editable plans.
14. **Validation:** Instantiate "product launch" → produces a coherent multi-week plan with correct pillar mix and schedulable runs.

## 22 — DM & Inbox Agent (**Hermes**) · *Comment/reply · NEW*

1. **Feature:** Extend engagement from public comments to **direct messages** (where the platform API allows): triage, FAQ auto-reply, and lead escalation.
2. **User problem:** High-intent conversations happen in DMs, not comments; brands miss leads and let DMs rot. Engagement today is comment-only (`comment_events`).
3. **Persona:** Creators/SMBs selling via DMs, agencies.
4. **Agent behavior:** Classifies inbound DMs (lead/question/spam/support), auto-answers known FAQs in brand voice under strict guardrails, escalates leads/complaints to a human inbox, respects cooldowns/caps.
5. **UX workflow:** A unified Engagement Inbox with DM + comment lanes (Leads / Needs you / Handled / Suppressed), suggested replies, one-click send/edit/escalate.
6. **Backend/data:** New `dm_events` (mirror `comment_events`), FAQ/knowledge store; reuse auto-reply slots/cooldowns.
7. **Integrations:** Platform DM APIs (IG/FB/Discord first), LLM factory, Castor/Praxis gates.
8. **Trend:** Goal-bounded conversational triage agents with HITL escalation (not open chat).
9. **MVP:** DM ingestion + classify + FAQ auto-reply + lead escalation for one platform.
10. **Stretch:** Multi-turn memory per contact, CRM/Slack handoff, lead scoring + sequences, multilingual.
11. **Files:** `worker/processors/dm-poll.ts`, `db/schema/dm-events.ts`, `lib/auto-reply/*`, `lib/platforms/types.ts` (DM capability), `app/(dashboard)/inbox/page.tsx`.
12. **Monetization:** High — "turn DMs into leads"; Pro/Team gate, metered AI replies.
13. **Risks:** DM API access limits; reputational harm from bad auto-replies. Mitigate with conservative auto-handle thresholds + escalate-on-uncertainty + Castor.
14. **Validation:** 200 labeled DMs → ≥85% precision on lead/complaint; zero auto-replies to complaints in a shadow run.

## 23 — Crisis & Brand-Risk Radar (**Bastion**) · *Reply + safety · NEW*

1. **Feature:** Detect negative-sentiment/volume spikes across comments/mentions and **auto-pause scheduled posts** during a brewing crisis, alerting the team.
2. **User problem:** Autonomous posting during a PR crisis (a viral complaint, a bad-news moment) is tone-deaf and amplifies damage; nobody's watching 24/7.
3. **Persona:** Brands/agencies protecting reputation; anyone on full-auto.
4. **Agent behavior:** Continuously scores incoming `comment_events`/mentions for sentiment+volume anomalies; on threshold breach it pauses pending publishes (sets run/target hold via the existing pause mechanism) and notifies approvers (#9) with a summary.
5. **UX workflow:** A brand-health banner ("Posting paused — negative spike detected"), an incident card (what spiked, sample comments), "resume" / "hold all" controls.
6. **Backend/data:** Sentiment/volume rollups over `comment_events`; `incidents` table; reuse `agent_steps.control` pause + Atlas hold.
7. **Integrations:** Comment ingestion, LLM/sentiment, orchestrator pause, notifications, Relay (#12) for alerting.
8. **Trend:** Ambient monitoring agents + run interrupts as a safety reflex (HITL on high-impact moments).
9. **MVP:** Sentiment-spike detection on one platform → pause scheduled posts + alert.
10. **Stretch:** Cross-platform mention monitoring, auto-draft holding-statement, severity tiers, auto-resume on cooldown.
11. **Files:** `worker/processors/comment-poll.ts`, `lib/agents/sirius/*`, `db/schema/incidents.ts`, `lib/agents/atlas/index.ts` (hold), `app/(dashboard)/dashboard/page.tsx`.
12. **Monetization:** Medium-high; a trust/peace-of-mind feature for Team/Enterprise.
13. **Risks:** False alarms pausing good runs; missed real crises. Mitigate with tunable thresholds + human confirm + clear resume.
14. **Validation:** Replay a known negative-spike window → radar detects it, pauses scheduled posts, alerts; a normal day triggers no pause.

## 24 — Attribution & ROI Tracker (**Compass**) · *Analytics · NEW (extends Rigel Brief)*

1. **Feature:** UTM tagging on published links + optional conversion webhooks to attribute signups/revenue to posts/campaigns, so Rigel reports **ROI**, not just engagement.
2. **User problem:** Engagement metrics don't prove business value; users (and their bosses/clients) can't tie posts to signups or revenue, so they can't justify spend.
3. **Persona:** B2B marketers, agencies reporting to clients, growth teams.
4. **Agent behavior:** Auto-appends per-post UTM params at publish, ingests conversion events from a webhook/pixel, and joins clicks→conversions back to the post/campaign for Rigel to narrate.
5. **UX workflow:** ROI column on campaign analytics; per-post "clicks → conversions → value"; a "best ROI angles" insight in the Rigel brief.
6. **Backend/data:** `link_clicks`, `conversions` (postTargetId/campaignId, value); extend `reports.data` with ROI; `campaignId` join (#19).
7. **Integrations:** UTM builder in Atlas publish, inbound conversion webhook (Relay-style), Rigel queries.
8. **Trend:** Outcome measurement — closing the analysis→business-value gap that engagement-only dashboards miss.
9. **MVP:** Auto-UTM on links + a conversion webhook + ROI rollup per campaign.
10. **Stretch:** Multi-touch attribution, revenue-weighted recommendations, client-facing ROI export.
11. **Files:** `lib/agents/atlas/index.ts` (UTM), `app/api/webhooks/conversions/route.ts`, `db/schema/conversions.ts`, `lib/agents/rigel/queries.ts`, `app/(dashboard)/campaigns/*`.
12. **Monetization:** High (B2B) — ROI proof justifies the entire subscription; an analytics/Enterprise tier.
13. **Risks:** Attribution accuracy + privacy/consent. Mitigate with first-party UTM + consented webhooks + clear "modeled" labeling.
14. **Validation:** A tracked link's clicks and a posted conversion roll up to the correct post and campaign with the right value.

---

## Rankings

**🟢 Quick wins** *(thin extensions of built seams, days-to-weeks, clear value)*
- **#3 Agent Inbox** (Accept/Edit/Respond/Ignore) — biggest UX unlock on existing review.
- **#4 Generative Per-Platform Preview** — pure render off capabilities.
- **#5 Glass-Box Run Inspector** — all data (`agent_steps`, hash chain, LangSmith) already exists.
- **#21 Campaign Template Library** — once #19 lands; fast activation win.
- **#2 Platform Policy Linter** — sits beside Castor in `finalize`.

**🔵 Strong product bets** *(high value, moderate build, monetizable)*
- **#1 Provenance & AI-Disclosure (P0, deadline-driven)** — also a differentiator; ship now.
- **#8 Multi-Brand Workspaces** + **#9 Roles/Approvals** — unlock the Agency/Team tier (clerkOrgId already threaded).
- **#7 Cost/Caps/Outcome Packaging** — margin + pricing power.
- **#16 Per-Platform Algorithm Coach** — measurable reach lift.
- **#19 Campaigns as First-Class Objects** — the strategy backbone.
- **#22 DM & Inbox Agent** — "DMs → leads" revenue story.
- **#24 Attribution & ROI Tracker** — B2B value proof.

**🟣 Differentiators** *(hard to copy, category-defining)*
- **#11 White-Label Client Approval Portal** — wins agencies.
- **#1 Provenance** (compliance-as-a-feature for EU/regulated).
- **#14 SocialFlow MCP Server** + **#13 Public API/n8n/Zapier** — become part of users' AI/automation stack.
- **#20 Multi-Agent Strategy Debate Panel** — "AI strategy team."
- **#23 Crisis & Brand-Risk Radar** — safety reflex few competitors have.

**🟠 Risky / experimental** *(validate before betting)*
- **#20 Senate** (cost/latency, generic-output risk) — gate behind caps + grounding.
- **#17 Protean** format generation (quality variance across formats).
- **#22 Hermes DMs** (platform DM-API access is the gating risk).
- **#24 Compass ROI** (attribution accuracy/privacy).

**🔴 Do not build yet** *(premature pre-PMF, or "hold" per trend radar)*
- **#15 Inbound A2A marketplace** — productize only for known partners after PMF (A2A *inbound* is "hold").
- **#14 MCP write actions / MCP Apps in-client UI** — pilot read-only first; in-client UI is immature.
- Fully autonomous DM/comment arguing, agent payments (AP2), browser-use for core publishing — keep the HITL gate on; APIs first.

---

## TRANSFER CAPSULE

*Paste-ready. SocialFlow = autonomous social-content agent SaaS. Built roster: Orion(orchestrate)→Vega(research)→Lyra(`lib/agent` graph)→Castor(brand-safety judge)→Atlas(publish)→Sirius(reply)┊Polaris(seed)→Rigel(report, feeds `agent_runs.plan`). Stack: Next16/React19, Clerk(+orgs), Neon+Drizzle, BullMQ+Upstash, LangGraph, LLM factory(Gemini default), ImageKit, Tavily, LangSmith, MCP inward, A2A outward, `agent_steps` hash-chain audit, quota metering. Confirmed open gaps these target: review is whole-run approve/reject only; clerkOrgId stored but no team UI; no provenance/disclosure; no outbound automation; no in-app run/cost/quality observability.*

**Top 12 (codename — 1-line value | MVP shape | trend | repo touchpoints | monetization | risk):**

1. **Aletheia — Provenance & AI-Disclosure** | *Stay legal as EU Art.50 (2 Aug 2026) + platform auto-labeling bite.* | text disclosure + per-platform AI flag + ledger; C2PA on ImageKit media | C2PA/SynthID, EU Art.50 | `lib/compliance/`, `publish.ts`, connectors, `disclosure_ledger`, `/compliance` | **High** (EU/Enterprise) | Med (platform API coverage).
2. **Triage — Agent Inbox (Accept/Edit/Respond/Ignore)** | *Fix one draft instead of rejecting a whole run.* | per-draft actions + respond→single-item refine | LangChain Agent Inbox | `review-queue.tsx`, `actions.ts`, `orchestrator.ts` | Med (retention) | Low.
3. **Atrium — Multi-Brand Workspaces** | *Run many brands per org; sell the Agency tier.* | `brands` table + switcher + brand-scoped lists | multi-tenant agent ops | `db/schema/brands`, repos scope, topbar | **High** (per-brand pricing) | Med (migration).
4. **Praetor — Roles & Delegated Approvals** | *Creators draft, approvers sign off.* | 3 roles + approver-only approve + audit | enterprise governance | `memberships`, `lib/clerk`, review actions | **High** (Team gate) | Low-Med.
5. **Lumen — Glass-Box Run Inspector** | *See exactly what the agents did + verify integrity.* | run timeline + per-step summary + hash-chain badge + LangSmith link | observability + audit | `/runs/[id]`, `run-audit.ts`, agent-runs repo | Med (trust) | Low (redaction).
6. **Tally — Cost/Caps/Outcome Packaging** | *Protect margin; price per published on-brand post; no bill-shock.* | per-run $ ledger + hard cap | usage/outcome pricing | `llm/factory`, `agent_steps`, `billing` | **High** | Med (cost accuracy).
7. **Cartographer — Per-Platform Algorithm Coach** | *Reach lift from platform-native structure.* | curated playbook per platform in drafting | self-improving + RAG packs | `draft-per-platform`, `platform_playbooks`, Rigel | **High** | Med (rules shift).
8. **Meridian — Campaigns as First-Class Objects** | *Plan & measure by campaign, not one-off posts.* | `campaigns` entity + grouping + per-campaign analytics | hierarchical planning | `db/schema/campaigns`, orchestrator, Rigel, `/campaigns` | **High** (top tier) | Med (scope).
9. **Envoy — White-Label Client Approval Portal** | *Clients approve via magic link, no seat.* | tokened approve/reject for one campaign | externalized approval inbox | `app/(client)/approve/[token]`, `approval_links` | **High** (Agency) | Med (link security).
10. **Relay + Conduit — Outbound Webhooks + API/n8n/Zapier** | *Become a node in users' automations.* | 4 signed events + API keys + Zapier trigger/action | agent eventing / agents-as-nodes | `webhook_endpoints`, `api_keys`, `app/api/v1`, processors | **High** (API tier) | Med (egress/abuse).
11. **Hermes — DM & Inbox Agent** | *Turn DMs into leads, on autopilot.* | DM ingest+classify+FAQ reply+escalate (1 platform) | conversational triage + HITL | `dm-poll.ts`, `dm_events`, auto-reply, `/inbox` | **High** | Med-High (DM API access).
12. **Bastion — Crisis & Brand-Risk Radar** | *Auto-pause posting when sentiment spikes.* | sentiment-spike detect → hold scheduled + alert | ambient monitoring + interrupts | `comment-poll.ts`, `incidents`, Atlas hold | Med-High (trust) | Med (false alarms).

**Also strong (13–17):** TrueView (generative previews), Vigil (eval/quality regression dashboard, productizes `evals/brand-safety`), Protean (one idea→native format per platform), Senate (multi-agent strategy panel), Compass (UTM+conversion ROI attribution).

**Recommended top 3 (build next):**
- **Aletheia (#1)** — deadline-driven P0; EU Art.50 applies 2 Aug 2026 and platforms already auto-label; ship before the cliff and turn compliance into a differentiator.
- **Triage Agent Inbox (#3)** — highest value-to-effort; all data/seams exist; immediately makes higher-autonomy tiers usable and safe.
- **Atrium + Praetor (#8/#9 as a pair)** — `clerkOrgId` is already threaded through the schema; productizing workspaces + roles unlocks the Agency/Team revenue tier with the least architectural risk.

---

## Sources (verified June 2026)

- [EU AI Act Art. 50 — transparency obligations](https://artificialintelligenceact.eu/article/50/) (synthetic content marking applies 2 Aug 2026; existing systems grace to 2 Dec 2026)
- [Code of Practice on AI-generated content](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)
- [TikTok joins C2PA / Content Authenticity](https://contentauthenticity.org/blog/tiktok-joins-content-authenticity-efforts) · [Platform AI labeling 2026](https://billo.app/blog/ai-labeling/) (TikTok 1.3B+ labeled; Meta IG/FB/Threads; LinkedIn "cr")
- [LangChain Agent Inbox](https://github.com/langchain-ai/agent-inbox) (Accept/Edit/Respond/Ignore over `interrupt`) · [AG-UI](https://docs.ag-ui.com/introduction)
- [Sierra — outcome-based pricing for AI agents](https://sierra.ai/blog/outcome-based-pricing-for-ai-agents) · [2026 SaaS/AI/agentic pricing guide](https://www.getmonetizely.com/blogs/the-2026-guide-to-saas-ai-and-agentic-pricing-models) (hybrid 43%→61%; 78% report surprise AI charges)
- [A2A ↔ MCP](https://a2a-protocol.org/latest/topics/a2a-and-mcp/) · [MCP 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)
- [Anthropic — building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) · [LangChain — State of Agent Engineering](https://www.langchain.com/state-of-agent-engineering)
- [Gartner — >40% of agentic AI projects canceled by 2027](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027)
- Repo trend basis: [research/ai-agent-trends-2026-06-22-refresh.md](research/ai-agent-trends-2026-06-22-refresh.md) (compiled 2026-06-23, primary-source-backed)

---

*Companion to the original [AGENT_FEATURE_IDEAS.md](AGENT_FEATURE_IDEAS.md). These 24 deliberately target the confirmed-unbuilt gaps (provenance, team/workspace, agentic-inbox UX, observability, outbound automation, campaigns) rather than re-listing the original codenames. Not a commitment — an ideation menu for prioritization.*
