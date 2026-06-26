# T4 Feasibility and Risk

Date checked: 2026-06-26. Scope: decide what is buildable in this repo without a rewrite. This assessment is based on opened repo files, not product claims.

Read coverage for this pass:

- Manifest and scripts: `package.json:5` declares Next, LangChain/LangGraph, BullMQ, Drizzle, Clerk, workers, tests, typecheck, integration test, and brand-safety eval scripts (`package.json:9`, `package.json:10`, `package.json:11`, `package.json:12`, `package.json:13`, `package.json:14`, `package.json:15`, `package.json:22`, `package.json:27`, `package.json:28`, `package.json:29`).
- Active roadmap/phase docs: `docs/MASTER_PLAN.md:1` is the consolidated plan and says runtime verification was deferred with no real credentials/live services (`docs/MASTER_PLAN.md:4`, `docs/MASTER_PLAN.md:13`, `docs/MASTER_PLAN.md:17`). `docs/FIX_PLAN.md:1` and `docs/MASTER_PLAN_v2.md:1` are superseded.
- Specs: no tracked `docs/specs/*` file was found in the repo file enumeration during this pass. Because there is no file path to cite, any spec-specific claim is treated as unclear.
- Data model: schema barrel and individual schema modules were opened (`db/schema.ts:1`, `db/schema/agent-runs.ts:28`, `db/schema/agent-steps.ts:14`, `db/schema/generated-content.ts:19`, `db/schema/post-targets.ts:18`, `db/schema/social-accounts.ts:14`, `db/schema/brand-profiles.ts:32`, `db/schema/reports.ts:18`, `db/schema/content-plans.ts:25`).
- Agent/service code: LangGraph graph, LLM providers, guardrails, named agents, orchestrator, review/publish/research/report code, MCP and A2A were opened (`lib/agent/graph.ts:14`, `lib/llm/factory.ts:10`, `lib/agent/guardrails/brand-safety.ts:66`, `lib/agents/orchestrator.ts:94`, `lib/agents/registry.ts:53`, `lib/mcp/client.ts:5`, `app/api/a2a/route.ts:46`).
- Workers/API routes: queue definitions, worker processors, `/api/generate`, `/api/agents/run`, publish/comment/reply/metrics/report processors were opened (`lib/queue/queues.ts:5`, `worker/index.ts:71`, `app/api/generate/route.ts:19`, `app/api/agents/run/route.ts:21`, `worker/processors/publish.ts:21`, `worker/processors/comment-poll.ts:22`, `worker/processors/reply.ts:23`, `worker/processors/metrics-poll.ts:24`, `worker/processors/report.ts:12`).
- Tests/evals: orchestrator, capability, recovery, guardrail, CI, and integration-test behavior were opened (`lib/agents/orchestrator.test.ts:28`, `lib/agents/capabilities.test.ts:7`, `lib/agents/recovery.test.ts:6`, `lib/evals/brand-safety-gate.ts:1`, `evals/brand-safety/gate.ts:1`, `tests/integration/quota-concurrency.test.ts:1`, `.github/workflows/ci.yml:51`).

Scoring:

- Effort: XS, S, M, L, XL.
- Security/privacy risk: Low, Med, High.
- Operational cost: Low, Med, High.
- User value: Low, Med, High.
- Architecture fit: Low, Med, High.
- Buildability: "Now" means buildable without a rewrite; "Later" means viable but needs sequencing; "Hold" means do not build until a prerequisite is resolved.

## Feasibility Matrix

