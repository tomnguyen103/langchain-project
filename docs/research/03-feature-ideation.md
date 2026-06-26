# T3 Feature Ideation

Date checked: 2026-06-26. This file proposes concrete AI-agent features for this repo only. It uses T1 repo evidence and T2 primary-source trend research. Feature names are working labels, not final product names.

Repo evidence baseline:

- Product: SocialFlow-style AI social content automation for research, draft generation, scheduling/publishing, metrics, and replies (`README.md:1`, `README.md:3`, `README.md:5`).
- Agent foundation: LangGraph content graph, named-agent orchestrator, queued handoffs, review pause/resume, run audit, and workers (`lib/agent/graph.ts:14`, `lib/agents/orchestrator.ts:94`, `lib/agents/orchestrator.ts:121`, `lib/queue/queues.ts:5`, `worker/processors/agent-step.ts:24`, `lib/audit/run-audit.ts:35`).
- Guardrail foundation: Castor review gate, brand-safety guardrail, policy linter, review queue, role checks, and disclosure ledger (`lib/agents/castor/index.ts:67`, `lib/agent/guardrails/brand-safety.ts:66`, `lib/compliance/policy-linter.ts:110`, `app/(dashboard)/review/actions.ts:26`, `db/schema/disclosure-ledger.ts:7`).
- Publishing foundation: eight connectors, with richer comment/metrics support mainly on Facebook and Instagram (`lib/platforms/registry.ts:13`, `lib/platforms/facebook.ts:30`, `lib/platforms/facebook.ts:32`, `lib/platforms/instagram.ts:30`, `lib/platforms/instagram.ts:32`, `lib/platforms/x.ts:21`, `lib/platforms/linkedin.ts:21`).

External trend shorthand used below:

- Background agents: OpenAI workspace agents, 2026-04-22, https://openai.com/index/introducing-workspace-agents-in-chatgpt/; GitHub Copilot coding agent, 2026-02-26, https://github.blog/ai-and-ml/github-copilot/whats-new-with-github-copilot-coding-agent/
- Human approval and resumability: LangGraph HITL docs, accessed 2026-06-26, https://docs.langchain.com/oss/javascript/langgraph/human-in-the-loop; Vercel AI SDK 7, 2026-06-25, https://vercel.com/blog/ai-sdk-7
- MCP and tool ecosystems: OpenAI tool docs, accessed 2026-06-26, https://developers.openai.com/api/docs/guides/tools; GitHub MCP docs, accessed 2026-06-26, https://docs.github.com/en/enterprise-cloud@latest/copilot/customizing-copilot/extending-copilot-coding-agent-with-mcp
- Multi-agent/A2A: Google ADK/A2A, 2026-06-22, https://developers.googleblog.com/build-cross-language-multi-agent-team-with-google-agent-development-kit-and-a2a/
- Memory and skills: Anthropic Agent Skills docs, accessed 2026-06-26, https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview; LangGraph overview, accessed 2026-06-26, https://docs.langchain.com/oss/javascript/langgraph/overview
- Browser/computer use: Anthropic computer-use docs, accessed 2026-06-26, https://docs.anthropic.com/en/docs/build-with-claude/computer-use

## Feature Ideas

### 1. Run Doctor Command Center

