# Research Task 3 — Feature Ideation (AI-agent features for SocialFlow)

_Compiled 2026-06-24. Read-only research. Grounded in a full read of `package.json`, all 19 `db/schema/*` files, `lib/agent/*` (LangGraph content pipeline), `lib/agents/*` (the Orion roster), the 11 `worker/processors/*`, `lib/queue/jobs.ts`, the `app/(dashboard)/*` routes, `lib/platforms/*`, `lib/a2a/*` + `lib/mcp/*`, `lib/billing/plans.ts`, and `docs/research/ai-agent-trends-2026-06-22*.md`._

## What already exists (so I don't re-propose it)

Verified in code, do **not** re-pitch these:

- **Roster + orchestrator (Orion).** 8 agents — Vega (research), Lyra (generate), Castor (brand-safety gate), Atlas (schedule/publish), Sirius (engagement registration), Rigel (reporting), Polaris (seeding). Durable, idempotent handoffs on BullMQ/Postgres (`lib/agents/orchestrator.ts`). A **supervisor hook already exists but is unused** (`OrchestratorDeps.supervisor`, `lib/agents/orchestrator.ts:66`).
- **LangGraph content pipeline.** `analyze → draftPerPlatform → critique → (refine ↩ ≤2 | finalize)` (`lib/agent/graph.ts`).
- **HITL approval gate** (Castor pause/resume + `app/(dashboard)/review/`), **brand-safety evals** (`evals/brand-safety/`), **policy/ToS linter** (`lib/compliance/policy-linter.ts`), **AI-disclosure ledger** (`db/schema/disclosure-ledger.ts`, Atlas applies it), **per-brand memory** (`brand_profiles.learnedMemory`), **least-privilege capability matrix** (`lib/agents/capabilities.ts`), **MCP inward** (`lib/mcp/`), **A2A outward** (`lib/a2a/`, one skill `draft-and-schedule`), **Glass-Box run inspector** (`app/(dashboard)/runs/[runId]`), **workspace roles** (`db/schema/memberships.ts`), **platform-native previews** (`lib/platforms/preview.ts`).

## The biggest unexploited seams I found (most ideas below build on these)

1. **Metrics are read but never written.** `PostMetrics`/`fetchMetrics` exist on every connector (`lib/platforms/base.ts:52`), `post_targets.metrics`/`metricsUpdatedAt` columns exist, and Rigel *reads* them (`lib/agents/rigel/aggregate.ts:13`) — but **no worker ever calls `fetchMetrics` to populate them.** The analytics feedback loop is open at the data-ingest end. Huge leverage.
2. **`learnedMemory` is a shapeless blob.** Only Rigel writes top-topics into it (`setLearnedMemory`, `lib/repos/brand-profiles.ts:112`); Lyra reads `learnedNotes` as flat text (`lib/agent/state.ts:20`). No structured per-platform / per-time-slot / per-format learning.
3. **The supervisor is a no-op.** Dynamic routing, bounded regenerate, and escalation are designed-for but unimplemented (`lib/agents/orchestrator.ts:66`, `220`).
4. **Sirius is purely operational** and the engagement loop only does keyword→template/AI replies (`worker/processors/reply.ts`). No intent/sentiment triage, no DM handling, no escalation.
5. **The composer is a blank form.** `app/(dashboard)/create/` starts from a topic string; there's no idea→calendar agent, no repurposing of existing winners.
6. **No metering / spend caps / prompt-caching** despite usage tracking existing (`db/schema/usage.ts`, `lib/billing/plans.ts`) — flagged P2 in the refresh doc.

---

# Ideas by theme

Themes: **A. Generation & ideation · B. Distribution & scheduling · C. Analytics & feedback loops · D. Governance & compliance · E. Growth & engagement · F. Ops & observability.**

---

## A. Generation & ideation

### A1 — Cadence Architect (autonomous content-calendar planner)
- **User problem.** Solo creators and small social teams stare at a blank composer and a blank calendar. They know their niche but not *what to post Tue/Thu/Sat for the next two weeks across 4 platforms*. Today the product only generates one topic at a time on demand (`app/(dashboard)/create/`).
- **Agent behavior.** A new **Mensa** planning agent runs a loop: (1) pull the tenant's recent winners and gaps from the latest `reports` row + `learnedMemory` (feed-forward already exists at `lib/agents/orchestrator.ts:266`), (2) call Vega for 1–2 fresh research pulls to fill content gaps, (3) generate an N-slot calendar plan (topic + platform mix + intended format + rough send-time) as a structured object, (4) for each approved slot, hand off to the **existing** Lyra→Castor→Atlas pipeline with a scheduled `runAt`. It decides slot count and platform mix from plan tier + past cadence; it does **not** auto-publish (Castor still gates).
- **Workflow UI.** A "Plan my next 2 weeks" button on `/calendar` opens a generated draft calendar (reuse `CalendarGrid`) with each slot editable/removable before commit; one "Approve plan" enqueues the runs.
- **Data needed.** New `content_plans` (id, clerkUserId, periodStart, status, slots jsonb[{topic, platforms, format, plannedAt, runId?}]). Reuses `reports`, `brand_profiles.learnedMemory`, `posts`/`post_targets`.
- **Integrations.** None new — internal pipeline + Tavily (already wired in Vega).
- **Trend leveraged.** "Command Marketing": human sets strategy/guardrails, agent executes planning→drafting→scheduling (refresh doc §11).
- **Implementation shape.** New roster agent `Mensa` (capability `plan`) added to `lib/agents/registry.ts`; a new `/api/plans` route + server action; reuses `Orchestrator.startRun` per slot. Mensa is a *planner that emits many runs*, so it sits above Orion rather than inside one run.
- **Files likely touched.** `lib/agents/mensa/index.ts` (new), `lib/agents/types.ts` (+`Mensa`,+`plan`), `lib/agents/capabilities.ts`, `db/schema/content-plans.ts` (new), `app/(dashboard)/calendar/page.tsx`, `app/(dashboard)/calendar/actions.ts` (new).
- **MVP.** Generate a 6-slot, single-niche plan; user approves; slots become scheduled pipeline runs. **Stretch.** Auto-rebalance the plan weekly from Rigel's report; "fill the gap" detection (no posts on a platform in 7 days).
- **Monetization.** Premium feature ("autopilot calendar"); naturally consumes `aiPerMonth` quota (`lib/billing/plans.ts`) — drives upgrades from Pro (200) to Premium (2000).
- **Risk.** Over-generation burning quota/cost; user feels loss of control → mitigate with the mandatory approval step and a slot cap per tier.
- **Validation test.** Wizard-of-Oz: for 5 beta tenants, hand-build a 6-slot plan from their last report and offer one-click scheduling; measure approve-rate and how many slots survive editing. If <50% get approved, the plan quality isn't there.