| Rank | Feature | Effort | Security/privacy risk | Operational cost | User value | Architecture fit | Buildability | Rationale |
|---:|---|---|---|---|---|---|---|---|
| 1 | Run Doctor Command Center | S | Low | Low | High | High | Now | Failed target listing, Run Doctor classifier, publish worker error paths, and dashboard needs-attention surface already exist (`lib/repos/posts.ts:134`, `lib/agents/recovery.ts:35`, `worker/processors/publish.ts:125`, `app/(dashboard)/dashboard/page.tsx:248`). |
| 2 | Platform Constraint Coach | S | Low | Low | High | High | Now | Server validation and platform capability metadata already encode most constraints (`app/(dashboard)/create/actions.ts:186`, `lib/platforms/types.ts:31`, `lib/platforms/constants.ts:13`). |
| 3 | Brand Memory Manager | S | Low | Low | High | High | Now | `learnedMemory` and `voiceHistory` already exist on brand profiles, and Lyra/Rigel already consume/update memory (`db/schema/brand-profiles.ts:40`, `db/schema/brand-profiles.ts:44`, `lib/agents/lyra/index.ts:51`, `lib/agents/rigel/index.ts:92`). |
| 4 | Approval Analytics and Reviewer SLA | S | Med | Low | Med | High | Now | Review status, verdict, reviewer note/by/at, quality repo, and review queue exist (`db/schema/generated-content.ts:69`, `lib/repos/quality.ts:21`, `app/(dashboard)/quality/page.tsx:27`, `lib/repos/content-reviews.ts:66`). Risk is team-privacy, not architecture. |
| 5 | Social Account Health Agent | M | Low | Low-Med | High | High | Now | Account status/token expiry/scopes/metadata plus token refresh jobs already exist (`db/schema/social-accounts.ts:29`, `db/schema/social-accounts.ts:30`, `db/schema/social-accounts.ts:31`, `db/schema/social-accounts.ts:32`, `lib/queue/jobs.ts:266`). |
| 6 | Evergreen Content Recycler 2.0 | M | Low | Med | High | High | Now | Recyclable winners and repurpose action already exist (`lib/repos/posts.ts:361`, `app/(dashboard)/dashboard/actions.ts:10`, `db/schema/generated-content.ts:76`). |
| 7 | Cross-Platform Consistency Auditor | M | Low-Med | Med | High | High | Now | Castor, generated review fields, policy linter, and review queue can host this (`lib/agents/castor/index.ts:94`, `db/schema/generated-content.ts:69`, `lib/compliance/policy-linter.ts:110`, `app/(dashboard)/review/review-queue.tsx:49`). |
| 8 | Industry Policy Packs | M | Med | Low | Med-High | High | Now | Current deterministic linter and brand policy rules are additive extension points (`lib/compliance/policy-linter.ts:34`, `db/schema/brand-profiles.ts:42`, `app/(dashboard)/settings/brand-profile-form.tsx:49`). |
| 9 | Agent Run Templates | M | Low | Low | Med | High | Now | `AgentRunPlan` supports flexible steps and orchestrator can start explicit first step (`db/schema/agent-runs.ts:17`, `lib/agents/orchestrator.ts:94`, `app/api/agents/run/route.ts:21`). |
| 10 | Live Agent Run Control Room | M | Med | Low-Med | High | High | Now | Run detail, timeline, hash verification, and A2A SSE pattern already exist (`app/(dashboard)/runs/[runId]/page.tsx:24`, `lib/runs/timeline.ts:4`, `app/api/a2a/route.ts:142`). |
| 11 | Agent Spend and Budget Governor | M | Low | Low | Med-High | High | Now | Usage collector, cost model, run cost query, and quotas are implemented (`lib/llm/usage.ts:57`, `lib/billing/cost-model.ts:46`, `lib/repos/agent-runs.ts:183`, `lib/billing/entitlements.ts:39`). |
| 12 | Campaign Simulation Gate | M | Low-Med | Med | High | High | Now | Castor/review queue can absorb campaign-level findings without changing publishing (`lib/agents/castor/index.ts:67`, `lib/repos/content-reviews.ts:24`, `app/(dashboard)/review/review-queue.tsx:49`). |
| 13 | Scheduled Trend Watch Agent | M | Low | Med | High | High | Now | Research processor, Vega, Tavily tool, schedule ledger, and queues exist; new watch persistence is additive (`lib/agents/vega/index.ts:40`, `worker/processors/research.ts:14`, `lib/agent/tools/web-search.ts:8`, `lib/queue/jobs.ts:75`). |
| 14 | Reply Copilot Inbox | L | Med-High | Med | High | Med-High | Later | Comment and reply pipeline exists, but connector support is mostly Meta-only and unsafe replies carry high brand risk (`worker/processors/comment-poll.ts:22`, `worker/processors/reply.ts:23`, `worker/processors/reply.ts:45`, `lib/platforms/facebook.ts:111`, `lib/platforms/instagram.ts:107`). |
| 15 | Source-to-Campaign Repurposer | L | Med | Med | High | Med-High | Later | Generation/research surfaces exist, but source fetching/citation/copyright/SSRF controls require careful new boundaries (`app/api/generate/route.ts:19`, `lib/agent/tools/web-search.ts:8`, `app/(dashboard)/create/actions.ts:51`, `db/schema/generated-content.ts:19`). |
| 16 | Metrics-Driven Variant Bandit | L | Low | Med | Med-High | Med | Later | Metrics, reports, posting windows, and recyclable winners exist, but sample size and platform support are narrow (`worker/processors/metrics-poll.ts:24`, `lib/repos/posts.ts:341`, `db/schema/posting-windows.ts:14`, `lib/platforms/facebook.ts:32`, `lib/platforms/instagram.ts:32`). |
| 17 | External Event Webhooks | L | High | Med | Med | Med | Later | Queue and ledger patterns exist, but outbound events need token/secrets, delivery logs, redaction, retries, and admin controls (`lib/queue/queues.ts:5`, `lib/queue/with-ledger.ts:1`, `db/schema/agent-runs.ts:28`, `db/schema/post-targets.ts:18`). |
| 18 | SocialFlow MCP Server | L | High | Med | Med-High | Med | Later | MCP client and A2A token scoping exist, but exposing tenant data/actions to external agents needs a new server, scopes, audit, revocation, and approvals (`lib/mcp/client.ts:5`, `app/api/a2a/route.ts:46`, `lib/repos/agent-runs.ts:69`). |
| 19 | Client Approval Portal | L | High | Low-Med | High | Med | Later | Review repo is ready, but public/external secure tokens, audit, expiry, email binding, and UX are nontrivial (`lib/repos/content-reviews.ts:101`, `app/(dashboard)/review/actions.ts:26`, `lib/auth/roles.ts:1`). |
| 20 | Campaign Objects and Brief Workspace | XL | Med | Low-Med | High | Med | Later | High value, but it touches schema relationships across runs/posts/generated content/research/reports/plans and broad navigation (`db/schema/agent-runs.ts:28`, `db/schema/posts.ts:13`, `db/schema/generated-content.ts:19`, `db/schema/research.ts:6`, `db/schema/reports.ts:18`, `db/schema/content-plans.ts:25`). |