- User problem: publish failures are currently visible as failed targets, but the user has to infer whether the cause is credentials, media, quota, platform policy, transient infra, or account setup (`lib/repos/posts.ts:134`, `worker/processors/publish.ts:125`).
- Agent behavior: a recovery agent classifies failed targets, explains the cause, recommends the next action, and optionally queues a safe retry when the failure is transient. It builds on existing Run Doctor failure classification (`lib/agents/recovery.ts:19`, `lib/agents/recovery.ts:35`, `lib/agents/recovery.ts:53`).
- Workflow UI: dashboard "Needs attention" becomes a triage panel with reason, confidence, recommended fix, retry/reconnect buttons, and run/target links (`app/(dashboard)/dashboard/page.tsx:248`).
- Data: reuse `post_targets.lastError`, target status/attempts, schedule ledger, account status, and run steps (`db/schema/post-targets.ts:46`, `db/schema/post-targets.ts:48`, `db/schema/schedules.ts:23`, `db/schema/social-accounts.ts:30`, `db/schema/agent-steps.ts:14`).
- Integrations: platform connectors and OAuth reconnect routes; no new third-party integration required.
- Trend leveraged: background agents plus governance and resumability.
- Implementation shape: add a small recovery service and dashboard/action layer around existing failed-target repository and publish retry helpers.
- Files likely touched: `lib/agents/recovery.ts:35`, `worker/processors/publish.ts:125`, `lib/repos/posts.ts:134`, `app/(dashboard)/dashboard/page.tsx:248`, `app/(dashboard)/create/actions.ts:157`.
- MVP: classify and explain failed targets; retry only transient failures. Stretch: per-platform repair playbooks and automatic account-health checks.
- Monetization: Pro/Premium operational reliability feature; useful to agencies managing many accounts.
- Risk: wrong retry can duplicate or violate platform rate limits. Mitigation: retry only when target remains failed and connector action is idempotent enough; keep human confirmation for account/policy failures.
- Validation test: unit-test classifier mappings and server-action authorization; integration-style test that a failed target is not retried when status or ownership changes.

### 2. Campaign Simulation Gate

- User problem: creators want to know if a multi-platform campaign is off-brand, repetitive, risky, or poorly adapted before publishing.
- Agent behavior: before Atlas schedules, a simulation step critiques the full bundle of platform drafts, predicts likely policy/reach issues, checks consistency, and produces a "ship/hold/fix" recommendation.
- Workflow UI: review queue shows a campaign-level scorecard above individual held drafts, with flagged platform differences and one-click "send back to Lyra" (`app/(dashboard)/review/review-queue.tsx:49`, `app/(dashboard)/review/actions.ts:120`).
- Data: use generated content review fields plus run summary; optionally add a campaign-level summary later (`db/schema/generated-content.ts:69`, `db/schema/agent-steps.ts:30`).
- Integrations: LLM provider only; no external platform APIs required.
- Trend leveraged: human approval and tool-resumable review workflows.
- Implementation shape: add an optional Castor sub-step or a new review-only agent before Castor pauses/resumes.
- Files likely touched: `lib/agents/castor/index.ts:94`, `lib/agent/guardrails/brand-safety.ts:66`, `lib/compliance/policy-linter.ts:110`, `app/(dashboard)/review/review-queue.tsx:49`.
- MVP: campaign-level critique from current drafts and policy findings. Stretch: predicted engagement/reach using historical metrics.
- Monetization: Pro/Premium risk-reduction for auto-publish and agency approvals.
- Risk: simulated predictions can overstate certainty. Mitigation: label as "risk signals," not guaranteed outcomes.
- Validation test: snapshot/unit tests for scorecard construction from known drafts, banned terms, and policy findings; no live LLM in baseline tests.

### 3. Source-to-Campaign Repurposer

- User problem: users already have URLs, long posts, blog drafts, or transcripts but must manually turn them into platform-specific campaigns.
- Agent behavior: ingest a source URL/text, extract claims and assets, generate platform drafts, attach source citations, and route through Castor review.
- Workflow UI: composer gains a "Source" tab next to topic generation; review queue shows source excerpts behind each draft (`components/composer/generate-panel.tsx:23`, `components/composer/variant-editor.tsx:60`).
- Data: extend `generated_content` with source metadata or add source rows; current table already stores topic, content, provider, prompt version, and source linkage to targets (`db/schema/generated-content.ts:19`, `db/schema/generated-content.ts:31`, `db/schema/generated-content.ts:37`, `db/schema/generated-content.ts:75`).
- Integrations: Tavily/search for URL snippets when configured; optional fetch with SSRF constraints similar to ImageKit/media host protections (`lib/agent/tools/web-search.ts:12`, `app/(dashboard)/create/actions.ts:51`).
- Trend leveraged: background agents, tool use, and memory/skills.
- Implementation shape: add a source extraction tool and a new generation endpoint mode; reuse Lyra and Castor.
- Files likely touched: `app/api/generate/route.ts:19`, `lib/agent/prompts.ts:1`, `lib/agent/state.ts:5`, `lib/agent/tools/web-search.ts:8`, `db/schema/generated-content.ts:19`.
- MVP: paste text/URL, generate drafts with source title/url/snippets in metadata. Stretch: uploaded PDFs/slides and claim-check warnings.
- Monetization: Pro content repurposing; Premium source libraries.
- Risk: copyright/source misuse and hallucinated citations. Mitigation: persist source URLs/excerpts and require review before publish.
- Validation test: deterministic extraction tests with mocked fetch/search and a guard that draft citations must reference stored source ids.