### A2 — Evergreen Recycler (winner-repurposing agent)
- **User problem.** A post that crushed on LinkedIn never gets re-cut for TikTok or re-run 3 months later. Creators leave their best-performing content to rot. The data to find winners exists (once A-C1 lands) but nothing acts on it.
- **Agent behavior.** A scheduled agent scans published `post_targets` with top engagement (`metrics`), filters out anything posted in the last K days, and for each winner runs a *repurpose* loop: feed the original body + platform + performance into Lyra with a "re-angle for {new platform}, freshen, don't duplicate" instruction, then route through Castor. It decides *which* winners to recycle (engagement percentile) and *to which* platforms (ones the tenant has accounts for but didn't post the winner to).
- **Workflow UI.** A "Recyclable winners" card on `/dashboard`: ranked list of past hits with a "Repurpose →" action that pre-fills the review queue. Optional auto-mode toggle (gated by auto-publish threshold).
- **Data needed.** Reuses `post_targets.metrics`, `generated_content`, `posts.sourceContentId`. New nullable `generated_content.derivedFromTargetId` (uuid) for lineage/dedup.
- **Integrations.** None new.
- **Trend leveraged.** Analytics→generation feedback loop; persistent memory feeding drafting (core trends doc §3, §8).
- **Implementation shape.** New worker processor `recycle.ts` on a daily repeat (mirror `report` cron in `lib/queue/jobs.ts`), enqueuing pipeline runs whose first step is Lyra (skip Vega) — the plan already supports an explicit `steps[0]` (`lib/agents/orchestrator.ts:95`).
- **Files likely touched.** `worker/processors/recycle.ts` (new), `lib/queue/jobs.ts` (register cron + `enqueueRecycle`), `worker/index.ts`, `lib/repos/generated-content.ts`, `app/(dashboard)/dashboard/page.tsx`.
- **MVP.** Manual "Repurpose" button on dashboard winners; one new draft per click. **Stretch.** Fully autonomous weekly recycle into the review queue; cross-platform re-cut with format change.
- **Monetization.** "Get more from content you already made" — strong retention/value story; meter as AI generations.
- **Risk.** Platform duplicate-content penalties; recycling off-brand-aged content → require a freshness re-critique and a minimum gap window.
- **Validation test.** Backfill: take 20 historical winners, generate repurposed variants, have the operator rate "would post" yes/no. >60% yes ⇒ build the autonomous path.

### A3 — Hook Lab (variant generation + bandit selection)
- **User problem.** Creators guess at hooks/openers. The pipeline already generates drafts but collapses to **one variant** (`DRAFT_VARIANTS = 1`, `lib/agent/nodes/draft-per-platform.ts:9`) and `selectBestDraft` picks by static heuristic — there's no *learning* about which opener style wins for this tenant.
- **Agent behavior.** Lyra generates K hook variants per platform; instead of publishing one, Atlas can schedule a small **rotation** and an analytics agent attributes engagement back per-variant, updating a per-tenant **bandit policy** (e.g. Thompson sampling over hook archetypes: question / stat / contrarian / story). Over time draft-per-platform biases toward the tenant's winning archetypes via `learnedMemory`.
- **Workflow UI.** In the review queue, show the K variants with a "let the agent test these" option; a `/dashboard` "Hook performance" panel shows which archetype is winning.
- **Data needed.** `generated_content.variants` already exists (jsonb string[]). New `hook_experiments` (id, clerkUserId, archetype, impressions, engagement, postTargetId). New structured key in `learnedMemory.hookPolicy`.
- **Integrations.** Requires metrics ingestion (depends on **C1**).
- **Trend leveraged.** Trace-based evals + outcome learning; "Outcomes" (core doc §3, §8).
- **Implementation shape.** Bump `DRAFT_VARIANTS`; add a `select-draft` policy that reads `learnedMemory.hookPolicy`; a small pure bandit module `lib/agents/rigel/hook-policy.ts` fed by the metrics job.
- **Files likely touched.** `lib/agent/nodes/draft-per-platform.ts`, `lib/agent/select-draft.ts`, `lib/agents/rigel/hook-policy.ts` (new), `db/schema/hook-experiments.ts` (new), `lib/agents/rigel/aggregate.ts`.
- **MVP.** Generate + show 3 hook variants, record which the human picks (implicit signal), seed a frequency policy. **Stretch.** True multi-armed bandit with live rotation + auto-attribution.
- **Monetization.** Premium "A/B everything" — measurable lift is the upsell.
- **Risk.** Needs enough volume per tenant for statistical signal; small accounts won't converge → fall back to global priors. Variant rotation can confuse brand consistency.
- **Validation test.** Offline: replay historical posts tagged by archetype; check whether one archetype shows materially higher engagement per tenant. No separation ⇒ skip the bandit, keep static variants.

---

## B. Distribution & scheduling

### B1 — Chronos (best-time-to-post optimizer)
- **User problem.** Users pick post times by gut. `posts.scheduledAt` is whatever the human typed; there's zero timing intelligence even though publish jobs are already delay-scheduled (`enqueuePublish({ runAt })`, `lib/queue/jobs.ts`).
- **Agent behavior.** Once metrics ingestion exists (**C1**), an agent learns per-tenant, per-platform engagement-by-hour/by-weekday from `post_targets.publishedAt` + `metrics`, builds a heatmap, and when Atlas (or Mensa) schedules with no explicit time, it picks the next high-value slot respecting per-platform daily caps. It *decides* the slot; the human can override.
- **Workflow UI.** Composer + calendar show "Best time" suggestions ("Recommend a time" button) with a confidence note ("based on 38 past posts"); a heatmap on `/dashboard`.
- **Data needed.** Reuses `post_targets.publishedAt`/`metrics`. New `posting_windows` (clerkUserId, platform, dow, hour, score) materialized by the metrics job, or compute on read from history.
- **Integrations.** None new (uses ingested metrics).
- **Trend leveraged.** Closed-loop optimization, "agent executes optimization" (refresh §11).
- **Implementation shape.** A pure scorer `lib/scheduling/best-time.ts`; Atlas consults it when `scheduledAt` is absent (`lib/agents/atlas/index.ts`); the metrics job refreshes the window table.
- **Files likely touched.** `lib/scheduling/best-time.ts` (new), `lib/agents/atlas/index.ts`, `db/schema/posting-windows.ts` (new), `components/composer/*`, `app/(dashboard)/calendar/page.tsx`.
- **MVP.** Global heuristic defaults per platform + "recommend time" button. **Stretch.** Per-tenant learned heatmap with cold-start blending and cap-aware slotting.
- **Monetization.** Pro/Premium differentiator; "post when your audience is awake."
- **Risk.** Cold-start (new tenants have no history) → blend with platform-wide priors and label confidence; timezone correctness (`posts.timezone` exists — use it).
- **Validation test.** Compute recommended slots from history, compare engagement of posts that happened to land in "recommended" vs "off" windows. No lift ⇒ ship only the global heuristic.

### B2 — Sentinel (pre-flight platform-health & token gate)
- **User problem.** A campaign gets scheduled, then fails at publish time because a token silently expired or an account got rate-limited — discovered only in the "Needs attention" list *after* the fact (`worker/processors/publish.ts` dead-letters on exhaustion). Token refresh is reactive (`worker/processors/token-refresh.ts`).
- **Agent behavior.** Before Atlas commits a batch, a **Sentinel** check (best run as the *supervisor* override, which is currently a no-op) verifies for each target account: token validity (`social_accounts.status`/`tokenExpiresAt`), recent rate-limit headroom (`rate_limits` bucket), and platform-specific publishability (media required? over limit? — reuse `analyzePreview`). If a target would fail, it reroutes: hold that target, surface a fix-it task, and proceed with healthy ones rather than scheduling a doomed job.
- **Workflow UI.** A "Pre-flight" panel in the review queue and a `/accounts` health badge ("Token expires in 6h — reconnect"). Blocked targets show the exact reason.
- **Data needed.** Reuses `social_accounts`, `rate_limits`, `post_targets`. No new tables (optionally a `preflight_checks` audit row).
- **Integrations.** Platform token-introspection endpoints already abstracted via `refreshToken`/connector.
- **Trend leveraged.** Least-privilege + supervisor routing + guardrails before high-impact actions (core §1, §9).
- **Implementation shape.** **Implements the dormant `supervisor`** in `lib/agents/orchestrator.runtime.ts`: after Castor, the supervisor inspects target health and can override Atlas's handoff (`lib/agents/orchestrator.ts:220`). Cleanly fits the existing seam without a rewrite.
- **Files likely touched.** `lib/agents/supervisor.ts` (new), `lib/agents/orchestrator.runtime.ts`, `app/(dashboard)/review/review-queue.tsx`, `app/(dashboard)/accounts/page.tsx`.
- **MVP.** Token/expiry + active-account pre-check that holds bad targets and shows a reason. **Stretch.** Rate-limit-headroom forecasting and auto-defer to a safe window.
- **Monetization.** Reliability is a Premium/agency trust feature; reduces support load.
- **Risk.** False "unhealthy" positives blocking valid posts → make holds reversible and conservative.
- **Validation test.** Instrument current publish failures by root cause for 2 weeks; if >X% are token/rate-limit (knowable ahead of time), Sentinel prevents them — measure projected failure reduction.

---

## C. Analytics & feedback loops

### C1 — Pulse (the missing metrics-ingestion agent) ★ foundational
- **User problem.** SocialFlow can publish but is **blind to what happened next.** Rigel's reports read `post_targets.metrics`, but nothing populates them — so engagement is effectively always zero and every "learning" loop is starved. This is the single highest-leverage gap in the codebase.
- **Agent behavior.** A repeating per-account agent (like comment-poll) walks recently-published targets and calls the connector's already-defined `fetchMetrics(account, externalPostId)` (`lib/platforms/base.ts:52`), writing `metrics` + `metricsUpdatedAt`. It backs off on a maturity curve (poll a post more often in its first 48h, then taper) and stops once metrics stabilize — an agentic schedule, not a dumb cron.
- **Workflow UI.** Per-post metrics on `/posts/[id]` and `/calendar` (the `externalUrl` already renders); a real engagement column on `/dashboard`.
- **Data needed.** Writes existing `post_targets.metrics`/`metricsUpdatedAt`. New `rate_limits` buckets per platform read API (reuse existing pattern).
- **Integrations.** Platform read APIs (Meta Graph insights, LinkedIn, TikTok, X, YouTube) via existing connectors; `fetchMetrics` is unimplemented per-connector and would be filled in.
- **Trend leveraged.** Observability/outcomes; durable background agents (core §8, §10).
- **Implementation shape.** New `worker/processors/metrics-poll.ts` + `registerMetricsPoll(socialAccountId)` repeat job, registered by Sirius alongside comment-poll (`lib/agents/sirius/index.ts` already calls `registerCommentPoll`). Mirrors `comment-poll.ts` watermark/idempotency design.
- **Files likely touched.** `worker/processors/metrics-poll.ts` (new), `lib/queue/jobs.ts`, `worker/index.ts`, `lib/agents/sirius/index.ts`, `lib/platforms/{facebook,instagram,linkedin,tiktok,x,youtube}.ts` (`fetchMetrics`), `lib/repos/posts.ts`.
- **MVP.** One platform (Meta) metrics poll on a fixed interval, surfaced on `/posts/[id]`. **Stretch.** Maturity-curve adaptive polling across all platforms + metric normalization for cross-platform comparison.
- **Monetization.** Analytics is table-stakes for paid tiers; **and it unlocks A2/A3/B1** (every learning feature depends on this). Justifies Pro+.
- **Risk.** Read-API rate limits and per-platform metric heterogeneity (impressions vs views vs plays) → normalize into a common schema; respect `rate_limits`.
- **Validation test.** Implement Meta `fetchMetrics`, poll 50 real published posts, confirm non-null metrics land and Rigel's `topTopics` ranking changes. If connectors can't return metrics reliably, this is a platform-API problem to solve first.

### C2 — Rigel Narratives (insight agent that explains *why*, not just counts)
- **User problem.** Rigel produces counts (totalPublished, topTopics, runSuccessRate — `lib/agents/rigel/aggregate.ts`) but no *narrative*: "Short video on TikTok outperformed your LinkedIn text 4:1 this week; lean in." Users get numbers, not decisions.
- **Agent behavior.** After the daily report compiles, an LLM agent reads the structured `ReportData` + week-over-week deltas and produces 3–5 plain-language, *actionable* insights with a recommended next action ("recycle X", "drop platform Y for this niche"), each linking to a one-click follow-up (kick a recycle/plan run). It writes structured recommendations into `learnedMemory` so Lyra/Mensa can consume them.
- **Workflow UI.** A "This week's insights" card on `/dashboard` with action buttons; weekly email digest (reuse worker patterns).
- **Data needed.** Reuses `reports.data`; new `report_insights` (reportId, text, action jsonb) or store inside `reports.data.insights`.
- **Integrations.** None new; optional email send.
- **Trend leveraged.** LLM-as-judge/summarizer on production traces; generative UI surfacing agent output (refresh §8).
- **Implementation shape.** Extend `lib/agents/rigel/index.ts` with a post-aggregate LLM step (Rigel keeps `report` capability — read-only, no publish).
- **Files likely touched.** `lib/agents/rigel/index.ts`, `lib/agents/rigel/narrate.ts` (new), `db/schema/reports.ts` (extend `ReportData`), `app/(dashboard)/dashboard/page.tsx`.
- **MVP.** Generate 3 insight sentences from the existing report; render them. **Stretch.** WoW deltas + one-click "act on this" that starts the relevant pipeline run.
- **Monetization.** "Your weekly strategist" — sticky Premium value; reduces churn.
- **Risk.** LLM hallucinating numbers → ground strictly on the structured report object, never free-form stats; spot-check with evals (harness exists).
- **Validation test.** Generate narratives for 10 historical reports; operator rates each insight "useful / generic / wrong." >50% useful and ~0% wrong ⇒ ship.

---

## D. Governance & compliance

### D1 — Praxis Live (continuously-refreshed platform-policy watcher)
- **User problem.** The ToS/policy linter is a **static regexp pack** (`lib/compliance/policy-linter.ts`, 6 hardcoded rules). Platform rules change constantly (banned hashtags, link policies, AI-label requirements). A stale linter gives false confidence and lets policy-violating posts through Castor.
- **Agent behavior.** A scheduled research agent (reuse Vega's web-search tool) monitors each platform's policy/help pages and recent enforcement news, diffs against the current rule pack, and **proposes** new/updated linter rules (structured: pattern or LLM-classifier prompt + severity + platform + citation). A human approves before rules go live (governance gate). Castor then lints against the refreshed pack.
- **Workflow UI.** A `/compliance` "Policy updates" tab: proposed rule changes with the source citation and a diff, Approve/Reject per rule (Agent-Inbox action model).
- **Data needed.** New `policy_rules` (id, platform, kind, pattern/prompt, severity, sourceUrl, version, status) to make the pack DB-backed + versioned. Reuses `disclosure_ledger.policyVersion` convention.
- **Integrations.** Tavily (already in Vega); optionally an MCP server per platform docs.
- **Trend leveraged.** Compliance-as-a-feature; disclosure/provenance is a deadline-driven differentiator (refresh §11, §4 feature areas).
- **Implementation shape.** New worker `policy-watch.ts` (weekly cron) → proposes rows; Castor's `lintPolicy` reads the DB pack instead of the static array.
- **Files likely touched.** `worker/processors/policy-watch.ts` (new), `db/schema/policy-rules.ts` (new), `lib/compliance/policy-linter.ts` (read DB pack), `app/(dashboard)/compliance/page.tsx`, `lib/agents/castor/index.ts` (inject DB linter).
- **MVP.** Make the linter DB-backed + editable in the UI (no watcher yet). **Stretch.** Autonomous weekly policy-diff proposals with citations.
- **Monetization.** Enterprise/agency compliance assurance; "always-current ToS safety" is a real buyer requirement.
- **Risk.** Hallucinated/over-broad rules blocking legitimate content; scraping policy pages may break → keep human approval mandatory, cite sources, allow per-rule rollback by version.
- **Validation test.** Run the watcher against last 6 months of known platform-policy changes; measure precision/recall of proposed rules vs what actually changed. Low precision ⇒ keep it advisory-only.

### D2 — Provenance Verifier (C2PA / SynthID embedding agent at publish)
- **User problem.** The disclosure engine records *that* a post is AI-assisted (`disclosure_ledger`, text labels) but doesn't embed **machine-readable provenance** (C2PA Content Credentials / SynthID) into media — which TikTok/Meta enforce and EU AI Act Art. 50 (2 Aug 2026) + CA SB 942 (live) require for synthetic media. Text disclosure ≠ a detectable watermark.
- **Agent behavior.** At the Atlas publish step, for AI-generated/edited media a provenance agent: signs the asset with C2PA Content Credentials (and/or SynthID where available), verifies the embed succeeded, sets `disclosure_ledger.platformLabelApplied`, and sets the platform's native AI-content flag via the publish API. If embedding fails, it can hold the post (policy-configurable) rather than ship unlabeled.
- **Workflow UI.** `/settings` disclosure policy gains a "Embed Content Credentials" toggle + jurisdiction selector; `/compliance` shows per-post provenance status (embedded / native-flagged / failed).
- **Data needed.** Extend `disclosure_ledger` with `c2paManifestId`, `watermarkMethod`, `verifiedAt`. Reuses `media_assets.transformations` (already tracks AI edits).
- **Integrations.** C2PA tooling / Content Credentials SDK; ImageKit (already used) for re-upload of signed media; per-platform "AI content" publish flags (Meta/TikTok APIs).
- **Trend leveraged.** AI-content disclosure/provenance — the named **P0 not-built** item (refresh §3, §11).
- **Implementation shape.** New `lib/compliance/provenance.ts` invoked inside Atlas's existing `applyDisclosure` path (`lib/agents/atlas/index.ts`); media re-signed before the publish job enqueues.
- **Files likely touched.** `lib/compliance/provenance.ts` (new), `lib/agents/atlas/index.ts`, `lib/repos/disclosure-ledger.ts`, `db/schema/disclosure-ledger.ts`, `app/(dashboard)/settings/disclosure-policy-form.tsx`.
- **MVP.** Embed C2PA Content Credentials on AI images + set platform native AI flag for one platform; ledger records manifest id. **Stretch.** SynthID for supported models, video provenance, hold-on-failure policy, detection-tool link (SB 942).
- **Monetization.** Compliance gate for EU/CA and enterprise — *deadline-driven*, defensible premium add-on.
- **Risk.** C2PA/watermark support varies by platform and is partly post-cutoff/immature; double-watermarking artifacts → pilot per platform, keep text disclosure as the always-on baseline.
- **Validation test.** Embed Content Credentials on 10 generated images, re-download from one platform, verify the manifest survives and the native AI label shows. If platforms strip it, fall back to native-flag + text disclosure and document the gap.

---

## E. Growth & engagement

### E1 — Sirius Triage (intent-aware comment & DM responder)
- **User problem.** Auto-reply is keyword→template/AI only (`auto_reply_rules`, `worker/processors/reply.ts`). It can't tell a sales lead from a troll from a support question, and it ignores DMs. Brands either over-reply with canned text or drown in moderation.
- **Agent behavior.** When comment-poll ingests an event (`comment_events`), a triage agent classifies **intent + sentiment** (lead / question / praise / complaint / spam / abuse) and routes: auto-reply the safe buckets with context-aware copy (using brand voice + the original post), **escalate** leads/complaints to a human inbox, and **suppress/flag** abuse (never auto-engage). It decides the route; high-risk buckets always require approval.
- **Workflow UI.** An "Engagement inbox" (extend `/auto-reply` Activity tab) grouped by intent, with suggested replies the human can Accept/Edit/Send/Ignore; escalations badge the dashboard.
- **Data needed.** Extend `comment_events` with `intent`, `sentiment`, `priority`. Reuses `auto_reply_rules` for the safe-bucket policies.
- **Integrations.** Platform comment + **DM** APIs (extend connectors with `fetchDirectMessages`); LLM classifier.
- **Trend leveraged.** "Comment/DM triage" as a named Command-Marketing capability (refresh §11).
- **Implementation shape.** Add a classify step in `worker/processors/comment-poll.ts` (it already classifies against rules — extend with an LLM intent pass); escalations write to a new inbox repo; safe buckets flow through existing `reply.ts`.
- **Files likely touched.** `worker/processors/comment-poll.ts`, `worker/processors/reply.ts`, `lib/repos/replies.ts`, `db/schema/comment-events.ts`, `app/(dashboard)/auto-reply/page.tsx`.
- **MVP.** LLM intent+sentiment tag on ingested comments; show grouped inbox; auto-reply only "question/praise". **Stretch.** DM ingestion, lead escalation to email/Slack, abuse suppression with audit.
- **Monetization.** Engagement automation is a clear Pro/Premium feature (auto-reply is already plan-gated, `autoReply` in `lib/billing/plans.ts`).
- **Risk.** Mis-replying to abuse/complaints is a brand hazard → never auto-engage negative/abuse buckets; keep escalation human-gated; prompt-injection from hostile comments (sanitize, never let comment text drive tool calls).
- **Validation test.** Label 200 historical `comment_events` by intent; check classifier agreement with human labels. >80% on the safe buckets ⇒ enable auto-reply for those only.

### E2 — Conversation Closer (lead-capture follow-through agent)
- **User problem.** Once E1 flags a lead in comments/DMs, there's no follow-through — the lead goes cold. Creators monetizing via DMs lose conversions.
- **Agent behavior.** For escalated "lead" events, an agent drafts a personalized first-touch reply (grounded in the commenter's text + the post topic + brand voice), proposes a next step (link, booking, lead magnet), and — only on human approval or above a confidence threshold — sends it; it tracks the thread state (awaiting reply / converted / dropped) and nudges the human when a lead stalls.
- **Workflow UI.** A "Leads" lane in the engagement inbox with thread state and a one-click approved send; conversion tagging.
- **Data needed.** New `lead_threads` (id, commentEventId, state, lastTouchAt, notes). Reuses `comment_events`.
- **Integrations.** DM/comment reply APIs; optional CRM via an MCP/Zapier connector (a Zapier MCP is available in this environment).
- **Trend leveraged.** Agentic workflow UI (approval inbox) + Command-Marketing execution (refresh §8, §11).
- **Implementation shape.** Builds on E1's escalation output; a small state machine in a new `lib/agents/engagement/leads.ts` consumed by the inbox actions.
- **Files likely touched.** `lib/agents/engagement/leads.ts` (new), `db/schema/lead-threads.ts` (new), `app/(dashboard)/auto-reply/*`.
- **MVP.** Draft + human-approved single follow-up reply on flagged leads. **Stretch.** Multi-touch nudging + CRM hand-off via MCP.
- **Monetization.** Direct revenue impact for the user → easiest "this pays for itself" upsell; agency tier.
- **Risk.** Spam/over-DM violates platform rules; pushy automation hurts brand → strict per-thread caps, human approval default, opt-in only.
- **Validation test.** Manually run the loop for 10 real leads via the inbox; measure reply→conversion lift vs no follow-up. Build automation only if the human-approved version converts.

---

## F. Ops & observability

### F1 — A2A Campaign Delegation (productized inbound agent skill)
- **User problem.** SocialFlow exposes A2A with a single skill (`draft-and-schedule`, `lib/a2a/agent-card.ts`) but it's not productized — an enterprise customer's marketing-ops agent can't yet *discover and delegate* richer jobs (e.g. "report on last month", "recycle winners", "plan next sprint"). The enterprise distribution story is half-built.
- **Agent behavior.** Expand the Agent Card with discoverable skills mapped to existing roster runs (research, report, plan, recycle), implement `message/stream` for live drafting progress, and add per-tenant identity + scope enforcement so an inbound A2A call runs under the right workspace with least privilege (capability matrix already exists). The SocialFlow agent accepts a structured campaign brief and returns task ids (pairs with long-running publish/render).
- **Workflow UI.** A `/settings` "Agent access (A2A)" panel: per-workspace enable, scoped tokens, and an audit of inbound delegated runs (reuse `/runs`).
- **Data needed.** Reuses `agent_runs`/`agent_steps` (already tenant-scoped). New `a2a_clients` (id, clerkOrgId, token, scopes).
- **Integrations.** A2A (LangGraph `/a2a/{assistant_id}` shape); JSON-RPC `message/send|stream`, `tasks/get`.
- **Trend leveraged.** A2A outward, enterprise delegation (core §6; refresh §3 feature areas).
- **Implementation shape.** Extend `lib/a2a/agent-card.ts` + `app/api/a2a/route.ts`; map skills to `Orchestrator.startRun` plans; enforce scope via `lib/agents/capabilities.ts`.
- **Files likely touched.** `lib/a2a/agent-card.ts`, `lib/a2a/protocol.ts`, `app/api/a2a/route.ts`, `db/schema/a2a-clients.ts` (new), `app/(dashboard)/settings/page.tsx`.
- **MVP.** Add `report` + `plan` skills to the card with scoped-token auth and an inbound-run audit. **Stretch.** Streaming progress + task polling/cancel; published discovery endpoint.
- **Monetization.** Enterprise/agency tier — "embed SocialFlow into your agent stack"; usage-metered.
- **Risk.** Inbound delegation = remote code path into your pipeline → strict auth, scope, rate limits, and HITL still gates publishing; the refresh doc explicitly says *don't* build an A2A marketplace pre-PMF, so keep it to known clients.
- **Validation test.** Stand up a toy client agent that delegates "draft & schedule"; confirm it runs scoped under a test workspace and shows in `/runs`. Only productize once one real enterprise asks.

### F2 — Run Doctor (self-healing supervisor for failed/stalled runs)
- **User problem.** When a pipeline run fails or stalls, recovery is manual. The orchestrator records failures (`agent_steps.status = 'failed'`) and the reconcile sweep cleans orphans (`worker/processors/reconcile.ts`), but nothing *diagnoses and retries intelligently* — e.g. a transient model error vs a bad payload vs a token problem need different responses.
- **Agent behavior.** Implement the dormant `supervisor` to, on a failed/looping step, classify the failure (transient → bounded retry with backoff; content-quality → re-route to Lyra refine; account/token → hold + Sentinel fix; hard error → escalate), and apply a bounded recovery action instead of dead-lettering. It enforces a max-recovery budget so it can't loop forever.
- **Workflow UI.** The run inspector (`/runs/[runId]`) gains a "Recovery actions" timeline showing what the supervisor decided and why; a dashboard "Runs needing attention" with one-click human override.
- **Data needed.** Reuses `agent_runs`/`agent_steps` (incl. the `hash`/`prevHash` integrity chain). Optional `recovery_actions` audit rows.
- **Integrations.** None new; LangSmith trace already correlated by `runId`.
- **Trend leveraged.** Supervisor + dynamic routing; durable execution with auto-recovery (core §1, §10).
- **Implementation shape.** **The canonical use of `OrchestratorDeps.supervisor`** (`lib/agents/orchestrator.ts:66`, `220`) — wired in `lib/agents/orchestrator.runtime.ts`; never overrides a pause (the human gate stands, already enforced).
- **Files likely touched.** `lib/agents/supervisor.ts` (new), `lib/agents/orchestrator.runtime.ts`, `worker/processors/agent-step.ts`, `app/(dashboard)/runs/[runId]/page.tsx`.
- **MVP.** Classify transient vs terminal and apply bounded auto-retry/re-route with a recovery budget. **Stretch.** Quality-driven re-route to refine + token-hold integration with Sentinel (B2).
- **Monetization.** Reliability/SLA story for agency + enterprise; fewer failed campaigns.
- **Risk.** Recovery loops burning cost/quota, or masking real bugs → hard recovery budget, full audit in the integrity chain, escalate after N attempts.
- **Validation test.** Replay a sample of historical failed runs through the classifier offline; measure how many would have auto-recovered correctly vs wrongly. High correct-rate ⇒ enable bounded auto-recovery.

---

## G. Cost & packaging (bonus — tied to a flagged P2)

### G1 — Meter & Cap (usage-aware cost governor)
- **User problem.** No per-tenant LLM-cost metering, spend caps, or prompt caching despite usage tracking existing (`db/schema/usage.ts`, `lib/billing/plans.ts`) — flagged P2 in the refresh doc. Agentic loops (Mensa, Recycler, bandits) make runaway cost a real risk, and there's no way to price "per published on-brand post."
- **Agent behavior.** Not a creative agent but an *operational governor* threaded through the pipeline: it records token/cost per run (from LangSmith/model usage), enforces per-tenant spend caps (soft-warn → hard-stop new runs), enables prompt caching on the brand-voice/system prefix, and exposes outcome-based metrics ("published, on-brand posts" count) for value pricing.
- **Workflow UI.** Extend `/billing` Usage tab with cost-to-date, a configurable spend cap, and an "on-brand posts published" outcome meter.
- **Data needed.** Extend `usage` with cost metrics; new `spend_caps` (clerkUserId, monthlyCapCents, action). Reuses `agent_runs` for per-run attribution.
- **Integrations.** LangSmith usage; Anthropic prompt caching (`@langchain/anthropic` already a dep).
- **Trend leveraged.** Cost controls + usage/outcome-based packaging; anti bill-shock (refresh §10).
- **Implementation shape.** A usage recorder in `agent-step` completion + a pre-run cap check in `startRun`/`enqueueAgentStep`; caching flag on the model calls in `lib/agent/_util.ts`.
- **Files likely touched.** `lib/billing/entitlements.ts`, `db/schema/usage.ts`, `worker/processors/agent-step.ts`, `lib/agent/_util.ts`, `app/(dashboard)/billing/page.tsx`.
- **MVP.** Record per-run token cost + show cost-to-date; enable prompt caching. **Stretch.** Hard spend caps + outcome-based ("per on-brand post") meter for value pricing.
- **Monetization.** *Is* the monetization infrastructure — enables usage/outcome pricing and protects margins.
- **Risk.** Hard caps mid-campaign frustrating users → soft-warn first, clear UI; cost attribution accuracy.
- **Validation test.** Instrument cost per run for a week; confirm the numbers match the model bill within tolerance before exposing caps.

---

## My top 5 picks and why

**1. Pulse (C1) — non-negotiable, build first.** It's not the flashiest, but the codebase literally has `fetchMetrics` defined and `post_targets.metrics` read by Rigel with **nothing populating it** — every analytics/optimization feature (Recycler, Hook Lab, Chronos, Narratives) is starved until this exists. Highest leverage per line of code, smallest conceptual risk (mirrors the proven comment-poll pattern). **2. Provenance Verifier (D2)** — the one P0 the research doc flags as *not built*, it's deadline-driven (EU AI Act 2 Aug 2026, CA SB 942 live), platform-enforced, and a defensible compliance upsell that extends the already-built disclosure ledger. **3. Cadence Architect (A1)** — turns SocialFlow from a one-shot composer into an autopilot, the clearest "Command Marketing" embodiment and the strongest upgrade driver, and it composes existing pipeline runs rather than rebuilding them. **4. Sirius Triage (E1)** — engagement is already plan-gated but shallow (keyword→template); intent/sentiment routing + an inbox is a big, well-scoped value jump on the existing comment-poll seam with a clean safety story. **5. Run Doctor (F2)** — it finally *uses* the dormant `supervisor` hook the orchestrator was explicitly built for, converting failures into self-healing recovery; pure-internal, no new platform risk, and a real reliability/SLA story for agency/enterprise. Together these close the product's biggest loop (publish → measure → learn → act), ship the one hard compliance requirement, and light up the two best-architected-but-unused seams (metrics ingestion + supervisor).

---

## Self-check — every idea traces to a real seam (or is flagged greenfield)

| # | Idea | Anchored seam (verified) |
|---|------|--------------------------|
| A1 | Cadence Architect | New agent above Orion; reuses `Orchestrator.startRun` + feed-forward (`lib/agents/orchestrator.ts:266`), `CalendarGrid`. *New table `content_plans` (greenfield).* |
| A2 | Evergreen Recycler | `post_targets.metrics`, `posts.sourceContentId`, explicit `steps[0]` skip-Vega (`lib/agents/orchestrator.ts:95`); new daily processor (mirrors report cron). **Depends on C1.** |
| A3 | Hook Lab | `DRAFT_VARIANTS=1` (`lib/agent/nodes/draft-per-platform.ts:9`), `generated_content.variants`, `select-draft.ts`, `learnedMemory`. **Depends on C1.** *New `hook_experiments`.* |
| B1 | Chronos | `enqueuePublish({runAt})`, `post_targets.publishedAt/metrics`, `posts.timezone`, Atlas scheduling. **Depends on C1.** *New `posting_windows`.* |
| B2 | Sentinel | **Implements dormant `supervisor`** (`lib/agents/orchestrator.ts:220`), `social_accounts.status/tokenExpiresAt`, `rate_limits`, `analyzePreview`. |
| C1 | Pulse | `PostMetrics`/`fetchMetrics` defined but unimplemented (`lib/platforms/base.ts:52`), `post_targets.metrics`/`metricsUpdatedAt` read-only today; mirrors `comment-poll.ts`; Sirius registers polls. |
| C2 | Rigel Narratives | Extends `lib/agents/rigel/index.ts` + `ReportData` (`lib/agents/rigel/aggregate.ts`); Rigel stays `report`-capability. |
| D1 | Praxis Live | Static linter pack (`lib/compliance/policy-linter.ts`), Vega web-search tool, `disclosure_ledger.policyVersion`. *New DB-backed `policy_rules`.* |
| D2 | Provenance Verifier | Atlas `applyDisclosure` path (`lib/agents/atlas/index.ts`), `disclosure_ledger`, `media_assets.transformations`, ImageKit. *C2PA SDK = external/greenfield.* |
| E1 | Sirius Triage | `comment-poll.ts` already classifies vs rules, `comment_events`, `reply.ts`, `auto_reply_rules`. *Adds intent/sentiment columns; DM API greenfield.* |
| E2 | Conversation Closer | Builds on E1 escalations, `comment_events`; Zapier/MCP connector available in env. *New `lead_threads` (greenfield).* |
| F1 | A2A Delegation | `lib/a2a/agent-card.ts` (one skill today), `app/api/a2a/route.ts`, `agent_runs`, capability matrix. *New `a2a_clients`.* |
| F2 | Run Doctor | **Canonical use of `OrchestratorDeps.supervisor`** (`lib/agents/orchestrator.ts:66`), `agent_steps.status/hash`, reconcile sweep, `/runs/[runId]`. |
| G1 | Meter & Cap | `usage` table, `lib/billing/plans.ts`, LangSmith usage, `@langchain/anthropic` caching, `agent-step` completion. *New `spend_caps`.* |

All 14 ideas extend a verified seam; greenfield pieces (new tables, C2PA SDK, DM APIs) are explicitly labeled above. No idea duplicates an already-built capability (cross-checked against the "What already exists" list and the refresh-doc status matrix). No generic chatbot features included.
