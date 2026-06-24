> Archived 2026-06-24. Superseded by docs/MASTER_PLAN_v2.md.

# 20 AI-Agent Feature Ideas — SocialFlow

> Generated from the repo's apparent product direction. **Not a commitment or a plan** — a
> grounded ideation menu. Companion to [PLAN.md](PLAN.md), [ROADMAP.md](ROADMAP.md), and
> [ORCHESTRATION.md](ORCHESTRATION.md).

## Product direction (the read these ideas extend)

SocialFlow is an **autonomous social-content agent platform**, not a "post scheduler with a
chatbot bolted on." The canonical loop is:

```text
niche → research (Vega) → strategy/plan (Orion) → content draft→critique→refine (Lyra)
      → autopost (Atlas) → engage (Sirius) ┊ seed (Polaris) → report (Rigel) ──┐
                                  ▲                                              │
                                  └────────── feed-forward into next plan ◄──────┘
```

The frontier is the **named agent roster** (`docs/ORCHESTRATION.md`): a thin **Orion**
orchestrator routing typed handoffs (`AgentResult.handoff`) between single-concern agents over
durable, ledger-backed BullMQ jobs, recorded in `agent_runs` / `agent_steps`, with `Rigel`'s
`reports` fed back into `Orion`'s `plan jsonb`. Every idea below plugs into one of these real
seams:

- **Agent contract** — `lib/agents/types.ts` (`AgentDefinition`, `AgentContext`, `AgentResult`), `lib/agents/registry.ts` (one lookup, zero `switch`), `lib/agents/orchestrator.ts` (`dispatch` / `startRun`, idempotent on `(runId, agent)`).
- **Content engine** — `lib/agent/graph.ts` + `lib/agent/state.ts` (`ContentState`), nodes `digest → draftPerPlatform → critique → (refine↩|finalize)`, `MAX_REVISIONS=2`.
- **Platforms** — `lib/platforms/types.ts` `PlatformConnector` + `PlatformCapabilities` (8 platforms; capability-gated `supportsComments/Metrics/Seeding`).
- **Queues** — `lib/queue/{queues,jobs,job-ids,with-ledger}.ts` (lazy `getQueue`, `enqueueWithLedger`, deterministic job ids), `worker/processors/*`.
- **LLM** — provider-agnostic `lib/llm/factory.ts` (Gemini default; OpenAI/Anthropic mirrors).
- **Provenance & observability** — `generated_content.researchTopicId`, `posts.sourceContentId`, `agent_runs.runId` ↔ `langsmithRunId`, `lib/observability/langsmith.ts`.
- **Billing** — Clerk entitlements + usage metering (`db/schema/usage.ts`, 7 posts/day cap).

### Trend mapping at a glance

| # | Feature (codename) | Extends | Primary 2025–26 agent trend |
|---|---|---|---|
| 1 | Brand-Voice Memory (**Mnemosyne**) | Lyra prompts | Long-term agent memory + RAG grounding |
| 2 | Pre-flight Audience Simulation (**Echo**) | Lyra critique gate | Simulation / synthetic personas |
| 3 | Self-Optimizing Send-Times (**Chronos**) | Atlas + Rigel | Closed-loop self-improvement |
| 4 | Source→Campaign Repurposer (**Prism**) | Vega/Lyra | Multi-step pipelines, structured output |
| 5 | Comment Triage & Lead Escalation (**Sirius+**) | Sirius/reply | Agent triage + human-in-the-loop |
| 6 | Brand-Safety Guardrail (**Aegis**) | Pre-publish gate | Guardrails / safety, run interrupts |
| 7 | Autonomy Levels & Approval Gates (**Sentry**) | Orion | Human-in-the-loop checkpoints |
| 8 | Trend-Jacking Watcher (**Pulse**) | Scheduled Vega | Proactive / ambient event-driven agents |
| 9 | Variant Bandit Optimizer (**Gemini Pair**) | Atlas/Rigel | Online experimentation / RL bandits |
| 10 | Competitor Watch (**Spica**) | New Vega tool + Rigel | Monitoring agents over RAG |
| 11 | Strategy Calendar Planner (**Orion Strat**) | Orion plan | Agentic planning / task decomposition |
| 12 | On-Brand Visual Agent (**Pictor**) | Lyra + ImageKit | Multimodal agents + vision-judge |
| 13 | Discoverability/SEO Optimizer (**Index**) | Lyra + Rigel | Tool-use + feedback loop |
| 14 | Threaded Reply Agent w/ Memory (**Lyra Dialogue**) | Sirius/reply | Stateful conversational agents |
| 15 | Run Cost & Token Governor (**Quaestor**) | LLM factory | Agent FinOps / cost governance |
| 16 | Content-Eval "CI" Judge (**Vetus**) | Lyra graph | LLM-as-judge / eval-driven gating |
| 17 | Self-Healing Publisher (**Medic**) | publish processor | Self-healing / reflexion agents |
| 18 | Insights Narrator + Proposed Runs (**Rigel Brief**) | Rigel → Orion | Agentic reporting → recommended action |
| 19 | Cross-Platform Consistency Auditor (**Concord**) | New audit agent | Auditing agents |
| 20 | Compliance & Disclosure Agent (**Lex**) | Pre-publish gate | Policy/compliance guardrails |

---

## 1 — Brand-Voice Memory (**Mnemosyne**)

A persistent, learned brand-voice profile every agent reads, so output stops sounding like default-Gemini.