### 4. Scheduled Trend Watch Agent

- User problem: niche research is manual or one-shot; users need a steady flow of timely ideas.
- Agent behavior: scheduled Vega runs watch saved niches, collect findings, generate ideas, dedupe against past ideas/posts, and place top ideas in the research page.
- Workflow UI: research page adds saved watches, frequency, platforms, and "new since last run" markers (`app/(dashboard)/research/page.tsx:34`, `app/(dashboard)/research/actions.ts:14`).
- Data: extend `research_topics` or add a watch table; current research topics already hold status/findings/error (`db/schema/research.ts:6`, `db/schema/research.ts:12`, `db/schema/research.ts:17`).
- Integrations: Tavily when configured; model fallback should be clearly labeled as less grounded (`lib/agent/tools/web-search.ts:5`, `lib/agent/tools/web-search.ts:12`).
- Trend leveraged: background agents and durable state.
- Implementation shape: add recurring queue job using existing research processor and schedule ledger pattern.
- Files likely touched: `lib/agents/vega/index.ts:40`, `worker/processors/research.ts:14`, `lib/queue/jobs.ts:75`, `app/(dashboard)/research/page.tsx:34`, `db/schema/research.ts:6`.
- MVP: weekly saved watch for Pro users. Stretch: competitor/source lists and alert thresholds.
- Monetization: Pro/Premium research automation.
- Risk: stale or low-quality search results. Mitigation: source citations and clear search-provider status.
- Validation test: queue job creates/updates a research topic once per watch window and does not duplicate ideas on retry.

### 5. Cross-Platform Consistency Auditor

- User problem: platform variants can drift in claims, tone, disclosure, or offer details.
- Agent behavior: compare all variants in a post/campaign, detect contradictory claims, missing disclosures, and tone mismatch, then hold only the risky variants.
- Workflow UI: variant editor and review queue display "inconsistent with Instagram draft" style findings (`components/composer/variant-editor.tsx:91`, `app/(dashboard)/review/review-queue.tsx:124`).
- Data: reuse generated content review fields and post target bodies (`db/schema/generated-content.ts:69`, `db/schema/post-targets.ts:28`).
- Integrations: LLM comparison plus deterministic policy linter.
- Trend leveraged: guardrails, approvals, and evals.
- Implementation shape: pure comparison service called before review/publish; add findings into `reviewViolations`.
- Files likely touched: `lib/agents/castor/index.ts:94`, `lib/compliance/policy-linter.ts:110`, `components/composer/variant-editor.tsx:91`, `db/schema/generated-content.ts:69`.
- MVP: compare factual claims and required disclosure presence. Stretch: brand-voice consistency score across channels.
- Monetization: Pro/Premium brand governance.
- Risk: false positives slow teams down. Mitigation: warn vs block levels and reviewer override.
- Validation test: table-driven tests where variants intentionally omit price, date, or disclosure.

### 6. Agent Spend and Budget Governor

- User problem: users and operators need predictable LLM spend and quotas for autonomous runs.
- Agent behavior: estimate cost before a run, track actual token spend per step, stop or pause when a run crosses a configured budget, and recommend cheaper model modes.
- Workflow UI: run detail shows estimated vs actual spend, per-step token usage, and "budget paused" state (`app/(dashboard)/runs/[runId]/page.tsx:24`, `lib/repos/agent-runs.ts:183`).
- Data: existing cost estimate in agent step summaries and usage tables; add budget policy fields if needed (`lib/llm/usage.ts:57`, `lib/billing/cost-model.ts:46`, `lib/repos/agent-runs.ts:183`, `db/schema/usage.ts:5`).
- Integrations: no new external integration; optional model-provider routing.
- Trend leveraged: governance and production agent observability.
- Implementation shape: budget guard around agent dispatch/model calls, with a pause status using existing `awaiting_approval` or a new run status.
- Files likely touched: `lib/agents/orchestrator.ts:159`, `lib/agent/index.ts:31`, `lib/billing/cost-model.ts:17`, `app/(dashboard)/runs/[runId]/page.tsx:24`.
- MVP: per-run estimate and hard stop by plan tier. Stretch: adaptive model routing and monthly budget alerts.
- Monetization: Premium admin/control feature; protects margin.
- Risk: static model rates drift. Mitigation: centralize rate updates and display "estimate."
- Validation test: fake usage collector crosses threshold and dispatch pauses without enqueuing next step.

