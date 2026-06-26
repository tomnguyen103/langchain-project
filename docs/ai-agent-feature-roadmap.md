# AI-Agent Feature Roadmap

Date checked: 2026-06-26. Scope: read-only roadmap for `C:\Users\huuth\Desktop\langchain-project`.

All required inputs exist and were read before synthesis:

- `docs/research/01-repo-intelligence.md:1`: 121 lines.
- `docs/research/02-trends.md:1`: 221 lines.
- `docs/research/03-feature-ideation.md:1`: 328 lines.
- `docs/research/04-feasibility.md:1`: 185 lines.

No required intermediate file was missing.

## 1. Strategic Diagnosis

SocialFlow is already much closer to a production agentic operations platform than a thin LLM wrapper. The repo implements a Next.js 16 app with LangChain/LangGraph, BullMQ workers, Drizzle/Postgres, Clerk, ImageKit, and eight social platform connectors (`package.json:22`, `package.json:27`, `package.json:28`, `package.json:29`, `db/schema/enums.ts:3`, `lib/platforms/registry.ts:13`). The README describes the product as AI social-content automation for niche research, platform-tailored content generation, scheduling/publishing, metrics, and auto-replies (`README.md:1`, `README.md:3`, `README.md:5`). T1 confirms the same purpose from code, not only docs (`docs/research/01-repo-intelligence.md:7`).

The main strategic advantage is that the hard primitives are already present:

- Agent orchestration: a LangGraph content graph plus a named-agent queue/orchestrator with handoffs, pauses, resumes, supervisor overrides, and step recording (`lib/agent/graph.ts:14`, `lib/agents/orchestrator.ts:94`, `lib/agents/orchestrator.ts:121`, `lib/agents/orchestrator.ts:159`, `db/schema/agent-steps.ts:14`).
- Human control: Castor gate, held draft review queue, per-item decisions, plan approval, and roles (`lib/agents/castor/index.ts:67`, `app/(dashboard)/review/actions.ts:26`, `app/(dashboard)/review/actions.ts:77`, `app/(dashboard)/plans/[id]/actions.ts:11`, `lib/auth/roles.ts:1`).
- Operations engine: durable queue helpers and workers for publish, research, agent steps, comments, replies, metrics, reporting, seeding, reconcile, token refresh, and posting windows (`lib/queue/queues.ts:5`, `lib/queue/with-ledger.ts:1`, `worker/index.ts:71`).
- Governance and observability: brand-safety guardrail, policy linter, disclosure ledger, LangSmith links, run timeline, tamper-evident step hashes, cost estimates, and CI brand-safety gate (`lib/agent/guardrails/brand-safety.ts:66`, `lib/compliance/policy-linter.ts:110`, `db/schema/disclosure-ledger.ts:7`, `lib/observability/langsmith.ts:3`, `lib/runs/timeline.ts:4`, `lib/audit/run-audit.ts:35`, `lib/billing/cost-model.ts:46`, `.github/workflows/ci.yml:64`).

The roadmap should therefore avoid generic chatbot work. The best product direction is a governed, observable background agent for social-content operations: it should research, draft, review, schedule, publish, monitor, recover, learn, and explain its actions. T2 reaches the same conclusion: "The strongest 2026-aligned path is not a chatbot; it is a governed background content-operations agent" (`docs/research/02-trends.md:209`).

The biggest constraints are equally clear:

- Live-service behavior is still unproven. The master plan states that runtime verification was deferred and real credentials/live services were not exercised (`docs/MASTER_PLAN.md:4`, `docs/MASTER_PLAN.md:13`, `docs/MASTER_PLAN.md:17`).
- Platform capability is asymmetric. Facebook and Instagram expose comments/metrics; most other connectors are publish-only or constrained (`lib/platforms/facebook.ts:30`, `lib/platforms/facebook.ts:32`, `lib/platforms/instagram.ts:30`, `lib/platforms/instagram.ts:32`, `lib/platforms/x.ts:21`, `lib/platforms/linkedin.ts:21`, `lib/platforms/tiktok.ts:27`, `lib/platforms/youtube.ts:27`).
- External-agent surfaces are early. A2A is implemented but disabled by env and the master plan says to hold it pre-PMF (`app/api/a2a/route.ts:46`, `docs/MASTER_PLAN.md:305`). MCP is a client only, not a SocialFlow server (`lib/mcp/client.ts:5`).
- The data model has no first-class campaign object, so campaign/workspace features touch many tables (`db/schema.ts:1`, `db/schema/agent-runs.ts:28`, `db/schema/posts.ts:13`, `db/schema/generated-content.ts:19`, `db/schema/research.ts:6`, `db/schema/reports.ts:18`, `db/schema/content-plans.ts:25`).

The roadmap should start where high user value and architecture fit overlap: reliability, constraint clarity, account health, brand memory, consistency auditing, live run visibility, and guarded campaign-quality improvements. It should defer public A2A, broad MCP write tools, browser/computer-use automation, and autonomous high-risk replies until security, approval, and live-provider evidence catch up.