- **User problem:** Generated content reads generic and "AI-ish"; users re-edit every draft to sound like *their* brand, defeating the point of automation.
- **Agent behavior:** A memory agent ingests the user's top-performing published posts, their manual edits (draft vs. published diffs), and an onboarding interview, then distills a versioned **Voice Card** — tone, lexicon/banned words, emoji & punctuation policy, sentence rhythm, CTA style, sample exemplars. Lyra injects the active Voice Card into every prompt; the card auto-revises when Rigel shows a voice shift outperforming.
- **Workflow UI:** A "Brand Voice" settings tab showing the editable Voice Card, a diff timeline of versions, "regenerate from my best posts" button, and a side-by-side "with vs. without voice" preview in the composer.
- **Data needed:** `generated_content` history, published vs. edited body diffs, engagement per post (from Rigel), onboarding answers; a new `brand_voice` table (versioned jsonb).
- **Integrations:** LLM factory (distillation + embeddings), Neon/Drizzle, optional pgvector for exemplar retrieval.
- **AI-agent trends used:** Long-term agent memory + RAG grounding; learned-from-feedback personalization rather than static system prompts.
- **Implementation shape:** New `lib/agents/mnemosyne/` (or `lib/brand-voice/`) producing a `VoiceCard`; a retrieval helper that pulls exemplars; prompt assembly hook in `draft-per-platform`. Runs as a scheduled/triggered agent step that updates the active card.
- **Files likely touched:** `db/schema/brand-voice.ts` (+ migration), `lib/repos/brand-voice.ts`, `lib/agent/prompts.ts`, `lib/agent/nodes/draft-per-platform.ts`, `lib/agent/nodes/critique.ts`, `app/(dashboard)/settings/page.tsx`, `components/composer/generate-panel.tsx`.
- **MVP scope:** One Voice Card per user, hand-edited + auto-seeded from 10 best posts; injected into Lyra prompts; visible in settings.
- **Stretch scope:** Auto-revision driven by Rigel, per-platform voice variants, pgvector exemplar retrieval, multi-brand/agency support keyed by `clerkOrgId`.
- **Monetization value:** High — the core "sounds like me" differentiator; gate richer voice (multi-brand, auto-tuning) to Pro/Premium.
- **Risk:** Voice drift or learning from low-quality edits; over-fitting to a few posts. Mitigate with human-approved card versions and a confidence threshold before auto-apply.
- **Validation test:** Blind A/B — 20 drafts with vs. without the Voice Card, rated by the user and by an LLM judge for on-brand fit; success = ≥70% prefer voice-on and lower manual edit distance on publish.

## 2 — Pre-flight Audience Simulation (**Echo**)

Simulate how the target audience will react *before* a post goes live.

- **User problem:** Users post into the void and only learn a post flopped after it's public; autonomous runs amplify that risk at scale.
- **Agent behavior:** Before Atlas schedules, Echo spins up N synthetic persona critics (derived from the niche + audience profile), each "reacts" to the draft (scroll-past / like / comment / share + a one-line why), aggregates a predicted-engagement score and a "weakest element" note, and either passes the draft or hands it back to Lyra's `refine` with targeted feedback.
- **Workflow UI:** A "Predicted reception" panel on each draft — score gauge, persona reaction chips, top objection, and "auto-improve & re-simulate" button; in autonomous runs it appears in the run timeline.
- **Data needed:** Niche/audience descriptor, draft body+media, historical post→engagement to calibrate the simulator; a `simulations` record per draft.
- **Integrations:** LLM factory (persona ensemble), LangSmith (trace each persona), optional real engagement to score the simulator's accuracy.
- **AI-agent trends used:** Multi-agent simulation / synthetic personas ("digital twin" audience); LLM-as-judge ensembles.
- **Implementation shape:** A new node between `critique` and `finalize` (or a pre-Atlas gate agent `lib/agents/echo/`) that fans out persona calls in parallel and reduces to a verdict; feeds `needsRevision` back into the existing bounded refine loop.
- **Files likely touched:** `lib/agents/echo/index.ts`, `lib/agent/graph.ts`, `lib/agent/nodes/critique.ts`, `db/schema/generated-content.ts` (add `predictedScore`), `components/composer/generate-panel.tsx`, `app/(dashboard)/posts/[id]/page.tsx`.
- **MVP scope:** 3 fixed personas, single aggregate score + one improvement note shown in composer; no learning.
- **Stretch scope:** Personas generated from the user's real follower/comment data, calibration of predicted vs. actual engagement reported by Rigel, "simulate the whole week's calendar" batch mode.
- **Monetization value:** Strong premium hook (usage-metered "simulations/month"); reduces wasted posts → tangible ROI story.
- **Risk:** Simulated reactions can be confidently wrong and add latency/cost. Mitigate by labeling as estimate, calibrating against real outcomes, and capping persona count.
- **Validation test:** Correlate Echo's predicted score with actual engagement on 100 published posts; success = positive rank correlation (e.g., Spearman ≥ 0.4) and flagged "likely flops" underperform the median.

## 3 — Self-Optimizing Send-Times (**Chronos**)

Atlas schedules into *learned* best-time windows per platform/account instead of a naive delay.

- **User problem:** Users guess when to post; generic "best time" advice ignores their actual audience, so reach is left on the table.
- **Agent behavior:** Chronos reads each account's historical engagement-by-hour/weekday (via Rigel queries), computes optimal slots with recency weighting, and when a run reaches Atlas with "auto-time" enabled, Atlas places each `post_target` into the next open optimal window (respecting the 7/day cap and spacing) rather than `scheduledAt = now + delay`.
- **Workflow UI:** A heatmap of best times per platform on the calendar, an "Optimize times" toggle in the scheduler, and per-post "scheduled for peak window" badges with the rationale.
- **Data needed:** `post_targets.publishedAt` + engagement metrics, account timezone, existing schedule density; an `engagement_by_slot` materialized aggregate.
- **Integrations:** Rigel queries, BullMQ delay computation, account metadata (timezone).
- **AI-agent trends used:** Closed-loop self-improvement / feed-forward (the same Rigel→Orion loop already designed), data-driven autonomy.
- **Implementation shape:** A pure scheduling-policy module consumed by Atlas; aggregation lives in `rigel/queries.ts`; Atlas chooses `runAt` from the policy when the plan requests it.
- **Files likely touched:** `lib/agents/atlas/index.ts`, `lib/agents/rigel/queries.ts`, `lib/queue/jobs.ts` (delay calc), `db/schema/post-targets.ts` (metrics already planned), `app/(dashboard)/calendar/page.tsx`, `components/calendar/*`.
- **MVP scope:** Aggregate last-30-day engagement into 3 best windows/platform; Atlas snaps auto-time posts into them.
- **Stretch scope:** Per-content-type timing, cold-start defaults by niche benchmark, continuous bandit on send-time, "spread my 7 posts optimally across the day" planner.
- **Monetization value:** Medium-high — measurable reach lift; bundle with analytics tier.
- **Risk:** Sparse data for new accounts (cold start); over-clustering posts at one peak. Mitigate with niche-level priors and spacing constraints.
- **Validation test:** Holdout experiment — half of posts auto-timed, half user-timed over 4 weeks; success = auto-timed cohort shows higher median engagement at p<0.1.

## 4 — Source→Campaign Repurposer (**Prism**)

Turn one long-form source into a full multi-platform campaign in one run.