### 7. Reply Copilot Inbox

- User problem: auto-replies are useful but risky for complaints, abuse, regulated claims, or high-value leads.
- Agent behavior: classify comments, draft replies, auto-send only low-risk matches, and route sensitive replies to an approval inbox with context.
- Workflow UI: add a Replies tab showing pending suggested replies, source comment, matched rule, sentiment/urgency, and approve/edit/send buttons.
- Data: `comment_events` already stores triage tags, matched rule, reply status, and timestamps; auto-reply rules define template or AI mode (`db/schema/comment-events.ts:17`, `db/schema/comment-events.ts:53`, `db/schema/comment-events.ts:56`, `db/schema/auto-reply.ts:18`, `db/schema/auto-reply.ts:35`).
- Integrations: only connectors that support comments/replies, currently Facebook and Instagram (`lib/platforms/facebook.ts:76`, `lib/platforms/facebook.ts:111`, `lib/platforms/instagram.ts:78`, `lib/platforms/instagram.ts:107`).
- Trend leveraged: human approval and background agents.
- Implementation shape: extend reply processor to create pending reply tasks before posting for risky categories.
- Files likely touched: `worker/processors/comment-poll.ts:22`, `worker/processors/reply.ts:23`, `lib/auto-reply/triage.ts:70`, future `app/(dashboard)/auto-reply/*`, `db/schema/comment-events.ts:17`.
- MVP: held reply queue for abuse/complaint/high urgency. Stretch: lead handoff, CRM/webhook integrations.
- Monetization: Pro engagement automation; Premium for teams and agencies.
- Risk: unsafe replies can harm brand. Mitigation: never auto-reply to abuse/complaints is already in code (`worker/processors/reply.ts:45`); keep that invariant.
- Validation test: comment with complaint intent creates pending approval and does not call connector.postReply.

### 8. Metrics-Driven Variant Bandit

- User problem: users do not know which hooks, formats, or topics work best across platforms.
- Agent behavior: learn from published metrics, propose variant experiments, allocate future slots to winners, and explain why.
- Workflow UI: dashboard "Experiments" panel shows active tests, winning patterns, and recommended next variants.
- Data: `post_targets.metrics`, reports, posting windows, and recyclable winners already exist (`db/schema/post-targets.ts:52`, `db/schema/reports.ts:18`, `db/schema/posting-windows.ts:14`, `lib/repos/posts.ts:361`).
- Integrations: metrics-capable connectors only; currently Meta has metrics support (`lib/platforms/facebook.ts:124`, `lib/platforms/instagram.ts:120`).
- Trend leveraged: background agents, evals, and durable memory/state.
- Implementation shape: analysis service over historical targets; optionally new experiment table for assignments/results.
- Files likely touched: `lib/agents/rigel/index.ts:40`, `worker/processors/metrics-poll.ts:24`, `lib/repos/posts.ts:297`, `app/(dashboard)/dashboard/page.tsx:86`.
- MVP: recommendations from historical winners, no automatic allocation. Stretch: true bandit assignment across scheduled slots.
- Monetization: Premium optimization feature.
- Risk: sparse/noisy data and platform asymmetry. Mitigation: confidence thresholds and "insufficient data" states.
- Validation test: fixture metrics produce deterministic winner recommendations and refuse low-sample advice.

### 9. Campaign Objects and Brief Workspace