## 2. 2026 Trend Radar

| Trend | Primary sources | Date | Relevance to SocialFlow |
|---|---|---:|---|
| Delegated background agents | [OpenAI workspace agents](https://openai.com/index/introducing-workspace-agents-in-chatgpt/); [GitHub Copilot coding agent](https://github.blog/ai-and-ml/github-copilot/whats-new-with-github-copilot-coding-agent/) | 2026-04-22; 2026-02-26 | SocialFlow already has queued agents and workers, so the product should expose delegated content operations rather than add a generic chat surface (`docs/research/02-trends.md:28`). |
| Explicit multi-agent orchestration | [Google ADK](https://developers.googleblog.com/en/agent-development-kit-easy-to-build-multi-agent-applications/); [Google ADK + A2A](https://developers.googleblog.com/build-cross-language-multi-agent-team-with-google-agent-development-kit-and-a2a/); [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview) | 2025-04-09; 2026-06-22; accessed 2026-06-26 | SocialFlow's named agents and run timeline already align; keep new work inside `agent_runs`/`agent_steps` rather than inventing opaque flows (`docs/research/02-trends.md:44`). |
| Human approval as agent primitive | [LangGraph HITL](https://docs.langchain.com/oss/javascript/langgraph/human-in-the-loop); [Vercel AI SDK 7](https://vercel.com/blog/ai-sdk-7) | accessed 2026-06-26; 2026-06-25 | Castor and review queue are strong foundations. Expand approval to retries, replies, external tools, and client review (`docs/research/02-trends.md:61`). |
| MCP tool ecosystems | [OpenAI tools](https://developers.openai.com/api/docs/guides/tools); [Anthropic MCP code execution](https://www.anthropic.com/engineering/code-execution-with-mcp); [GitHub MCP for Copilot coding agent](https://docs.github.com/en/enterprise-cloud@latest/copilot/customizing-copilot/extending-copilot-coding-agent-with-mcp) | accessed 2026-06-26; 2025-11-25; accessed 2026-06-26 | Build a narrow SocialFlow MCP server only after read-only/scoped/audited tool design. Do not start with broad write tools (`docs/research/02-trends.md:78`). |
| A2A interoperability | [Google Agent2Agent foundation](https://developers.googleblog.com/agent2agent-the-foundation-for-collaborative-multi-agent-systems/); [Google ADK + A2A](https://developers.googleblog.com/build-cross-language-multi-agent-team-with-google-agent-development-kit-and-a2a/) | 2025-12-17; 2026-06-22 | Existing A2A route is useful evidence, but T4 recommends holding public inbound A2A until PMF/security catches up (`docs/research/02-trends.md:95`, `docs/research/04-feasibility.md:142`). |
| Durable memory and procedural skills | [Anthropic Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview); [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview) | accessed 2026-06-26 | Brand memory exists but needs a user-visible manager and audit so the agent's learned preferences are controllable (`docs/research/02-trends.md:110`). |
| Browser/computer use | [Anthropic computer use](https://docs.anthropic.com/en/docs/build-with-claude/computer-use); [OpenAI tools](https://developers.openai.com/api/docs/guides/tools) | accessed 2026-06-26 | Not a first-line SocialFlow bet. The repo uses official APIs; browser automation should wait for a proven API gap and stronger sandboxing (`docs/research/02-trends.md:127`, `docs/research/04-feasibility.md:142`). |
| Tool approvals, streaming, resumability | [OpenAI WebSockets](https://openai.com/index/speeding-up-agentic-workflows-with-websockets/); [Vercel AI SDK 7](https://vercel.com/blog/ai-sdk-7); [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview) | 2026-06-16; 2026-06-25; accessed 2026-06-26 | Convert the run inspector into a live control room before adding conversational streaming (`docs/research/02-trends.md:144`). |
| Tracing, evals, audit | [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview); [GitHub Copilot coding agent](https://github.blog/ai-and-ml/github-copilot/whats-new-with-github-copilot-coding-agent/) | accessed 2026-06-26; 2026-02-26 | SocialFlow is strong here: LangSmith links, hash chain, and CI eval gate are already present (`docs/research/02-trends.md:161`). |
| Governance and least privilege | [GitHub custom agents](https://docs.github.com/copilot/customizing-copilot/customizing-or-creating-agents/about-custom-agents); [Anthropic computer use](https://docs.anthropic.com/en/docs/build-with-claude/computer-use) | accessed 2026-06-26 | Keep agent capabilities, roles, tenant scoping, and approvals as product features, not hidden internals (`docs/research/02-trends.md:178`). |

## 3. Reconciliation Across Inputs

### Ranked Themes by Frequency x Impact

| Rank | Theme | Evidence across inputs | Impact | Decision |
|---:|---|---|---:|---|
| 1 | Governed background content operations | T1 identifies queues, agents, approvals, and run audit (`docs/research/01-repo-intelligence.md:31`, `docs/research/01-repo-intelligence.md:99`). T2 says delegated background agents and HITL approvals are current trends (`docs/research/02-trends.md:28`, `docs/research/02-trends.md:61`). T3 includes Run Doctor, Live Run Control Room, approval analytics, account health, and budget governor (`docs/research/03-feature-ideation.md:23`, `docs/research/03-feature-ideation.md:218`, `docs/research/03-feature-ideation.md:278`, `docs/research/03-feature-ideation.md:293`). T4 ranks several as quick wins (`docs/research/04-feasibility.md:51`). | High | Build first. |
| 2 | Operational reliability before autonomy | T1 flags live-provider and platform asymmetry risks (`docs/research/01-repo-intelligence.md:109`). T3 proposes Run Doctor, Platform Constraint Coach, and Account Health (`docs/research/03-feature-ideation.md:23`, `docs/research/03-feature-ideation.md:248`, `docs/research/03-feature-ideation.md:278`). T4 ranks them 1, 2, and 5 (`docs/research/04-feasibility.md:24`). | High | Build first. |
| 3 | Brand safety, memory, and compliance as differentiators | T1 shows brand profiles, guardrails, policy linter, review queue, disclosure ledger (`docs/research/01-repo-intelligence.md:31`). T2 highlights memory/governance (`docs/research/02-trends.md:110`, `docs/research/02-trends.md:178`). T3 proposes memory manager, consistency auditor, policy packs (`docs/research/03-feature-ideation.md:83`, `docs/research/03-feature-ideation.md:188`, `docs/research/03-feature-ideation.md:203`). | High | Build in first two releases. |
| 4 | Research/generation loops with review | T1 shows Vega, Lyra, Castor, Tavily-optional research, and generated content (`docs/research/01-repo-intelligence.md:31`). T3 proposes Trend Watch, Campaign Simulation, Source-to-Campaign, Evergreen Recycler (`docs/research/03-feature-ideation.md:38`, `docs/research/03-feature-ideation.md:53`, `docs/research/03-feature-ideation.md:68`, `docs/research/03-feature-ideation.md:233`). T4 places several as next major bets (`docs/research/04-feasibility.md:105`). | High | Build after reliability/visibility. |
| 5 | Integration surface area: MCP, A2A, webhooks | T2 says MCP/A2A are real trends (`docs/research/02-trends.md:78`, `docs/research/02-trends.md:95`). T1 finds MCP client and disabled A2A (`docs/research/01-repo-intelligence.md:31`). T3 proposes MCP server and webhooks (`docs/research/03-feature-ideation.md:158`, `docs/research/03-feature-ideation.md:308`). T4 rates them later/high-risk (`docs/research/04-feasibility.md:105`, `docs/research/04-feasibility.md:142`). | Medium-High | Defer until core trust surfaces are stronger. |
| 6 | Metrics-driven optimization | T1 shows metrics polling, reports, posting windows, and recyclable winners (`docs/research/01-repo-intelligence.md:31`). T3 proposes bandit and evergreen (`docs/research/03-feature-ideation.md:128`, `docs/research/03-feature-ideation.md:233`). T4 warns metrics are sparse and Meta-skewed (`docs/research/04-feasibility.md:142`). | Medium | Start with recommendations, not automation. |
| 7 | Campaign workspace/model | T3 proposes campaign objects (`docs/research/03-feature-ideation.md:143`). T4 ranks it XL and later due schema blast radius (`docs/research/04-feasibility.md:24`). | High long-term | Defer. |

### Conflicts and Decisions Needed

| Conflict | Why it matters | Recommended resolution |
|---|---|---|
| MCP/A2A are hot trends, but T4 rates broad external agent access as later/hold. | External agents can access tenant content and trigger writes. Current repo has MCP client, disabled A2A, and no API-token/audit table (`lib/mcp/client.ts:5`, `app/api/a2a/route.ts:46`, `docs/MASTER_PLAN.md:305`). | Build internal trust surfaces first. Later, ship read-only MCP tools with scoped tokens and audit before write tools. Keep A2A disabled until PMF/security evidence improves. |
| Reply Copilot is high-value but high-risk and Meta-limited. | Comment/reply support is implemented for Facebook/Instagram, not most connectors (`lib/platforms/facebook.ts:111`, `lib/platforms/instagram.ts:107`, `lib/platforms/x.ts:21`, `lib/platforms/linkedin.ts:21`). Auto-reply already refuses abuse/complaints (`worker/processors/reply.ts:45`). | Build a held Reply Copilot Inbox first, Meta-only, with no auto-send for complaints/abuse/high urgency. |
| Metrics-driven bandit sounds strategic, but data is sparse and platform support is uneven. | Metrics polling only helps where connector capability supports metrics (`worker/processors/metrics-poll.ts:37`, `lib/platforms/facebook.ts:32`, `lib/platforms/instagram.ts:32`). | Start with "recommendations with confidence" from historical winners, not automatic allocation. |
| Source-to-Campaign has strong creator value but source/copyright/SSRF risks. | Search is optional and URL fetching needs strict boundaries (`lib/agent/tools/web-search.ts:5`, `lib/agent/tools/web-search.ts:12`, `app/(dashboard)/create/actions.ts:51`). | Start with pasted text and explicit source metadata. Add URL fetching only after allowlist/SSRF/citation tests. |
| Campaign Objects are strategically right but schema-wide. | They touch runs, posts, generated content, research, reports, and plans (`db/schema/agent-runs.ts:28`, `db/schema/posts.ts:13`, `db/schema/generated-content.ts:19`, `db/schema/research.ts:6`, `db/schema/reports.ts:18`, `db/schema/content-plans.ts:25`). | Defer until quick wins stabilize. In the interim, use run IDs, plan IDs, and source links for grouping. |
| Browser/computer use is trendy but unsupported in repo. | No opened path showed browser/computer tooling; official API connectors already exist (`lib/platforms/types.ts:112`, `worker/processors/publish.ts:75`). | Do not build yet. Revisit only for a platform workflow that official APIs cannot support. |

## 4. Top 10 Ranked Features

Scoring: Impact, Confidence, Effort, Risk, Strategic Fit use 1-5 where 5 is high. Effort and Risk are inverted in priority calculation: lower effort/risk rank better.

| Rank | Feature | Impact | Confidence | Effort | Risk | Strategic Fit | Priority Rationale |
|---:|---|---:|---:|---:|---:|---:|---|
| 1 | Run Doctor Command Center | 5 | 5 | 2 | 2 | 5 | Directly addresses failed publishes with existing classifier, failed-target query, and dashboard surface. |
| 2 | Platform Constraint Coach | 5 | 5 | 2 | 1 | 5 | Prevents avoidable publish failures by sharing existing platform validation with the composer. |
| 3 | Social Account Health Agent | 5 | 4 | 3 | 2 | 5 | Reduces publish failures before they happen using account status/token metadata already present. |
| 4 | Brand Memory Manager | 4 | 5 | 2 | 2 | 5 | Makes existing learned memory controllable and auditable. |
| 5 | Cross-Platform Consistency Auditor | 4 | 4 | 3 | 2 | 5 | Strong use of current review/guardrail infrastructure. |
| 6 | Live Agent Run Control Room | 4 | 4 | 3 | 3 | 5 | Turns existing run timeline/A2A stream pattern into user-facing operational clarity. |
| 7 | Campaign Simulation Gate | 4 | 4 | 3 | 3 | 5 | Expands Castor from per-draft safety to campaign-level readiness. |
| 8 | Scheduled Trend Watch Agent | 4 | 4 | 3 | 2 | 4 | Reuses Vega/research queues; valuable background-agent workflow. |
| 9 | Evergreen Content Recycler 2.0 | 4 | 4 | 3 | 2 | 4 | Builds on existing recyclable winners and repurpose action. |
| 10 | Agent Spend and Budget Governor | 3 | 4 | 3 | 2 | 5 | Protects margins and makes autonomous runs governable. |

Not top 10 despite high interest:

- Reply Copilot Inbox: high user value, but high brand risk and Meta-only connector support.
- SocialFlow MCP Server: strong trend fit, but external-agent data/action exposure is too risky before audit/scopes.
- Client Approval Portal: strong agency value, but external access security deserves a separate design pass.
- Campaign Objects: high long-term value, but broad schema and IA change.

## 5. Mini-PRDs

### 1. Run Doctor Command Center

User story:

As a creator or agency operator, I want every failed publish target to explain what went wrong and what I can safely do next, so I can recover scheduled content without inspecting logs.

Why now:

- The repo already lists failed targets (`lib/repos/posts.ts:134`) and classifies agent-step failures (`lib/agents/recovery.ts:35`).
- T4 ranks this first because it is high value, low effort, and high architecture fit (`docs/research/04-feasibility.md:24`).

Agent architecture:

- Add a recovery service that maps `post_targets.lastError`, account state, connector capability, and attempt count into classes: transient, account, media/constraint, policy/platform, fatal/unknown.
- Keep it separate from actual retry execution. The agent recommends; server action performs.
- Use existing `classifyFailure` patterns where possible (`lib/agents/recovery.ts:35`, `lib/agents/recovery.ts:53`).

UX flow:

1. Dashboard "Needs attention" card lists failed targets with reason and confidence (`app/(dashboard)/dashboard/page.tsx:248`).
2. User sees recommended action: retry, reconnect account, fix media, adjust platform constraints, or contact support.
3. Safe retry button appears only for transient class.
4. Link to run timeline and original post target.

Backend/data changes:

- MVP: no schema change. Use `post_targets.lastError`, `status`, `attempts`, `socialAccountId`, and account status (`db/schema/post-targets.ts:46`, `db/schema/post-targets.ts:48`, `db/schema/social-accounts.ts:30`).
- Optional later: persist `failureClass` and `failureExplanation` for analytics.

Integrations:

- Existing platform connectors and publish worker only.

Guardrails/approval:

- Never retry account/policy/fatal failures without human action.
- Check target ownership and failed status at action time.
- Preserve schedule ledger and target idempotency behavior (`lib/queue/with-ledger.ts:1`, `worker/processors/publish.ts:125`).

Observability/evals:

- Add recovery decision to run/target UI.
- Emit structured log around retries.
- Count failure classes on dashboard later.

Tests:

- Unit tests for classifier examples: 401/token/account, 429/timeout/transient, missing media/constraint, unknown/fatal.
- Server-action tests for tenant scope and stale status.
- Worker retry test that safe retry does not mutate non-failed targets.

Goals:

- Reduce unresolved failed targets.
- Reduce repeat publish failures from preventable causes.

Non-goals:

- No autonomous repair of account credentials.
- No browser automation.

Success metrics:

- Failed targets triaged with class >= 95%.
- Retry action success rate for transient failures.
- Time from failure to user action.

Acceptance criteria:

- Every failed target on dashboard has a reason, recommended action, and trace link.
- Retry button is hidden for account/policy/fatal failures.
- Tests prove cross-tenant targets cannot be retried.

### 2. Platform Constraint Coach

User story:

As a creator composing for many platforms, I want the app to tell me before scheduling why a draft cannot publish on a platform, so I can fix the issue before a worker fails.

Why now:

- Constraint checks already exist in server actions and connector capabilities (`app/(dashboard)/create/actions.ts:186`, `lib/platforms/types.ts:31`, `lib/platforms/constants.ts:13`).
- This is the fastest way to reduce publish failure volume and support burden.

Agent architecture:

- This is mostly deterministic, not LLM-heavy.
- Add an optional AI rewrite suggestion only after deterministic validation returns issues.

UX flow:

1. Composer validates selected platforms/accounts/media as the user edits.
2. Variant tabs show constraint chips: missing image, video required, body too long, unsupported comments/metrics, unaudited private-only note.
3. Schedule button stays disabled until blocking issues are resolved.

Backend/data changes:

- Extract shared validation into a pure module used by `createPost` and the composer.
- No schema change for MVP.

Integrations:

- Existing connector capability metadata only.

Guardrails/approval:

- Server validation remains authoritative.
- Client hints must use the same codes/messages as server validation.

Observability/evals:

- Track validation issue frequency by platform to inform Run Doctor and account health.

Tests:

- Unit tests for every platform's media/text constraints.
- Server/client message parity tests.
- Regression test for TikTok/YouTube video requirement and Instagram image-only MVP (`lib/platforms/tiktok.ts:24`, `lib/platforms/youtube.ts:24`, `lib/platforms/instagram.ts:21`).

Goals:

- Prevent failed jobs caused by known local constraints.

Non-goals:

- No provider API probing in MVP.

Success metrics:

- Reduction in publish failures caused by media/text constraints.
- Lower composer-to-schedule error rate.

Acceptance criteria:

- Blocking platform issues appear before submit.
- Server action rejects the same invalid payload with the same issue code.

### 3. Social Account Health Agent

User story:

As an operator, I want the app to warn me when a connected social account is likely to fail before content is scheduled, so I can reconnect or fix setup early.

Why now:

- Social accounts store status, encrypted tokens, refresh tokens, expiry, scopes, metadata, and errors (`db/schema/social-accounts.ts:14`, `db/schema/social-accounts.ts:29`, `db/schema/social-accounts.ts:30`, `db/schema/social-accounts.ts:31`, `db/schema/social-accounts.ts:32`, `db/schema/social-accounts.ts:36`).
- Token refresh jobs already run on a schedule (`lib/queue/jobs.ts:266`).

Agent architecture:

- A deterministic health evaluator first.
- Optional background worker produces health snapshots or dashboard findings.

UX flow:

1. Accounts page shows green/yellow/red badges.
2. Dashboard "Needs attention" includes unhealthy accounts.
3. Composer warns if selected account has missing scope, inactive status, expired token, missing TikTok/YouTube metadata, or Facebook seed metadata absent.

Backend/data changes:

- MVP: no new table; compute health from existing fields.
- Later: persist `account_health_findings` if trend and history matter.

Integrations:

- Existing OAuth refresh and connector registry.
- Avoid live provider calls by default.

Guardrails/approval:

- Do not refresh or reconnect without user action.
- Avoid exposing token/scopes beyond safe names.

Observability/evals:

- Log health finding counts.
- Correlate health findings to publish failures later.

Tests:

- Unit tests for inactive, expired, missing refresh token, missing scope, missing metadata, and healthy cases.
- UI test for account health badge rendering.

Goals:

- Fewer account-caused publish failures.

Non-goals:

- No automatic OAuth reconnect.
- No platform-review automation.

Success metrics:

- Account-caused failures per week.
- Percentage of failures preceded by a health warning.

Acceptance criteria:

- Accounts page displays a health reason for every unhealthy account.
- Composer warns before scheduling to unhealthy accounts.

### 4. Brand Memory Manager

User story:

As a brand owner, I want to inspect, edit, and reset what the agent has learned about my brand, so future content stays intentional and explainable.

Why now:

- Brand profiles already store voice, banned terms, learned memory, policy rules, disclosure policy, and voice history (`db/schema/brand-profiles.ts:32`, `db/schema/brand-profiles.ts:36`, `db/schema/brand-profiles.ts:40`, `db/schema/brand-profiles.ts:42`, `db/schema/brand-profiles.ts:43`, `db/schema/brand-profiles.ts:44`).
- T2 identifies memory/governance as a core 2026 agent trend (`docs/research/02-trends.md:110`).

Agent architecture:

- Rigel can continue producing learned-memory suggestions.
- Lyra consumes approved memory when generating drafts (`lib/agents/lyra/index.ts:51`).
- Optional later: proposed memory updates require approval before writing.

UX flow:

1. Settings shows learned memory as editable cards.
2. User can edit, clear, or restore previous versions.
3. Run detail shows "memory used" summary.

Backend/data changes:

- MVP: use existing `learnedMemory` and `voiceHistory`.
- Later: structured memory entries with source report/run references.

Integrations:

- No new external services.

Guardrails/approval:

- Only owner/admin can edit memory.
- Show last modified date/user if schema adds history.

Observability/evals:

- Compare draft review holds before/after memory edits.
- Add tests proving Lyra receives the saved memory.

Tests:

- Settings action validation.
- Tenant scoping.
- Lyra input construction includes learned notes.

Goals:

- Make agent memory trustworthy and user-controllable.

Non-goals:

- No automatic cross-brand memory sharing.

Success metrics:

- Brand-safety hold rate.
- User edits/approvals of memory suggestions.
- Repeat generation satisfaction proxy: fewer reviewer edits.

Acceptance criteria:

- User can view/edit/clear learned memory.
- Next generation run uses the updated memory.
- Unauthorized role cannot edit memory.

### 5. Cross-Platform Consistency Auditor

User story:

As a marketer, I want the agent to catch contradictions and missing disclosures across platform variants, so campaigns do not publish inconsistent offers or claims.

Why now:

- Variants are already grouped by generated content/run, and review violations are persisted (`db/schema/generated-content.ts:69`, `lib/repos/content-reviews.ts:24`).
- Castor already gates drafts before Atlas schedules (`lib/agents/castor/index.ts:94`, `lib/agents/atlas/index.ts:116`).

Agent architecture:

- Add comparison service after Lyra drafts and before Castor final decision.
- Use deterministic checks for disclosure/URLs/dates/prices where possible; use LLM only for semantic contradictions.

UX flow:

1. Review queue shows campaign-level consistency findings.
2. Variant editor highlights which platform differs.
3. Reviewer can accept warning, edit the draft, or ask Lyra to revise.

Backend/data changes:

- MVP stores findings in existing `reviewViolations`.
- Later add campaign-level summary if campaign object exists.

Integrations:

- LLM provider for semantic compare; no platform API.

Guardrails/approval:

- Block only clear contradictions/missing required disclosure.
- Warn for soft tone differences.

Observability/evals:

- Count consistency findings by type.
- Add fixtures for price/date/link/disclosure drift.

Tests:

- Table-driven compare tests.
- Castor integration test that conflicting variants are held.

Goals:

- Reduce inconsistent multi-platform campaigns.

Non-goals:

- No engagement prediction.

Success metrics:

- Number of caught inconsistencies.
- Reviewer override rate.
- Reduction in post-publish edits/cancellations.

Acceptance criteria:

- Conflicting platform variants produce a review finding.
- Findings are visible in review queue.
- Accepted warning does not block approved drafts.

### 6. Live Agent Run Control Room

User story:

As an operator, I want to watch an agent run progress live and understand what it is waiting on, so I can intervene without digging through logs.

Why now:

- Run pages, timeline builder, hash verification, and A2A SSE stream pattern already exist (`app/(dashboard)/runs/[runId]/page.tsx:24`, `lib/runs/timeline.ts:4`, `app/api/a2a/route.ts:142`).
- T2 shows streaming/resumability is a current agent UX trend (`docs/research/02-trends.md:144`).

Agent architecture:

- No orchestration rewrite.
- Add internal run-event SSE endpoint backed by `agent_runs` and `agent_steps`.

UX flow:

1. Run detail updates as steps start/complete/fail/pause.
2. Pending approval cards deep-link to review queue.
3. Cost/trace/integrity status are visible.

Backend/data changes:

- MVP: no schema change.
- Later: event table for push-based streams.

Integrations:

- Existing LangSmith links when configured.

Guardrails/approval:

- Use tenant-scoped `getAgentRunForUser`.
- Read-only MVP. Add resume/retry controls later with role checks.

Observability/evals:

- Track stream disconnects and polling interval.
- Keep hash-chain validation visible.

Tests:

- SSE route rejects another tenant's run.
- Timeline events render in chronological order.
- Broken hash chain displays warning.

Goals:

- Improve trust in background agents.
- Reduce support requests like "what is it doing?"

Non-goals:

- No conversational chat with the agent.

Success metrics:

- Run detail visits.
- Time to resolve paused runs.
- Reduced abandoned `awaiting_approval` runs.

Acceptance criteria:

- Owner can stream run step updates.
- Unauthorized user receives 404/403.
- Paused run shows exact reason and next action.

### 7. Campaign Simulation Gate

User story:

As a creator, I want a final campaign-level readiness check before content leaves review, so I can catch strategic or policy issues that single-draft checks miss.

Why now:

- Castor already decides approve/hold and persists review results (`lib/agents/castor/index.ts:67`, `lib/repos/content-reviews.ts:24`).
- Human approval is a major trend and an existing SocialFlow strength (`docs/research/02-trends.md:61`).

Agent architecture:

- Add a simulation/check agent or Castor sub-step that evaluates the whole draft bundle.
- Output: campaign summary, top risks, variant-specific findings, recommendation.

UX flow:

1. Review queue shows campaign scorecard at top.
2. Findings map to drafts.
3. Reviewer can "revise risky drafts" or approve with warnings.

Backend/data changes:

- MVP: store campaign summary in agent step summary and per-draft findings in existing review fields.
- Later: campaign object or review-summary table.

Integrations:

- LLM provider only.

Guardrails/approval:

- Treat simulation as advisory unless it finds deterministic block-level policy issues.
- Do not auto-publish based only on simulation.

Observability/evals:

- Track simulation verdict vs reviewer outcome.
- Add offline fixtures for known risk bundles.

Tests:

- Deterministic test for result shaping and mapping findings to draft ids.
- Castor test that block-level simulation finding holds run.

Goals:

- Better pre-publish campaign quality.

Non-goals:

- No guaranteed engagement forecast.

Success metrics:

- Reviewer acceptance of simulation findings.
- Reduced post-review edits.

Acceptance criteria:

- Campaign scorecard renders for multi-draft runs.
- Findings link to affected drafts.
- Review can proceed after allowed warning override.

### 8. Scheduled Trend Watch Agent

User story:

As a creator, I want the app to keep watching my niche and suggest timely ideas, so I always have relevant content without starting manual research.

Why now:

- Vega research and research queue already exist (`lib/agents/vega/index.ts:40`, `worker/processors/research.ts:14`).
- Search is already optionally wired through Tavily (`lib/agent/tools/web-search.ts:8`, `lib/agent/tools/web-search.ts:12`).

Agent architecture:

- Add saved watch config.
- Worker schedules Vega runs for saved niches.
- Dedupe ideas against generated content/research topic history.

UX flow:

1. Research page adds "Watches."
2. User chooses niche, platforms, frequency, and source options.
3. New ideas appear with "new since last run" and source snippets.

Backend/data changes:

- Add `research_watches` table or extend `research_topics` carefully.
- Reuse `generated_content` idea rows.

Integrations:

- Tavily if configured; otherwise label "model-only" research.

Guardrails/approval:

- Ideas are drafts/recommendations, not publish actions.
- Pro/Premium gating follows current research entitlement pattern (`app/(dashboard)/research/actions.ts:14`).

Observability/evals:

- Track watch run success/failure and idea acceptance.
- Store search status/source count.

Tests:

- Watch scheduler creates exactly one run per period.
- Retry does not duplicate ideas.
- Missing Tavily key degrades visibly.

Goals:

- Increase idea supply and research engagement.

Non-goals:

- No automatic publishing from watches.

Success metrics:

- Ideas accepted or converted to drafts.
- Watch retention.
- Research run failure rate.

Acceptance criteria:

- User can create/pause/delete a watch.
- Watch creates research topic and idea rows.
- UI shows source status.

### 9. Evergreen Content Recycler 2.0

User story:

As a social operator, I want the agent to identify old winning posts and refresh them safely, so high-performing content keeps working without repeating itself.

Why now:

- The repo already lists recyclable winners older than 30 days and has a repurpose action (`lib/repos/posts.ts:361`, `app/(dashboard)/dashboard/actions.ts:10`).
- Generated content can point back to source targets (`db/schema/generated-content.ts:76`).

Agent architecture:

- Expand current repurpose action into a workflow that uses metrics, source content, brand memory, and optional trend context.

UX flow:

1. Dashboard shows top recyclable winners.
2. User clicks "Create refresh campaign."
3. Agent drafts variants and routes through review.

Backend/data changes:

- MVP: no schema change; keep `derivedFromTargetId`.
- Later: evergreen schedule preferences.

Integrations:

- Existing metrics and LLM.

Guardrails/approval:

- Enforce freshness window and similarity check.
- Always route refreshed drafts through review.

Observability/evals:

- Compare refreshed post performance to source.
- Track duplicate/similarity hold rate.

Tests:

- Reject too-new target.
- Store `derivedFromTargetId`.
- Similarity checker holds near-duplicates.

Goals:

- More output from proven content.

Non-goals:

- No automatic repost without review.

Success metrics:

- Refreshed drafts scheduled.
- Engagement lift vs account baseline.
- Duplicate content warnings.

Acceptance criteria:

- Winner card can generate refreshed drafts.
- Drafts are linked to source target.
- Review queue receives refreshed variants.

### 10. Agent Spend and Budget Governor

User story:

As an owner/admin, I want to cap or pause expensive agent runs, so automated content workflows do not exceed budget expectations.

Why now:

- Usage capture, cost estimation, and run cost aggregation already exist (`lib/llm/usage.ts:57`, `lib/billing/cost-model.ts:46`, `lib/repos/agent-runs.ts:183`).
- T2 identifies governance and observability as production-agent expectations (`docs/research/02-trends.md:161`, `docs/research/02-trends.md:178`).

Agent architecture:

- Budget guard wraps model-invoking steps.
- If a predicted or actual threshold is exceeded, pause run and require approval or cheaper mode.

UX flow:

1. Run start form shows estimated budget for selected template/platform count.
2. Run detail shows actual spend by step.
3. If budget exceeded, run pauses with approve/stop options.

Backend/data changes:

- MVP: per-run budget in `AgentRunPlan`.
- Later: account/brand monthly budgets and alert thresholds.

Integrations:

- LLM provider cost model only.

Guardrails/approval:

- Costs are estimates, never billed amounts.
- Only owner/admin can raise budget.

Observability/evals:

- Track estimate vs actual.
- Alert on unknown model/rate fallback.

Tests:

- Fake usage exceeds budget and prevents next enqueue.
- Unknown model uses fallback and displays estimate.
- Non-admin cannot approve budget increase.

Goals:

- Protect margin and user trust.

Non-goals:

- No payment/billing-provider changes in MVP.

Success metrics:

- Runs paused before overspend.
- Estimate error rate.
- Admin budget override rate.

Acceptance criteria:

- Run can declare budget.
- Budget crossing pauses before next costly step.
- UI clearly says estimate, not charge.

## 6. Build First

Build first as a tight reliability/governance slice, not a new autonomous feature:

1. Extract platform constraint validation.
   - Create a shared pure validation module used by `app/(dashboard)/create/actions.ts:186` and composer UI.
   - Add table-driven tests for every connector capability from `lib/platforms/types.ts:31` and `lib/platforms/constants.ts:13`.

2. Add Run Doctor classifier for publish targets.
   - Extend or wrap `lib/agents/recovery.ts:35` with publish-target classes.
   - Use `post_targets.lastError`, `attempts`, `status`, and account status (`db/schema/post-targets.ts:46`, `db/schema/post-targets.ts:48`, `db/schema/social-accounts.ts:30`).
   - Add tests mirroring `lib/agents/recovery.test.ts:6`.

3. Add dashboard triage UI.
   - Replace the current failed-target list area with reason/action cards in `app/(dashboard)/dashboard/page.tsx:248`.
   - Link to run detail where available.

4. Add safe retry action.
   - Server action must re-check owner, target status, failure class, and attempts before enqueueing.
   - Do not retry account/policy/fatal failures.

5. Add account health evaluator.
   - Compute local health from `social_accounts` fields first.
   - Show badges on accounts page (`app/(dashboard)/accounts/page.tsx:35`) and composer warnings.

6. Verification gates.
   - Run `npm run lint`, `npm run typecheck`, `npm run test`, and targeted new tests.
   - Do not require live provider credentials for this first slice.

Expected first deliverable:

- A user can open the dashboard, see why each failed publish is blocked, fix or retry safely, and see account/platform constraints before scheduling new content.

## 7. Research Later

Defer these until the first slice is shipped and live-provider behavior is better understood:

- SocialFlow MCP Server: design read-only tools, scoped tokens, audit table, and revocation before implementation.
- Public A2A integrations: keep disabled until tenant trust boundaries and buyer demand are validated.
- Reply Copilot Inbox: design Meta-only held-reply workflow first; never relax abuse/complaint auto-reply block without a separate review.
- Source-to-Campaign Repurposer: research copyright/source citation model and SSRF-safe fetching before URL ingest.
- Metrics-Driven Variant Bandit: collect sample-size evidence and start with recommendations before auto-allocation.
- Client Approval Portal: design external token/expiry/email-binding/audit model.
- Campaign Objects: write a schema/IA migration plan because it touches many core tables.
- Browser/computer-use workflows: revisit only if a specific platform workflow cannot be achieved through official APIs.
- C2PA/SynthID or deep AI-disclosure automation: master plan already notes disclosure-policy deadlines and deferral decisions (`docs/MASTER_PLAN.md:309`); this needs a compliance-specific design pass.

## Final Self-Check

- The roadmap is grounded in T1 repo intelligence, T2 primary-source trends, T3 feature ideas, and T4 feasibility ranking.
- Every top feature ties to existing repo files and avoids code changes.
- The plan favors buildable, governed agent workflows over generic chatbot features.
- External sources include URL plus date or access date.