## Buckets

### Quick Wins

These are buildable without a rewrite and should not require new platform credentials.

1. Run Doctor Command Center
   - Why: directly extends failed-target handling and existing failure classifier.
   - First proof: failed target gets class, reason, safe action, and no retry when account/policy/fatal.
   - Key files: `lib/agents/recovery.ts:35`, `worker/processors/publish.ts:125`, `lib/repos/posts.ts:134`, `app/(dashboard)/dashboard/page.tsx:248`.

2. Platform Constraint Coach
   - Why: most logic exists but is buried in server validation and connector capabilities.
   - First proof: composer and server action produce matching issue codes for missing media/text limits.
   - Key files: `app/(dashboard)/create/actions.ts:186`, `lib/platforms/types.ts:31`, `lib/platforms/constants.ts:13`, `components/composer/variant-editor.tsx:91`.

3. Brand Memory Manager
   - Why: data exists and agents already read/write learned memory.
   - First proof: settings UI edits learned memory and next Lyra run receives it.
   - Key files: `db/schema/brand-profiles.ts:40`, `db/schema/brand-profiles.ts:44`, `lib/agents/lyra/index.ts:51`, `lib/agents/rigel/index.ts:92`.

4. Approval Analytics and Reviewer SLA
   - Why: review state is already structured; start with aggregate reporting.
   - First proof: quality page shows aging held drafts and hold reasons.
   - Key files: `db/schema/generated-content.ts:69`, `lib/repos/quality.ts:21`, `app/(dashboard)/quality/page.tsx:27`.