- User problem: runs, posts, research, reports, and plans are related but scattered; campaigns need one durable workspace.
- Agent behavior: create and maintain campaign briefs, link research topics, generated drafts, scheduled posts, results, and reports.
- Workflow UI: campaign detail page with brief, goals, assets, runs, review state, calendar, and outcomes.
- Data: no dedicated campaign table exists in the schema barrel; current grouping is indirect through runs/plans/posts/research (`db/schema.ts:1`, `db/schema.ts:8`, `db/schema.ts:9`, `db/schema.ts:10`, `db/schema.ts:15`, `db/schema.ts:18`, `db/schema.ts:28`).
- Integrations: none required.
- Trend leveraged: background agents plus memory/state.
- Implementation shape: add campaign table and foreign keys/nullable campaignId on generated content, posts, research, reports, content plans, and agent runs.
- Files likely touched: `db/schema/agent-runs.ts:28`, `db/schema/posts.ts:13`, `db/schema/generated-content.ts:19`, `db/schema/research.ts:6`, `db/schema/reports.ts:18`, `app/(dashboard)/runs/page.tsx:12`.
- MVP: manual campaign creation/linking. Stretch: agent-created campaign briefs and retrospective reports.
- Monetization: Pro/Premium organization feature.
- Risk: broad schema/UI change. Mitigation: additive nullable campaign fields and gradual linking.
- Validation test: campaign-scoped list only returns tenant-owned linked rows.

### 10. SocialFlow MCP Server

- User problem: power users and teams want external agents to ask SocialFlow for safe actions like "draft this campaign," "list pending approvals," or "retry failed target."
- Agent behavior: expose narrow, tenant-scoped MCP tools backed by existing server actions/repos.
- Workflow UI: settings page for MCP token, allowed tools, last-used logs, and revoke.
- Data: add API token/tool audit table; reuse current app entities.
- Integrations: MCP clients from OpenAI/GitHub/Claude ecosystems.
- Trend leveraged: MCP tool ecosystems.
- Implementation shape: implement MCP server route with allowlisted tools and scoped tokens; do not expose arbitrary DB queries.
- Files likely touched: `lib/mcp/client.ts:5` as contrast, `app/api/a2a/route.ts:46` for token scoping pattern, `lib/repos/agent-runs.ts:69`, `lib/repos/content-reviews.ts:66`.
- MVP: read-only tools plus "start research" and "list pending reviews." Stretch: approved write tools with per-action human confirmation.
- Monetization: Premium integration/platform feature.
- Risk: data exfiltration and unauthorized actions. Mitigation: least-privilege tokens, audit logs, read-only default, per-tool scopes.
- Validation test: MCP tool call with another tenant's token cannot access or mutate data.

### 11. Client Approval Portal

- User problem: agencies need external clients to approve content without giving them full dashboard access.
- Agent behavior: package held drafts and campaign scorecards into a secure approval link; resume Atlas when approvals arrive.
- Workflow UI: review queue can "share approval link"; portal shows preview, findings, approve/reject/comment.
- Data: current roles include approver and review actions require approver permission (`lib/auth/roles.ts:1`, `lib/auth/roles.ts:27`, `app/(dashboard)/review/actions.ts:26`). A portal needs invite/token records.
- Integrations: email later; no platform integration required.
- Trend leveraged: human approval as first-class workflow.
- Implementation shape: add secure review-share tokens scoped to generated content/run ids; reuse review decision repos.
- Files likely touched: `lib/repos/content-reviews.ts:101`, `app/(dashboard)/review/actions.ts:169`, `app/(dashboard)/review/review-queue.tsx:241`, `db/schema/memberships.ts:12`.
- MVP: expiring link for pending reviews. Stretch: branded client portal and comment threads.
- Monetization: Premium agency feature.
- Risk: link leakage. Mitigation: short expiry, optional email binding, audit every decision.
- Validation test: expired/wrong-token link cannot read or decide held drafts.

### 12. Brand Memory Manager