- **User problem:** Users already have assets (a blog post, a YouTube video, a PDF, a webinar transcript) but manually rewriting them for 8 platforms is the actual bottleneck.
- **Agent behavior:** Prism ingests a source (URL/upload/transcript), extracts key points and quotable moments, then drives Lyra to produce a coordinated campaign — X thread, LinkedIn post, IG carousel captions, a short-video script, Pinterest pins — each format-aware, all provenance-linked to the source.
- **Workflow UI:** "Repurpose" entry on Create: drop a link/file → see the extracted outline → a campaign board of per-platform drafts you can accept individually or "schedule all."
- **Data needed:** Source content (fetched/parsed), `generated_content` rows tagged with a shared `campaignId` and `sourceUrl`, format templates per platform.
- **Integrations:** Web fetch / transcript (reuse `lib/agent/tools/web-search.ts` pattern; add a fetch+extract tool), ImageKit for carousel images, LLM factory.
- **AI-agent trends used:** Multi-step agent pipelines with structured outputs; one input → many typed artifacts.
- **Implementation shape:** A new ingestion tool feeding a Vega-like pre-step that produces a `digest`, then a Lyra run with a `campaign` flag that drafts all selected platforms in one `ContentState`.
- **Files likely touched:** `lib/agent/tools/source-ingest.ts`, `lib/agent/research.ts`, `lib/agent/nodes/draft-per-platform.ts`, `db/schema/generated-content.ts` (add `campaignId`,`sourceUrl`), `app/(dashboard)/create/page.tsx`, `app/api/agents/run/route.ts`, `components/composer/*`.
- **MVP scope:** Paste a URL → extract → generate 3 platform variants linked by campaign id.
- **Stretch scope:** Video/audio transcription, auto-generated carousel images via Pictor (#12), "evergreen" re-repurpose of old top content, batch import of an RSS feed.
- **Monetization value:** High — concrete time-savings pitch ("1 blog → 1 week of content"); meter by source ingests/month.
- **Risk:** Source parsing fragility (paywalls, video), plagiarism/duplicate-content penalties. Mitigate with extract-then-rewrite (never copy) and a similarity check.
- **Validation test:** Feed 10 real blog posts; success = each yields publishable, format-correct drafts for ≥3 platforms with correct provenance, and an originality check passes (low similarity to source).

## 5 — Comment Triage & Lead Escalation (**Sirius+**)

Upgrade auto-reply from keyword matching to intent-aware triage that surfaces leads and PR risks.

- **User problem:** Keyword rules miss nuance — they auto-reply to trolls, ignore buying-intent comments, and let complaints fester; high-value conversations get lost in volume.
- **Agent behavior:** Sirius classifies each ingested comment (lead / question / praise / complaint / spam / troll) with sentiment and urgency. Safe, clear cases get an on-brand auto-reply (existing path); hot leads and complaints are **escalated** to a human inbox with a pre-drafted suggested reply; spam/trolls are suppressed.
- **Workflow UI:** An "Engagement Inbox" with triage lanes (Leads, Needs you, Handled-by-AI, Suppressed), each card showing the comment, classification, suggested reply, and one-click send/edit/dismiss.
- **Data needed:** `comment_events` (add `category`, `sentiment`, `urgency`, `suggestedReply`), rule config, account scope.
- **Integrations:** Platform `fetchComments`/`postReply`, LLM factory (classifier + drafter), existing `lib/auto-reply/*`.
- **AI-agent trends used:** Agent triage + human-in-the-loop routing; confidence-gated autonomy.
- **Implementation shape:** Insert a classification step in `worker/processors/reply.ts` before matching; route by category — auto-handle, escalate (write to inbox), or suppress; reuse cooldown/cap/dedupe guards.
- **Files likely touched:** `worker/processors/reply.ts`, `worker/processors/comment-poll.ts`, `lib/auto-reply/match.ts`, `db/schema/comment-events.ts`, `lib/repos/replies.ts`, `app/(dashboard)/auto-reply/page.tsx` (+ new inbox), `components/*`.
- **MVP scope:** 5-way classifier + sentiment; escalate leads/complaints to a simple inbox with suggested reply; keyword rules still win when present.
- **Stretch scope:** CRM/Slack/email escalation, lead scoring with follow-up sequences, multilingual triage, learn thresholds from which suggestions the user edits.
- **Monetization value:** High — "turn comments into leads" is a clear revenue story; gate the inbox + escalations to Pro.
- **Risk:** Misclassification (auto-replying to a complaint as praise) is reputationally costly. Mitigate with conservative auto-handle thresholds and escalate-on-uncertainty.
- **Validation test:** Label 200 real comments; success = classifier ≥85% precision on "complaint" and "lead," and zero auto-replies sent to comments labeled troll/complaint in a shadow run.

## 6 — Brand-Safety Guardrail (**Aegis**)

A safety gate every outbound draft and auto-reply must pass before it can go live.

- **User problem:** Autonomous posting means a hallucinated claim, an offensive phrasing, leaked PII, or a platform-ToS violation could publish with no human in the loop.
- **Agent behavior:** Aegis screens each finalized draft/reply for policy categories (hate/harassment, medical/financial claims needing citation, profanity, competitor/legal landmines, PII), returns a pass / soft-warn / hard-block verdict with reasons, and can pause the whole run (sets the run to a `blocked` state) until resolved.
- **Workflow UI:** A safety badge on every draft (green/amber/red), a blocking modal listing violations with "edit," "override (logged)," or "send to human"; a run-level "paused for safety" banner.
- **Data needed:** Draft/reply text + media, configurable policy set per org, an audit log of verdicts and overrides.
- **Integrations:** LLM factory (policy classifier), optional moderation API, `agent_runs` status, LangSmith.
- **AI-agent trends used:** Guardrails / safety layers around autonomous agents; run interrupts and blocking gates.
- **Implementation shape:** A gate invoked in `finalize` (content) and in `reply.ts` (engagement); on hard-block it throws a typed `GuardrailBlock` the orchestrator catches to pause the run rather than fail it.
- **Files likely touched:** `lib/agents/aegis/` (or `lib/guardrails/`), `lib/agent/nodes/finalize.ts`, `worker/processors/reply.ts`, `lib/agents/orchestrator.ts`, `db/schema/enums.ts` (add `blocked` run status) + `agent-runs`, `app/(dashboard)/posts/[id]/page.tsx`.
- **MVP scope:** Rule + LLM classifier for a core policy set; hard-block + amber-warn surfaced in UI with override logging.
- **Stretch scope:** Org-custom policies, per-platform ToS packs, citation requirement for factual claims (ties to #20 Lex), red-team eval suite.
- **Monetization value:** Medium directly, high as an enterprise/agency trust enabler ("safe autopilot"); a Premium/Team gate.
- **Risk:** False blocks frustrate users; false passes are dangerous. Mitigate with tunable strictness, transparent reasons, and an always-on audit trail.
- **Validation test:** A red-team set of 100 known-bad drafts; success = ≥95% hard-blocked, <5% false-block rate on a clean control set, every override recorded.

## 7 — Autonomy Levels & Approval Gates (**Sentry**)

Let users dial how much the roster does on its own, with checkpoints where they want control.

- **User problem:** Full autonomy is scary at first; users want to ease in — review drafts before publish, or approve the plan — without losing the hands-off promise later.
- **Agent behavior:** Each run carries an autonomy level: **Manual-review** (Orion pauses before Atlas; user approves drafts), **Plan-approval** (Orion pauses after planning), or **Full-auto**. At a gate Orion writes a pending approval and stops handing off until the user approves/edits/rejects, then resumes from the exact step.
- **Workflow UI:** An "Approvals" queue with pending items (plan or drafts), approve/edit/reject actions, and a per-run autonomy selector; a global default in settings.
- **Data needed:** `agent_runs` autonomy level + paused state, pending-approval records, the partial run context to resume.
- **Integrations:** Orchestrator handoff mechanism, Clerk (who approved), notifications.
- **AI-agent trends used:** Human-in-the-loop checkpoints / interruptible agent graphs; graduated autonomy.
- **Implementation shape:** Extend `orchestrator.dispatch`/`deliverHandoff` to consult the run's gate config; if the next hop is gated, persist a pending approval and `await` external resume (a server action enqueues the held step). Resume reuses the existing idempotent `(runId, agent)` guard.
- **Files likely touched:** `lib/agents/orchestrator.ts`, `lib/agents/orchestrator.runtime.ts`, `db/schema/agent-runs.ts` (+ `autonomyLevel`, `pausedAt`), `lib/repos/agent-runs.ts`, `app/api/agents/run/route.ts` (+ approve route/action), new `app/(dashboard)/approvals/page.tsx`.
- **MVP scope:** Two levels (full-auto, approve-before-publish); a basic approvals queue; resume from gate.
- **Stretch scope:** Per-agent gates, scheduled "approve by" auto-decisions, mobile push approvals, delegated approver roles for agencies.
- **Monetization value:** Medium — onboarding/trust feature that drives adoption of higher tiers; team approval flows are a Team-plan gate.
- **Risk:** Stuck/abandoned runs piling up at gates; resume races. Mitigate with gate timeouts (auto-pause/expire) and the existing idempotency guard.
- **Validation test:** Start a run at approve-before-publish; confirm it pauses with drafts pending, nothing publishes, and approving resumes exactly to Atlas with no duplicate content (verified via `agent_steps`).

## 8 — Trend-Jacking Watcher (**Pulse**)

An always-on agent that catches time-sensitive niche trends and spins up a run within minutes.

- **User problem:** The best engagement comes from riding a trend in the first hours, but users aren't watching feeds 24/7 and miss the window.
- **Agent behavior:** Pulse continuously scans trends/news/hashtags for the user's niche, scores each opportunity for fit × freshness × volume, and when it clears a threshold, autonomously calls `Orion.startRun` with a pre-seeded plan ("react to <trend>") — optionally auto-publishing (full-auto) or routing to approvals (Sentry, #7).
- **Workflow UI:** A "Trends radar" feed of detected opportunities with fit scores and "draft now / dismiss / always-react" controls; a settings toggle for autonomy + posting cap.
- **Data needed:** Niche descriptors, trend sources, a dedupe store of seen trends, opportunity scores; reuse `research_topics` provenance.
- **Integrations:** Web search/trends tool, scheduled BullMQ repeatable job, orchestrator `startRun`.
- **AI-agent trends used:** Proactive / ambient event-driven agents (agents that act without a prompt); opportunity scoring.
- **Implementation shape:** A repeatable scheduled job (mirror `registerTokenRefresh`) running a Vega-variant scanner; matches above threshold call `startRun` with a `reactTo` plan; dedupe via deterministic keys.
- **Files likely touched:** `lib/agents/pulse/` (or scheduled Vega mode), `lib/agent/tools/web-search.ts` (+ trends), `lib/queue/queues.ts` (+ `trend-watch`), `lib/queue/jobs.ts` (+ `registerTrendWatch`), `worker/processors/trend-watch.ts`, `worker/index.ts`, `app/(dashboard)/research/page.tsx`.
- **MVP scope:** Hourly scan for a single niche, scored list surfaced in UI, one-click "draft this trend."
- **Stretch scope:** Fully autonomous react-and-post with caps, multi-source fusion (news + platform trending + competitor spikes), "trend half-life" timing so it posts before saturation.
- **Monetization value:** High — "never miss a trend" is a premium, metered capability (scans/reactions per month).
- **Risk:** Tone-deaf trend-jacking (reacting to tragedies), API rate/cost. Mitigate with Aegis (#6) screening and a sensitivity filter on trends.
- **Validation test:** Seed a known recent trend window; success = Pulse detects it, scores fit correctly, and produces a relevant draft within one scan cycle, with sensitive trends filtered out.

## 9 — Variant Bandit Optimizer (**Gemini Pair: Castor & Pollux**)

Systematically test content variants and let a bandit learn the winning patterns.

- **User problem:** Users never know which hook/format/CTA actually works; one-shot posting yields no learning.
- **Agent behavior:** Lyra emits multiple variants (hook A/B, format, CTA) for a slot; Atlas publishes them across time/accounts as arms of a multi-armed bandit; Rigel scores outcomes and updates arm weights; winning patterns feed back into Lyra's prompts and future variant generation.
- **Workflow UI:** An "Experiments" view — variant cards with live engagement, current winner, confidence, and "promote winner pattern to my voice" action; per-post "variant of experiment X" badges.
- **Data needed:** Variant groups (`experimentId`, `arm`), per-arm engagement, bandit state (weights/priors); `generated_content` + `post_targets` tagged.
- **Integrations:** Rigel metrics, Atlas scheduling, LLM factory, Mnemosyne (#1) for promoting winners.
- **AI-agent trends used:** Online experimentation / RL bandits closing the generate→measure→learn loop.
- **Implementation shape:** A variant-generation flag in Lyra; a bandit policy module deciding allocation; Atlas assigns arms; a Rigel job updates weights; winners written back to the Voice Card / prompt hints.
- **Files likely touched:** `lib/experiments/bandit.ts`, `lib/agents/lyra/index.ts`, `lib/agents/atlas/index.ts`, `lib/agents/rigel/queries.ts`, `db/schema/{generated-content,experiments}.ts`, `app/(dashboard)/dashboard/page.tsx` (+ experiments view).
- **MVP scope:** 2-variant A/B per slot, manual winner declaration based on Rigel numbers.
- **Stretch scope:** Full contextual bandit (context = niche/time/platform), auto-promotion of winning patterns into Mnemosyne, cross-account meta-learning.
- **Monetization value:** High — "data-driven content that compounds"; a flagship Premium/analytics feature, metered by experiments.
- **Risk:** Low traffic → slow/insignificant learning; multiple-comparison false winners. Mitigate with minimum-sample gates and niche-pooled priors.
- **Validation test:** Run 10 A/B experiments with known-different hooks; success = the bandit shifts allocation toward the higher-engagement arm and reaches a correct winner call within the sample budget.

## 10 — Competitor Watch (**Spica**)

Track competitor accounts and turn what's working for them into actionable plays.

- **User problem:** Users have no structured view of what competitors are doing well, so their strategy is guesswork.
- **Agent behavior:** Spica monitors a watchlist of competitor accounts, summarizes their themes, formats, cadence, and breakout posts, identifies content gaps the user could own, and surfaces concrete "play" suggestions into Rigel reports and Orion's next-cycle plan.
- **Workflow UI:** A "Competitors" page — add handles, see a digest per competitor (top posts, themes, cadence), a "gaps & opportunities" list with "draft this angle" buttons.
- **Data needed:** Competitor handles, periodically fetched public post data, derived theme/format tags; a `competitors` + `competitor_posts` store.
- **Integrations:** Platform public-read or compliant scraping behind a tool interface, LLM factory (summarize/cluster), Rigel.
- **AI-agent trends used:** Monitoring agents over RAG; synthesis of external signals into strategy.
- **Implementation shape:** A scheduled fetch tool + a summarization agent producing structured insight blocks; Rigel merges them; Orion can read them from the latest report (reuses the feed-forward path already in `startRun`).
- **Files likely touched:** `lib/agents/spica/`, `lib/agent/tools/competitor-fetch.ts`, `db/schema/competitors.ts`, `lib/repos/competitors.ts`, `lib/agents/rigel/queries.ts`, `db/schema/reports.ts` (extend `ReportData`), new `app/(dashboard)/competitors/page.tsx`.
- **MVP scope:** Manual watchlist, weekly digest of competitors' top public posts + 3 opportunity suggestions.
- **Stretch scope:** Auto-suggest competitors by niche, breakout-post alerts, "respond to a competitor's angle" auto-runs, share-of-voice tracking.
- **Monetization value:** High — competitive intelligence is a classic premium/agency upsell.
- **Risk:** Platform ToS / scraping legality and fragility; copying competitors too closely. Mitigate with compliant data sources, a per-platform capability gate, and originality enforcement.
- **Validation test:** Add 3 real competitor handles; success = accurate theme/cadence summaries and at least 3 distinct, on-niche opportunity suggestions that pass originality checks.

## 11 — Strategy Calendar Planner (**Orion Strategist mode**)

Turn high-level goals into a multi-week, balanced content calendar of autonomous runs.

- **User problem:** Users think in campaigns and goals ("launch in 3 weeks, build authority"), but the tool only does one-off posts; there's no strategy layer.
- **Agent behavior:** Given goals, cadence, and content-pillar mix (e.g., 60% educational / 30% promo / 10% personal), Orion plans a themed calendar — a sequence of dated runs with assigned topics/pillars/platforms balanced across the period — and schedules each run to fire on its date, adapting future slots from Rigel results.
- **Workflow UI:** A "Plan my month" wizard (goals → pillars → cadence) producing an editable calendar of *planned runs* (distinct from scheduled posts); drag to rebalance; "regenerate week."
- **Data needed:** Goal/pillar config, the run plan as structured `agent_runs.plan` entries (the schema already allows flexible jsonb `steps`), calendar slot assignments.
- **Integrations:** Orchestrator `startRun` (deferred), BullMQ delayed run-kickoff, Rigel feed-forward, calendar UI.
- **AI-agent trends used:** Agentic planning / hierarchical task decomposition (goal → plan → steps).
- **Implementation shape:** A planning step (Orion) that emits a list of dated `RunStep` plans; each is enqueued as a delayed agent-step that calls `startRun`; the existing `plan jsonb` + `deriveFirstStep` carry the topic/platforms.
- **Files likely touched:** `lib/agents/orchestrator.ts` (planning), `db/schema/agent-runs.ts` (plan already flexible; maybe `plannedFor`), `lib/queue/jobs.ts` (delayed kickoff), `app/(dashboard)/calendar/page.tsx`, new `components/calendar/PlanBoard.tsx`, `app/api/agents/run/route.ts`.
- **MVP scope:** Generate a 1-week plan from pillars+cadence, shown on the calendar; manual "approve & schedule the runs."
- **Stretch scope:** Multi-week campaigns with milestones, auto-rebalancing from Rigel, "campaign templates" (product launch, evergreen authority), pillar drift detection.
- **Monetization value:** High — the "set your strategy and walk away" promise; anchors the top tier.
- **Risk:** Over-planning that ignores reality / pillar monotony. Mitigate with editable plans, variety constraints, and Rigel-driven mid-course correction.
- **Validation test:** Generate a 2-week plan for a sample niche; success = it respects the pillar ratios and cadence within tolerance, all runs schedule correctly, and editing a slot re-balances the rest.

## 12 — On-Brand Visual Agent (**Pictor**)

Generate platform-sized, on-brand visuals for posts and pick the best with a vision judge.

- **User problem:** Text-only posts underperform and most users can't design; producing correctly-sized, on-brand images per platform is a manual chore.
- **Agent behavior:** For a draft, Pictor generates candidate images/thumbnails/carousel frames in each platform's required dimensions, applies brand styling via ImageKit transforms, and uses a vision LLM-as-judge to rank candidates for brand-fit and clarity, attaching the winner as a `media_asset` linked to the draft.
- **Workflow UI:** An "Add visuals" step in the composer — generated candidates in a grid with the judge's pick highlighted, regenerate-with-prompt, and per-platform crop previews.
- **Data needed:** Draft text, Brand Voice/visual tokens (palette, logo) from Mnemosyne (#1), platform sizing from `PlatformCapabilities`, `media_assets` with `sourceAssetId` provenance.
- **Integrations:** ImageKit (`lib/imagekit/transform.ts`), an image-gen model, vision model via LLM factory, capability-driven sizing.
- **AI-agent trends used:** Multimodal agents; vision LLM-as-judge for selection.
- **Implementation shape:** A new tool `imageGenerate` + the existing `imagekitTransform`; a node/step after `draft-per-platform` that produces and ranks candidates and writes the chosen asset; gated by each platform's media capabilities.
- **Files likely touched:** `lib/agent/tools/image-generate.ts`, `lib/imagekit/transform.ts`, `lib/agent/nodes/draft-per-platform.ts`, `lib/repos/media.ts`, `db/schema/media-assets.ts`, `components/composer/MediaUploader.tsx`, `components/composer/generate-panel.tsx`.
- **MVP scope:** One generated, brand-styled image per draft sized for the selected platform; manual accept.
- **Stretch scope:** Multi-frame carousels, video thumbnail generation, vision-judge auto-selection, A/B of visuals via the bandit (#9), reuse of brand assets library.
- **Monetization value:** High — image generation is an obvious metered premium add-on (images/month) with real per-use cost to gate.
- **Risk:** Generation cost/latency, off-brand or low-quality images, IP/likeness concerns. Mitigate with brand-token conditioning, the vision judge as a gate, and per-plan quotas.
- **Validation test:** Generate visuals for 20 drafts across platforms; success = each is correctly sized, the vision judge's pick beats a random candidate in a blind user rating, and brand palette adherence is measurable.

## 13 — Discoverability / SEO Optimizer (**Index**)

Attach optimal hashtags, keywords, and alt-text per platform — and learn which actually drove reach.

- **User problem:** Posts under-reach because tags/keywords/alt-text are an afterthought; users don't know which tags work on which platform.
- **Agent behavior:** Index researches and attaches per-platform hashtags/keywords (and accessibility alt-text for images), respecting platform norms and limits, then learns from Rigel which tags correlated with reach and biases future suggestions toward winners.
- **Workflow UI:** A "Discoverability" section per platform tab in the composer — suggested tags with rationale and a "reach score," editable chips, alt-text field; a trends panel of which tags are working.
- **Data needed:** Draft + niche, platform tag rules/limits, historical tag→reach mapping; `generated_content` already supports a `hashtags` content kind.
- **Integrations:** Web/trends tool, LLM factory, Rigel metrics, platform capabilities.
- **AI-agent trends used:** Tool-using agents + a measurable feedback loop (suggest → measure → refine).
- **Implementation shape:** A post-draft enrichment node producing a `hashtags`/`keywords` artifact; a Rigel aggregation of tag performance fed back as prompt context; alt-text generated for each media asset.
- **Files likely touched:** `lib/agent/nodes/draft-per-platform.ts` (or a new `enrich` node), `lib/agent/tools/web-search.ts`, `db/schema/generated-content.ts`, `lib/agents/rigel/queries.ts`, `components/composer/VariantEditor.tsx`, `lib/repos/media.ts` (alt-text).
- **MVP scope:** Per-platform tag suggestions within limits + auto alt-text; manual edit.
- **Stretch scope:** Tag performance learning loop, banned/shadow-tag detection, keyword-gap targeting from Competitor Watch (#10), localized tags.
- **Monetization value:** Medium — bundles into the analytics/optimization tier.
- **Risk:** Stale tag norms, over-tagging penalties, banned hashtags. Mitigate with platform-specific rules, limits enforcement, and a banned-tag list.
- **Validation test:** Generate tags for 50 posts; success = all within platform limits, none banned, and the learned-tag cohort shows higher reach than baseline over time.

## 14 — Threaded Reply Agent with Memory (**Lyra Dialogue**)

On-brand, multi-turn engagement in real comment threads — explicitly *not* a generic chatbot.

- **User problem:** One-shot keyword replies feel robotic and break down when a commenter responds again; brands lose the conversation that builds loyalty.
- **Agent behavior:** When a commenter replies to an auto-reply, Sirius continues the thread with memory of the full conversation and that commenter's history, staying in brand voice, answering follow-ups, and — critically — recognizing when to *stop*, escalate (to #5's inbox), or hand off to a human. It's bounded (max turns, cooldowns) and policy-gated (#6), operating only on real platform threads, never a free-form chat surface.
- **Workflow UI:** Thread view in the Engagement Inbox showing the full conversation, the agent's turns, a "take over" button, and per-rule "allow multi-turn" + max-turns settings.
- **Data needed:** Thread state on `comment_events` (parent linkage, turn count), commenter history, brand voice, conversation memory.
- **Integrations:** Platform `fetchComments`/`postReply` (thread-aware), LLM factory, Mnemosyne (#1), Aegis (#6).
- **AI-agent trends used:** Stateful conversational agents with memory and stop/escalation policy (goal-bounded, not open-ended chat).
- **Implementation shape:** Extend comment ingestion to link replies into threads; a reply node that loads thread context, generates the next branded turn, enforces max-turns/cooldown, and escalates on uncertainty.
- **Files likely touched:** `worker/processors/comment-poll.ts`, `worker/processors/reply.ts`, `lib/auto-reply/template.ts`, `db/schema/comment-events.ts` (thread fields), `lib/repos/replies.ts`, `app/(dashboard)/auto-reply/page.tsx`.
- **MVP scope:** Two-turn threads with conversation context + a hard max-turn cap and escalation on uncertainty.
- **Stretch scope:** Long-running relationship memory per commenter, FAQ/knowledge grounding for answers, sentiment-adaptive tone, multilingual threads.
- **Monetization value:** Medium-high — "real conversations on autopilot"; a Pro engagement feature, metered by AI replies.
- **Risk:** Runaway loops, off-brand or wrong answers in public, arguing with users. Mitigate with strict turn caps, Aegis gating, and escalate-don't-argue rules.
- **Validation test:** Simulate 50 multi-turn threads; success = the agent answers follow-ups coherently in-voice, never exceeds the turn cap, escalates uncertain/heated threads, and zero policy violations post publicly.

## 15 — Run Cost & Token Governor (**Quaestor**)

Per-run and per-org cost/token tracking with budgets and graceful degradation.

- **User problem:** Autonomous multi-agent runs can quietly rack up LLM/image cost; neither users nor the operator can see or cap spend per run.
- **Agent behavior:** Quaestor wraps the LLM factory to meter tokens/cost per agent step and per run, enforces budget caps (per run, per org, per billing period), downgrades to a cheaper model or trims scope as a cap approaches, and stops a run that would exceed its budget — recording everything onto `agent_steps`.
- **Workflow UI:** A "cost" column in the run timeline, a per-run spend bar, org budget settings, and a "this run cost $X / Y tokens" summary; upgrade prompt when capped.
- **Data needed:** Token/cost per LLM call, model pricing table, budgets per plan/org; `agent_steps` cost fields, usage metering.
- **Integrations:** `lib/llm/factory.ts` (instrument all providers), LangSmith (token data), Clerk entitlements/usage.
- **AI-agent trends used:** Agent FinOps — cost governance and budget-aware autonomy for multi-agent systems.
- **Implementation shape:** A thin metering wrapper returned by `getChatModel()` that records usage via callbacks; a budget policy consulted in the orchestrator before/within steps; downgrade by swapping the provider/model the factory returns.
- **Files likely touched:** `lib/llm/factory.ts`, `lib/llm/providers/*`, `lib/observability/langsmith.ts`, `lib/agents/orchestrator.ts`, `db/schema/agent-runs.ts` + `agent-steps` (cost fields), `lib/repos/usage.ts`, `app/(dashboard)/billing/page.tsx`.
- **MVP scope:** Record tokens/est-cost per step + per run, show in the run view; a hard per-run cap that stops overruns.
- **Stretch scope:** Auto model-downgrade near cap, org/period budgets with alerts, cost attribution by agent/feature, margin dashboard for the operator.
- **Monetization value:** High (operator-side) — protects gross margin and powers usage-based pricing tiers and overage billing.
- **Risk:** Inaccurate cost estimates across providers; over-aggressive caps killing good runs. Mitigate with a maintained pricing table and soft-warn before hard-stop.
- **Validation test:** Run a known multi-agent pipeline; success = recorded token totals match provider/LangSmith figures within a small margin, and a low budget cap cleanly halts the run with a clear reason.

## 16 — Content-Eval "CI" Judge (**Vetus**)

A CodeRabbit-style quality gate for content — every draft scored on a rubric before it can ship.

- **User problem:** At autonomous scale, quality drifts silently; there's no objective bar a draft must clear before publishing.
- **Agent behavior:** Vetus is an LLM-as-judge that scores each draft on a rubric (hook strength, clarity, on-brand, CTA presence, platform-fit, originality), blocks or routes low scorers back into Lyra's bounded `refine` loop with specific fixes, and records score history so quality is trackable over time.
- **Workflow UI:** A "Quality score" card per draft with rubric breakdown and inline suggestions; a dashboard trend of average score by platform/time; a configurable minimum-to-publish threshold.
- **Data needed:** Draft + brand voice + platform capabilities, rubric config, `generated_content.qualityScore` + per-criterion notes.
- **Integrations:** LLM factory (judge), LangSmith (trace evals), Lyra refine loop.
- **AI-agent trends used:** LLM-as-judge and eval-driven gating; treating content like code with a CI gate.
- **Implementation shape:** Replace/augment the existing `critique` node with a structured rubric judge returning a typed score; `needsRevision` triggers when below threshold (reusing `MAX_REVISIONS` to bound loops); persist scores in `finalize`.
- **Files likely touched:** `lib/agent/nodes/critique.ts`, `lib/agent/state.ts` (add score), `lib/agent/graph.ts`, `lib/agent/nodes/finalize.ts`, `db/schema/generated-content.ts`, `lib/agents/rigel/queries.ts`, `app/(dashboard)/posts/[id]/page.tsx`.
- **MVP scope:** 5-criterion rubric, numeric score + notes, block-below-threshold with one bounded refine pass.
- **Stretch scope:** Calibrate the judge against real engagement, per-niche rubrics, originality/plagiarism check, "explain the score" coaching for the user.
- **Monetization value:** Medium — quality assurance underpins the autopilot trust story; rubric customization is a Pro gate.
- **Risk:** Judge bias / reward-hacking the rubric; latency/cost per draft. Mitigate with calibrated rubrics, periodic human spot-checks, and caching.
- **Validation test:** Score 100 drafts including deliberately weak ones; success = the judge ranks human-rated quality correctly (rank correlation) and weak drafts are reliably blocked/refined above threshold after the loop.

## 17 — Self-Healing Publisher (**Medic**)

When a publish fails, diagnose the cause and auto-remediate instead of blindly retrying.

- **User problem:** Posts silently fail (expired token, rate limit, oversized/invalid media, body over limit) and either retry uselessly or land in a dead-letter no one checks.
- **Agent behavior:** On a publish failure Medic classifies the error (auth / rate-limit / media / length / transient), then takes a *specific* remedial action — refresh the token, re-encode/resize media, trim or re-draft the body to the platform limit, reschedule past a rate-limit window — and retries; only truly unrecoverable cases dead-letter with a clear, actionable reason.
- **Workflow UI:** Per-target status with a human-readable failure reason and the remediation taken ("token refreshed & republished"), plus a "needs you" lane for unrecoverable cases with a one-click fix.
- **Data needed:** Structured error classification, platform capability limits, token state, media metadata; `post_targets` failure-reason + remediation log.
- **Integrations:** `worker/processors/publish.ts`, platform connectors, `token-refresh`, ImageKit (re-encode), Lyra (re-draft to length).
- **AI-agent trends used:** Self-healing / reflexion agents that reason about failure and adapt rather than repeat.
- **Implementation shape:** A remediation policy invoked in the publish processor's catch path; maps error classes to actions (some deterministic, length-fix uses the LLM); bounded remediation attempts before dead-letter.
- **Files likely touched:** `worker/processors/publish.ts`, `lib/platforms/base.ts` + adapters, `worker/processors/token-refresh.ts`, `lib/imagekit/transform.ts`, `db/schema/post-targets.ts`, `app/(dashboard)/posts/[id]/page.tsx`, `lib/observability/langsmith.ts`.
- **MVP scope:** Classify + auto-fix the top 3 failure classes (token, length, transient) with bounded retries and readable reasons.
- **Stretch scope:** Media re-encode/resize remediation, rate-limit-window rescheduling, learned per-platform failure playbooks, proactive pre-publish validation to prevent failures.
- **Monetization value:** Medium (reliability), high as a trust/retention driver — "your posts actually go out."
- **Risk:** Remediation that posts altered content the user didn't intend (e.g., trimmed body). Mitigate by recording every change and surfacing it, with an option to require approval for content-altering fixes.
- **Validation test:** Inject each failure class (expired token, over-limit body, transient 5xx); success = each is correctly classified and remediated to a successful publish, and an unrecoverable case dead-letters with a clear reason — no silent drops.

## 18 — Insights Narrator + Proposed Runs (**Rigel Brief**)

Rigel doesn't just compute metrics — it writes a strategy memo and proposes one-click next runs.

- **User problem:** Dashboards show numbers but not *what to do next*; users don't translate analytics into action.
- **Agent behavior:** On its schedule, Rigel compiles performance, then writes a natural-language brief ("what worked, what didn't, why") and a set of concrete **proposed runs** (niches/angles/platforms to try next), each approvable in one click to call `Orion.startRun` — and it already feeds the structured report forward into the next plan.
- **Workflow UI:** A weekly "Brief" card — narrative summary + ranked proposed runs with rationale and "approve & schedule" / "dismiss"; history of past briefs.
- **Data needed:** `reports.data` (already structured: top topics, success rate, failed counts), engagement, run outcomes; proposed-run records.
- **Integrations:** Rigel queries, LLM factory (narration + proposal), orchestrator `startRun` (the feed-forward path already exists), email/notification for the digest.
- **AI-agent trends used:** Agentic reporting that converts analysis into recommended, executable action (closing the insight→action gap).
- **Implementation shape:** Extend Rigel's `run` to add a narration+proposals step over its existing aggregations; persist into `reports.data`; the dashboard renders proposals that POST to the run entry point.
- **Files likely touched:** `lib/agents/rigel/index.ts`, `lib/agents/rigel/queries.ts`, `db/schema/reports.ts` (extend `ReportData` with `narrative`,`proposedRuns`), `worker/processors/report.ts`, `app/(dashboard)/dashboard/page.tsx`, `app/api/agents/run/route.ts`.
- **MVP scope:** Weekly narrative + 3 proposed runs surfaced on the dashboard; one-click approve to start a run.
- **Stretch scope:** Email/Slack digest, "auto-approve top proposal" autonomy, goal-aware proposals tied to the calendar planner (#11), explainable attribution.
- **Monetization value:** High — recurring value that drives retention and justifies the analytics tier; the digest is a re-engagement hook.
- **Risk:** Generic or wrong recommendations erode trust. Mitigate by grounding every claim in specific metrics and showing the supporting numbers behind each proposal.
- **Validation test:** Generate a brief from seeded performance data; success = the narrative's claims match the underlying metrics, proposed runs are on-niche and executable, and "approve" starts a valid run.

## 19 — Cross-Platform Consistency Auditor (**Concord**)

Audit a brand's presence across all 8 connected platforms for voice/visual drift and gaps.

- **User problem:** Managing 8 platforms means bios, links, visual style, and posting cadence drift apart; the brand looks inconsistent and some channels go stale.
- **Agent behavior:** Concord scans connected accounts for profile/bio/link consistency, voice drift (vs. Mnemosyne #1), visual-style divergence, and posting-gap "stale channels," producing a prioritized fix list — and can auto-apply safe fixes (e.g., standardize a link) or queue content to revive a stale channel.
- **Workflow UI:** A "Brand health" page with a per-platform scorecard, a consistency score, a fix checklist with "apply" / "ignore," and stale-channel alerts with "schedule a revival post."
- **Data needed:** Profile/bio/link per account, recent posting recency, voice/visual signals; an `audit_findings` store.
- **Integrations:** Platform profile-read (extend connectors), Mnemosyne (#1) for voice baseline, Atlas to schedule revival posts.
- **AI-agent trends used:** Auditing agents that assess state against a standard and propose/apply corrections.
- **Implementation shape:** A scheduled audit agent producing structured findings; safe auto-fixes go through connector write methods; content gaps hand off to Orion to generate revival posts.
- **Files likely touched:** `lib/agents/concord/`, `lib/platforms/types.ts` (profile read/write capability), adapters, `db/schema/audit-findings.ts`, `lib/repos/accounts.ts`, new `app/(dashboard)/brand-health/page.tsx`, `app/(dashboard)/accounts/page.tsx`.
- **MVP scope:** Read-only audit of bio/link consistency + stale-channel detection with a fix checklist.
- **Stretch scope:** Auto-apply safe fixes, voice/visual drift scoring, brand-health trend over time, agency multi-brand rollups.
- **Monetization value:** Medium-high — "one brand, every platform, consistent" resonates with agencies/teams; a Team-plan feature.
- **Risk:** Writing to profiles is sensitive (could overwrite intentional differences). Mitigate by defaulting to suggest-only and requiring approval for any profile write.
- **Validation test:** Connect accounts with deliberately inconsistent bios/links and one stale channel; success = Concord flags each correctly and an approved fix applies without touching intentional per-platform differences.

## 20 — Compliance & Disclosure Agent (**Lex**)

Detect promotional/affiliate/regulated content and auto-insert required disclosures with an audit trail.

- **User problem:** Automated posting can violate FTC disclosure rules, affiliate terms, or regulated-industry requirements (health/finance) — a real legal/financial risk the user may not even notice.
- **Agent behavior:** Lex classifies each draft for promotional/affiliate/sponsored or regulated content, inserts the correct disclosure per platform and jurisdiction (#ad, affiliate disclosure, financial/health disclaimers), verifies factual/medical claims carry citations (with Aegis #6), and logs an immutable compliance record for every published post.
- **Workflow UI:** A compliance badge on drafts ("disclosure required → added"), an editable disclosure preview, per-org compliance settings (industry, jurisdiction), and an exportable audit log.
- **Data needed:** Draft text + links (affiliate detection), org compliance profile, disclosure templates per platform/jurisdiction; a `compliance_log` table.
- **Integrations:** LLM factory (classifier), `draft-per-platform` (insertion), Aegis (#6) for claims, audit storage.
- **AI-agent trends used:** Policy/compliance guardrail agents; verifiable, auditable autonomous actions.
- **Implementation shape:** A compliance node before `finalize` that tags the draft, appends the right disclosure within platform length limits, and writes a compliance record; configurable rule packs per org.
- **Files likely touched:** `lib/agents/lex/` (or `lib/compliance/`), `lib/agent/nodes/finalize.ts`, `lib/agent/nodes/draft-per-platform.ts`, `db/schema/compliance-log.ts`, `lib/repos/*`, `app/(dashboard)/settings/page.tsx`, `app/(dashboard)/posts/[id]/page.tsx`.
- **MVP scope:** Detect affiliate links + obvious promo → auto-append #ad/affiliate disclosure within limits; log it.
- **Stretch scope:** Jurisdiction-aware rule packs, regulated-industry templates (health/finance), claim-citation enforcement, compliance export for legal review.
- **Monetization value:** High for regulated niches and agencies — "compliant autopilot" is a defensible enterprise/Team upsell.
- **Risk:** Wrong or missing disclosures create legal exposure; over-disclosure clutters posts. Mitigate with conservative defaults, jurisdiction config, human override, and a complete audit trail.
- **Validation test:** Feed 50 drafts (affiliate, sponsored, health-claim, benign); success = each gets the correct disclosure or none, within platform length limits, and every published item has a complete compliance log entry.

---

## How to use this list

- **Highest-leverage near-term (build on the merged roster):** #1 Brand-Voice Memory, #16 Content-Eval Judge, #3 Self-Optimizing Send-Times, #18 Insights Narrator — each is a thin, high-value extension of Lyra/Atlas/Rigel with clear monetization.
- **Trust-unlock cluster (enables true autonomy):** #6 Aegis, #7 Sentry, #15 Quaestor, #20 Lex — ship these to make "walk away" autonomy safe and sellable to teams/agencies.
- **Growth/flywheel cluster:** #8 Pulse, #9 Bandit, #10 Spica, #11 Strategy Planner — the compounding, data-driven differentiation.
- **All 20 are agentic by construction** — they extend the orchestrated roster, the connector capability model, or the generate→measure→learn loop — and deliberately avoid a generic "chat with your data" surface.