5. Social Account Health Agent
   - Why: accounts, refresh jobs, status, expiry, scopes, and metadata are present.
   - First proof: health badges catch inactive/expired/missing-scope accounts before publish.
   - Key files: `db/schema/social-accounts.ts:29`, `db/schema/social-accounts.ts:30`, `lib/queue/jobs.ts:266`, `app/(dashboard)/accounts/page.tsx:35`.

6. Evergreen Content Recycler 2.0
   - Why: recyclable winner query and repurpose action already exist.
   - First proof: winner card generates review-ready refreshed variants with source linkage.
   - Key files: `lib/repos/posts.ts:361`, `app/(dashboard)/dashboard/actions.ts:10`, `db/schema/generated-content.ts:76`.

7. Cross-Platform Consistency Auditor
   - Why: review violations can store findings without new schema.
   - First proof: variants with conflicting price/date/disclosure hold one or more drafts.
   - Key files: `lib/agents/castor/index.ts:94`, `db/schema/generated-content.ts:69`, `lib/compliance/policy-linter.ts:110`.

8. Industry Policy Packs
   - Why: additive deterministic rules are cheap and testable.
   - First proof: curated pack tests and UI selection change review outcomes.
   - Key files: `lib/compliance/policy-linter.ts:34`, `db/schema/brand-profiles.ts:42`, `app/(dashboard)/settings/brand-profile-form.tsx:49`.

9. Agent Run Templates
   - Why: plan JSON already accepts steps.
   - First proof: built-in template starts the intended first agent and preserves approval.
   - Key files: `db/schema/agent-runs.ts:17`, `lib/agents/orchestrator.ts:94`, `app/api/agents/run/route.ts:21`.

10. Read-only Live Run Control Room
   - Why: timeline and A2A SSE are already present; start read-only to reduce risk.
   - First proof: internal run detail streams step changes for the authenticated owner.
   - Key files: `app/(dashboard)/runs/[runId]/page.tsx:24`, `lib/runs/timeline.ts:4`, `app/api/a2a/route.ts:142`.

### Next Major Bets

These fit the architecture, but they need more design, new data model pieces, or careful security review.

1. Agent Spend and Budget Governor
   - Fit: high. It uses existing token usage and cost estimates.
   - Risk: static model rates and budget UX. Keep display as estimates (`lib/billing/cost-model.ts:1`, `lib/billing/cost-model.ts:41`).

2. Campaign Simulation Gate
   - Fit: high. Castor and review queue are natural insertion points.
   - Risk: model confidence and overblocking. Use warn/hold states rather than hard publish claims.

3. Scheduled Trend Watch Agent
   - Fit: high. Research queues and Vega already exist.
   - Risk: source quality and noise; needs clear source provenance.

4. Reply Copilot Inbox
   - Fit: medium-high. Reply pipeline exists, but must stay Meta-first because current non-Meta connectors lack comments (`lib/platforms/x.ts:21`, `lib/platforms/linkedin.ts:21`, `lib/platforms/tiktok.ts:27`, `lib/platforms/youtube.ts:27`, `lib/platforms/pinterest.ts:23`, `lib/platforms/discord.ts:22`).

5. Source-to-Campaign Repurposer
   - Fit: medium-high. Strong product value, but source fetching and citation correctness need new guardrails.

6. Metrics-Driven Variant Bandit
   - Fit: medium. Requires enough metrics and careful confidence thresholds.

7. External Event Webhooks
   - Fit: medium. Useful for agencies and ops, but security/audit must come first.

8. SocialFlow MCP Server
   - Fit: medium. Trend-aligned, but external-agent access to tenant data/actions is high-risk.

9. Client Approval Portal
   - Fit: medium. Strong agency value but external access/token lifecycle is security-sensitive.

10. Campaign Objects and Brief Workspace
   - Fit: medium. Strategically important but broad enough to sequence after quick wins.

### Do Not Build Yet

These should wait until prerequisites are met.