- User problem: learned memory and voice settings affect outputs, but users cannot inspect or prune what the agent has learned.
- Agent behavior: summarize learned patterns, propose memory updates from reports, and ask for confirmation before saving.
- Workflow UI: settings page shows memory cards, source reports, approve/delete controls, and "use in next run" preview.
- Data: brand profile already stores `learnedMemory` and `voiceHistory` (`db/schema/brand-profiles.ts:40`, `db/schema/brand-profiles.ts:44`).
- Integrations: none required.
- Trend leveraged: durable memory and procedural skills.
- Implementation shape: add memory management UI and repo helpers; make Rigel proposals pending before committing if desired.
- Files likely touched: `lib/agents/rigel/index.ts:92`, `app/(dashboard)/settings/brand-profile-form.tsx:49`, `db/schema/brand-profiles.ts:32`, `lib/brand/learned-notes.ts:9`.
- MVP: view/edit/clear learned memory. Stretch: memory proposal review queue with source links.
- Monetization: Pro brand-quality feature; Premium audit trail.
- Risk: user may delete useful memory or retain bad memory. Mitigation: version history and undo.
- Validation test: saved memory changes are tenant-scoped and next Lyra run receives expected notes.

### 13. Industry Policy Packs

- User problem: generic policy linting misses industry-specific risk for healthcare, finance, employment, alcohol, wellness, and political content.
- Agent behavior: apply selectable policy packs, explain findings, and block/hold content according to severity.
- Workflow UI: settings/compliance pages add pack selection and per-rule overrides; review queue shows source policy pack.
- Data: brand profile already stores custom policy rules and disclosure policy (`db/schema/brand-profiles.ts:42`, `db/schema/brand-profiles.ts:43`).
- Integrations: none required for MVP.
- Trend leveraged: governance, guardrails, and approvals.
- Implementation shape: extend deterministic policy linter with curated packs and tests.
- Files likely touched: `lib/compliance/policy-linter.ts:34`, `app/(dashboard)/settings/brand-profile-form.tsx:49`, `app/(dashboard)/quality/page.tsx:27`, `db/schema/brand-profiles.ts:42`.
- MVP: 3 curated packs with warn/block rules. Stretch: LLM-assisted policy classifier and admin-custom packs.
- Monetization: Premium regulated-brand feature.
- Risk: overblocking and legal interpretation. Mitigation: label as automation support, not legal advice; allow admin override.
- Validation test: rule fixtures for each pack and ReDoS-safe matching checks.

### 14. Live Agent Run Control Room

- User problem: users cannot easily watch a long run progress, intervene, or understand why it paused in real time.
- Agent behavior: stream run steps, pending approvals, tool outputs, costs, and next actions; allow permitted interventions.
- Workflow UI: run detail becomes a live control room with timeline, pending action card, retry/resume controls, and trace links.
- Data: existing run/step tables, audit hash, run status, and LangSmith IDs (`db/schema/agent-runs.ts:28`, `db/schema/agent-steps.ts:14`, `lib/runs/timeline.ts:4`, `lib/observability/langsmith.ts:14`).
- Integrations: SSE already exists for A2A task streaming; dashboard can reuse a similar pattern (`app/api/a2a/route.ts:142`).
- Trend leveraged: resumable streams and human-in-the-loop.
- Implementation shape: add internal run SSE endpoint and client UI components; no orchestration rewrite.
- Files likely touched: `app/(dashboard)/runs/[runId]/page.tsx:24`, `lib/runs/timeline.ts:4`, `app/api/a2a/route.ts:142`, `lib/repos/agent-runs.ts:174`.
- MVP: read-only live timeline updates. Stretch: resume/retry/stop buttons with role checks.
- Monetization: Pro/Premium transparency and agency ops feature.
- Risk: streaming endpoint leaks tenant data. Mitigation: use `getAgentRunForUser` and scoped step queries.
- Validation test: SSE endpoint refuses another user's run and emits expected status transitions.

### 15. Evergreen Content Recycler 2.0