1. Browser/computer-use posting automation
   - Reason: no repo evidence of browser/computer-use tooling; official platform APIs already exist in connectors for current publishing (`lib/platforms/types.ts:112`, `worker/processors/publish.ts:75`). Browser automation would add high security, policy, and reliability risk.
   - Prerequisite: explicit user demand for a platform workflow that cannot be handled by official APIs, plus sandboxed browser execution, approval, audit, and replay.

2. Public A2A marketplace / open inbound third-party agents
   - Reason: A2A exists but is env-disabled, and master plan says hold pre-PMF (`app/api/a2a/route.ts:46`, `docs/MASTER_PLAN.md:305`, `docs/MASTER_PLAN.md:306`, `docs/MASTER_PLAN.md:307`, `docs/MASTER_PLAN.md:308`).
   - Prerequisite: MCP/server tool audit, tenant-scoped tokens, admin controls, and clear buyer demand.

3. Fully autonomous reply sending for complaints, abuse, regulated claims, or high-urgency messages
   - Reason: reply processor already refuses abuse/complaints for auto-reply (`worker/processors/reply.ts:45`), and that safety invariant should not be relaxed.
   - Prerequisite: reply approval inbox, pack-based policies, post-send monitoring, and kill switch.

4. Automatic multi-platform bandit allocation without human review
   - Reason: current metrics are sparse and connector support is uneven; only connectors with `supportsMetrics` can feed reliable metrics (`lib/platforms/facebook.ts:32`, `lib/platforms/instagram.ts:32`, `worker/processors/metrics-poll.ts:37`).
   - Prerequisite: sample-size thresholds, experiment data model, and clear fallback for platforms without metrics.

5. Broad external write-capable MCP tools
   - Reason: the repo has an MCP client, not a server, and no API-token/audit model for external tool invocations (`lib/mcp/client.ts:5`, `db/schema.ts:1`).
   - Prerequisite: read-only MCP server, scoped tokens, audit table, per-action approvals.

## Cross-Cutting Constraints

- Live verification is still a major unknown. Product docs state real credentials/live services were not exercised (`docs/MASTER_PLAN.md:4`, `docs/MASTER_PLAN.md:13`, `docs/MASTER_PLAN.md:17`).
- Platform asymmetry must shape all roadmap decisions. Facebook/Instagram support the richest loops; other connectors are publish-only or constrained (`lib/platforms/facebook.ts:30`, `lib/platforms/facebook.ts:32`, `lib/platforms/instagram.ts:30`, `lib/platforms/instagram.ts:32`, `lib/platforms/x.ts:21`, `lib/platforms/linkedin.ts:21`).
- Approval and least privilege are strong existing architecture patterns and should not be bypassed (`lib/agents/capabilities.ts:3`, `lib/agents/capabilities.test.ts:13`, `lib/agents/orchestrator.test.ts:411`).
- Tests are strong for pure logic and orchestration, but live DB/provider behavior is not covered by default CI (`.github/workflows/ci.yml:51`, `.github/workflows/ci.yml:61`, `.github/workflows/ci.yml:64`, `tests/integration/quota-concurrency.test.ts:8`, `tests/integration/quota-concurrency.test.ts:13`).

## Recommended Sequencing

1. Start with operational reliability and clarity: Run Doctor Command Center, Platform Constraint Coach, and Social Account Health Agent.
2. Add governance and quality: Brand Memory Manager, Cross-Platform Consistency Auditor, Approval Analytics, and Industry Policy Packs.
3. Improve run visibility: read-only Live Agent Run Control Room, then budget controls.
4. Add higher-value generation loops: Scheduled Trend Watch, Campaign Simulation, Source-to-Campaign, Evergreen Recycler 2.0.
5. Only after the above are stable, expand external surfaces: Event Webhooks, MCP Server, Client Approval Portal, and Campaign Objects.

## Self-Check

- Every feasibility judgment is tied to opened repo files.
- "Do not build yet" items are held for concrete technical/security reasons, not because they are unrelated to trends.
- The ranking favors buildability without a rewrite, not abstract market excitement.