- User problem: high-performing old posts are visible, but repurposing is still manual and narrow.
- Agent behavior: identify winners, propose new angles/platforms, adapt to current brand memory and trend context, and schedule review-ready variants.
- Workflow UI: dashboard recyclable winners become "create refresh campaign" cards with preview and proposed schedule (`app/(dashboard)/dashboard/page.tsx:210`, `app/(dashboard)/dashboard/actions.ts:10`).
- Data: recyclable winners from post metrics, derivedFromTargetId on generated content, and sourceContentId on posts (`lib/repos/posts.ts:361`, `db/schema/generated-content.ts:76`, `db/schema/posts.ts:33`).
- Integrations: existing LLM and metrics; optional research.
- Trend leveraged: background agents plus memory/state.
- Implementation shape: expand existing repurpose action that starts Orion/Lyra from a published target.
- Files likely touched: `app/(dashboard)/dashboard/actions.ts:10`, `lib/repos/posts.ts:361`, `lib/agents/lyra/index.ts:38`, `db/schema/generated-content.ts:76`.
- MVP: one-click generate refreshed variants for a winner. Stretch: recurring evergreen queue with freshness limits.
- Monetization: Pro automation; Premium at scale.
- Risk: repetitive content. Mitigation: enforce freshness windows and similarity checks.
- Validation test: repurpose rejects targets newer than freshness window and links derived drafts to source target.

### 16. Platform Constraint Coach

- User problem: failed drafts often come from platform constraints: missing media, wrong type, text too long, unaudited TikTok/YouTube privacy limits, or connector capability gaps.
- Agent behavior: explain platform-specific constraints while drafting and before scheduling; suggest required media/format changes.
- Workflow UI: composer preview shows actionable constraint chips per platform and blocks schedule until fixed.
- Data: platform metadata and connector capabilities already encode limits and requirements (`lib/platforms/constants.ts:13`, `lib/platforms/types.ts:31`, `lib/platforms/instagram.ts:21`, `lib/platforms/youtube.ts:24`, `lib/platforms/tiktok.ts:24`).
- Integrations: none required.
- Trend leveraged: guardrails and tool-aware UX.
- Implementation shape: extract current validation into a shared service used by composer and server actions.
- Files likely touched: `app/(dashboard)/create/actions.ts:186`, `components/composer/variant-editor.tsx:91`, `lib/platforms/constants.ts:13`, `lib/platforms/types.ts:31`.
- MVP: deterministic constraints only. Stretch: AI rewrite suggestions for constraint fixes.
- Monetization: Free/Pro quality improvement; reduces support costs.
- Risk: divergence between client hints and server validation. Mitigation: one shared validation module.
- Validation test: the same invalid payload fails in server action and displays matching UI issue.

### 17. Agent Run Templates

- User problem: teams repeatedly run the same workflows: weekly niche research, launch week, evergreen refresh, crisis watch, holiday campaign.
- Agent behavior: instantiate a predefined or saved plan with agent steps, platforms, approval rules, and budget guardrails.
- Workflow UI: "New run" template picker in dashboard/research/calendar.
- Data: `AgentRunPlan` is already flexible JSON with niche/platforms/steps (`db/schema/agent-runs.ts:17`, `db/schema/agent-runs.ts:23`).
- Integrations: none required.
- Trend leveraged: Anthropic-style skills/procedural memory and background agents.
- Implementation shape: store templates in code or DB, then pass explicit `plan.steps` into orchestrator.
- Files likely touched: `lib/agents/orchestrator.ts:94`, `app/api/agents/run/route.ts:21`, `db/schema/agent-runs.ts:17`, `app/(dashboard)/research/actions.ts:14`.
- MVP: 3 built-in templates. Stretch: tenant-authored templates with admin controls.
- Monetization: Pro/Premium productivity feature.
- Risk: template sprawl and confusing outcomes. Mitigation: keep templates few and observable in run inspector.
- Validation test: template expands to expected first agent and plan payload without bypassing approval.

### 18. Social Account Health Agent

- User problem: disconnected, unconfigured, expired, or limited accounts cause publish failures after users have already scheduled content.
- Agent behavior: regularly check account status, token expiry, connector capability, required metadata, and recent failure patterns; create actionable health findings.
- Workflow UI: accounts page and dashboard show health badges, expiring tokens, missing scopes, and recommended fixes (`app/(dashboard)/accounts/page.tsx:35`, `app/(dashboard)/dashboard/page.tsx:248`).
- Data: social accounts already store encrypted tokens, scopes, status, expiresAt, lastError, and metadata (`db/schema/social-accounts.ts:14`, `db/schema/social-accounts.ts:29`, `db/schema/social-accounts.ts:30`, `db/schema/social-accounts.ts:31`, `db/schema/social-accounts.ts:32`, `db/schema/social-accounts.ts:36`).
- Integrations: OAuth refresh processors and connector capability metadata (`lib/queue/jobs.ts:266`, `lib/platforms/types.ts:31`).
- Trend leveraged: background agents and governance.
- Implementation shape: scheduled health processor plus UI; can reuse token refresh and failed-target signals.
- Files likely touched: `worker/index.ts:87`, `lib/queue/jobs.ts:266`, `app/(dashboard)/accounts/page.tsx:35`, `db/schema/social-accounts.ts:14`.
- MVP: health badges and token-expiry warnings. Stretch: preflight checks before schedule and proactive reconnect emails.
- Monetization: Pro/Premium reliability.
- Risk: platform API limits for active probing. Mitigation: use local state first, only call providers when needed.
- Validation test: expired/inactive/missing-scope account yields expected health finding without network call.

### 19. Approval Analytics and Reviewer SLA

- User problem: agencies need to know where campaigns stall and who approved what.
- Agent behavior: analyze review queue throughput, held reasons, reviewer notes, and aging approvals; suggest policy or memory changes.
- Workflow UI: quality page adds approval funnel, aging held drafts, top hold reasons, and reviewer action history.
- Data: generated content has review status, verdict, violations, reviewer note, reviewedAt, reviewedBy; agent runs have paused/completed status (`db/schema/generated-content.ts:69`, `db/schema/generated-content.ts:71`, `db/schema/generated-content.ts:72`, `db/schema/generated-content.ts:73`, `db/schema/generated-content.ts:74`, `db/schema/generated-content.ts:81`, `db/schema/agent-runs.ts:28`).
- Integrations: none required.
- Trend leveraged: governance and production observability.
- Implementation shape: new analytics repo over generated content and runs; UI on quality/review pages.
- Files likely touched: `lib/repos/quality.ts:21`, `app/(dashboard)/quality/page.tsx:27`, `lib/repos/content-reviews.ts:66`, `app/(dashboard)/review/page.tsx:9`.
- MVP: aging held drafts and hold-reason counts. Stretch: reviewer workload and SLA reminders.
- Monetization: Premium team governance.
- Risk: reviewer surveillance sensitivity. Mitigation: aggregate by default and make per-user views admin-only.
- Validation test: quality report aggregates hold reasons and filters tenant scope.

### 20. External Event Webhooks

- User problem: teams want SocialFlow events in Slack, CRM, n8n, Zapier, or internal dashboards.
- Agent behavior: emit signed events for run paused/completed, draft held, publish failed, publish succeeded, reply held, and report generated.
- Workflow UI: settings integration page with endpoints, secret rotation, event selection, and recent delivery log.
- Data: existing run, review, schedule, target, and report events provide source records (`db/schema/agent-runs.ts:28`, `db/schema/generated-content.ts:69`, `db/schema/schedules.ts:15`, `db/schema/post-targets.ts:18`, `db/schema/reports.ts:18`).
- Integrations: outgoing HTTPS webhooks.
- Trend leveraged: tool ecosystems and background agents.
- Implementation shape: webhook dispatcher queue with signed payloads and retry ledger.
- Files likely touched: `lib/queue/queues.ts:5`, `lib/queue/with-ledger.ts:1`, `worker/index.ts:71`, `lib/repos/agent-runs.ts:35`, `worker/processors/publish.ts:88`.
- MVP: publish failed/succeeded and run awaiting approval. Stretch: event filters and Zapier/n8n templates.
- Monetization: Premium integration feature.
- Risk: leaking content to third-party endpoints. Mitigation: opt-in per event, signing secret, redaction mode, delivery logs.
- Validation test: webhook payload signatures verify and retries stop after max attempts without blocking core workflow.

## Feature Coverage Check

- Count: 20 concrete feature ideas.
- No generic chatbot features: every idea modifies an existing SocialFlow workflow, data surface, or integration boundary.
- Every idea includes user problem, agent behavior, workflow UI, data, integrations, trend leveraged, implementation shape, likely files, MVP/stretch, monetization, risk, and validation test.
- Ideas intentionally vary in effort; T4 will rank which are buildable without a rewrite.
