# SocialFlow — AI-Agent Feature Roadmap

**Date:** 2026-06-24 · **Status:** Strategy / read-only synthesis · **Owner:** Product

> **How this was produced.** Four parallel research subagents each wrote one evidence-cited file, then this document reconciles them. Inputs:
> - [`docs/research/01-repo-intelligence.md`](research/01-repo-intelligence.md) — capability map (T1)
> - [`docs/research/02-trends.md`](research/02-trends.md) — 2026 trend delta (T2)
> - [`docs/research/03-feature-ideation.md`](research/03-feature-ideation.md) — 14 feature ideas (T3)
> - [`docs/research/04-feasibility.md`](research/04-feasibility.md) — feasibility buckets + risk (T4)
>
> Synthesis applied the `product-management:synthesize-research` (theme ranking by frequency × impact, honest triangulation) and `product-management:write-spec` (mini-PRD structure) skills. Every product claim traces to a repo `path:LINE` (from T1/T3/T4) or a URL+date (from T2). No code was modified.

---

## 1. Strategic diagnosis (where the product is today)

**SocialFlow is a mature, multi-tenant AI social-content automation SaaS that is one feature away from being a closed-loop system — and that one feature is missing.**

### What exists (the moat is real)
The repo's on-disk name (`langchain-project`) is misleading. This is a commercial SaaS — pricing, legal, billing, and a 12-surface dashboard all exist ([01:18-21](research/01-repo-intelligence.md)). It runs **two** agent layers that the casual reader conflates:

- A **LangGraph content graph** — `analyze → draftPerPlatform → critique → (refine ↩ ≤2 | finalize)` (`lib/agent/graph.ts`), pluggable LLM (default **Gemini**, `lib/llm/factory.ts:14-24`).
- The real spine: a **durable multi-agent "constellation"** orchestrated by **Orion** — **Vega** (research) → **Lyra** (generate) → **Castor** (brand-safety gate; *pauses the run for human approval*) → **Atlas** (schedule/publish + AI-disclosure) → **Sirius** (engagement); plus **Rigel** (reports, feeds learned-memory back) and **Polaris** (seeding) (`lib/agents/orchestrator.ts`, roster `lib/agents/types.ts:16-25`).

The engineering quality is high and unusually governance-forward for this category:
- **Idempotent, ledger-backed handoffs** keyed on `(runId, agent)` over BullMQ + Postgres; a re-dispatch re-delivers the stored handoff instead of re-running a non-idempotent agent (`orchestrator.ts:159-188`).
- **Tamper-evident run audit** — each step `hash = sha256(prevHash + canonical(step))`, surfaced in the **Lumen** `/runs/[runId]` inspector with "Integrity verified / failed at step N" (`lib/audit/run-audit.ts:36-105`).
- **Human-in-the-loop is real, not aspirational** — Castor pause flips the run to `awaiting_approval`; **Praetor** role-gates the decision (`approver` only) before `resumeRun` enqueues Atlas with *only accepted ids* (`app/(dashboard)/review/actions.ts:32-44,65-69`).
- **Compliance already shipped** — **Aletheia** AI-disclosure engine + append-only `disclosure_ledger` citing EU AI Act Art. 50 / CA SB 942 (`lib/compliance/disclosure.ts`), and **Praxis** deterministic ToS/policy linter wired into the gate (`lib/compliance/policy-linter.ts`, `registry.ts:84`).
- **8 real platform connectors** (not stubs) with encrypted-at-rest OAuth tokens (AES-256-GCM, HKDF sub-keys) (`lib/platforms/registry.ts:14-23`, `lib/utils/crypto.ts`).
- **Least-privilege capability matrix enforced by a test** (`lib/agents/capabilities.ts:12-40`).

### The core problem: the loop is open at the measurement step
Every research stream converged on the same structural finding (4/4 sources):

> **SocialFlow can publish, but it is blind to what happens next.** `post_targets.metrics` is a `jsonb` column with `metricsUpdatedAt`, connectors *declare* `fetchMetrics(account, externalPostId)`, and Rigel *reads* metrics to rank top topics — **but no worker ever calls `fetchMetrics`, so `metrics` is always empty** (`lib/platforms/base.ts:52`, `db/schema/post-targets.ts:48-49`, `lib/agents/rigel/aggregate.ts:13`; T3 §C1, T4 §Q1).

Because measurement is dead, **every learning loop is starved**: best-time-to-post, winner-recycling, hook A/B, "insights that explain why," send-time optimization — all of them read from a column that is never written. The product's analytics, feed-forward memory (`brand_profiles.learnedMemory`), and Rigel reports are running on zeros.

Two more best-architected-but-unused seams compound it:
- The **`supervisor` dynamic-routing hook is a designed no-op** — defined in `OrchestratorDeps` but not wired in the runtime root, so runs are strictly linear with no recovery (`orchestrator.ts:66-71`, `orchestrator.runtime.ts:21-30`).
- The **MCP client is built but never called by any agent** — tool-use is plumbing-only (`lib/mcp/client.ts`, no roster import; T1 Missing §3).

### The dominant operational risk
**Migrations `0000`–`0024` are generated but never applied** against a live Neon DB, and the BullMQ worker that runs *all* async work has not run live (T4 standing caveat; `db/migrations/meta/_journal.json`). The architecture is code-verified, not behavior-verified. Plus a **two-lane execution constraint** governs everything: `/api/generate` runs the graph synchronously under `maxDuration = 60` (`app/api/generate/route.ts:16-17`), so anything long/multi-LLM **must** go on the always-on worker, not the route.

### Diagnosis in one line
SocialFlow has built the hard, governed *generation-and-publish* half of an autonomous social agent and the *audit* rails around it; it has **not** built the *measurement-and-learning* half. The highest-leverage roadmap is not new capability surface — it is **closing the existing loop** (measure → learn → act), then lighting up the two dormant seams (supervisor, tools), with cost-metering and an eval gate as the safety rails that make further autonomy responsible.

---

## 2. 2026 AI-agent trend radar

From [`02-trends.md`](research/02-trends.md). Maturity as of 2026-06-24. The single biggest shift: **the unit of agent work moved from "one model in a loop" to "a lead agent fanning out hundreds of isolated parallel subagents."**

| Trend | Maturity | Primary source (URL · date) | What it means for SocialFlow |
|---|---|---|---|
| **Frontier models are agent-shaped** — parallel subagents, effort dials, context compaction built in (Opus 4.6 "agent teams"; Opus 4.8 "Dynamic Workflows: hundreds of parallel subagents") | Production (models GA) | [Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) · 2026-02-05 · [Opus 4.8](https://www.anthropic.com/news/claude-opus-4-8) · 2026-05-28 · [OpenAI changelog](https://developers.openai.com/api/docs/changelog) | **Effort dials** are a near-free cost lever (run Lyra critique at low effort, escalate brand-risky drafts to high). Validates parallel per-platform drafting the linear `orchestrator.ts` doesn't yet do. |
| **LangGraph 1.0 GA + `deepagents` harness** — middleware, isolated subagents, offload-to-disk, DeltaChannel checkpointing | LangGraph GA; deepagents emerging | [LangChain 1.0](https://www.langchain.com/blog/langchain-langgraph-1dot0) · 2025-10-22 · [deepagents v0.6.11](https://github.com/langchain-ai/deepagents) · 2026-06-18 | SocialFlow is already on LangGraph 1.x. **Middleware** is the idiomatic home for the guardrails/capability/HITL hooks it hand-rolls in `lib/agent/guardrails/` and `lib/agents/castor/`. |
| **Agent memory consolidation shipped** — Anthropic **Dreaming** (scheduled cross-session "postmortem") + **Outcomes** grader-agent evals | Dreaming = research preview; Outcomes = public beta | [Managed Agents writeup](https://www.developersdigest.tech/blog/claude-managed-agents-dreaming-outcomes-multi-agent) · announced 2026-05-06 | **Closes SocialFlow's two half-built loops**: a scheduled job that *curates* `brand_profiles.learnedMemory` from Rigel analytics (Dreaming), and a grader agent scoring drafts vs a per-tenant rubric (Outcomes ≈ the brand-safety eval). |
| **Computer/browser use crossed the usefulness line** — GPT-5.4 native computer tool; Opus 4.8 84% Online-Mind2Web. But IG bans gray-market browser bots | Emerging; safe for read/QA only | [OpenAI changelog](https://developers.openai.com/api/docs/changelog) · 2026-03-05 · [Opus 4.8](https://www.anthropic.com/news/claude-opus-4-8) · [IG enforcement](https://autoadify.com/blog/ai-agents-social-media-2026) | **Keep publishing API-first** — now the *safe* path, not just reliable, and a selling point ("approved APIs, not bannable bots"). Browser-use is only for UI-gated *analytics/QA* reads, sandboxed, behind Castor. |
| **Agent identity got a standard** — Okta Cross-App-Access (XAA) + Microsoft Entra Agent ID | Emerging (rolling out through Aug 2026) | [Okta XAA](https://www.okta.com/identity-101/cross-app-access-securing-ai-agent-and-app-to-app-connections/) · [Entra Agent ID](https://learn.microsoft.com/en-us/entra/agent-id/what-is-agent-id-platform) · 2026-06-16 | The enterprise unlock for SocialFlow's A2A endpoint: validate token issuers and let a tenant's Okta/Entra govern which of *their* agents may call SocialFlow. |
| **Evals-as-CI** — LangSmith evals as a per-PR GitHub Actions merge gate w/ thresholds; trace-replay for model bumps | Production (documented pattern) | [LangSmith eval](https://www.langchain.com/langsmith/evaluation) · [CI recipe](https://markaicode.com/langsmith-cicd-automated-regression-testing/) · 2026-03-09 | SocialFlow has `evals/brand-safety/run.ts` + LangSmith but **no merge gate**. Wiring it makes "we never regress brand safety" a CI guarantee. |
| **MCP "2.0" direction** — stateless core, Tasks-as-extension, elicitation replaces SSE; OpenAI Secure MCP Tunnel for private servers | Provisional (RC dated after cutoff) | [MCP RC](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) · [OpenAI Tunnel](https://developers.openai.com/api/docs/changelog) · 2026-05-19 | Stateless MCP scales cleanly behind the BullMQ worker fleet. **Hold on pinning to the RC** (finalizes 2026-07-28); current spec is 2025-11-25. |
| **Agentic social tooling converged on "human decides, agent executes"** — Sprout Trellis, autonomous comment/DM "Engagement Autopilot," all human-gated, all official-API | Production (shipping competitors) | [Sprout Social](https://sproutsocial.com/insights/agentic-ai-for-social-media/) · 2026-02-19 | **Competitive parity gap:** the market moved to *agentic inbound engagement* (comment/DM triage + on-brand reply, surfaced for approval). SocialFlow's gate is table-stakes, not over-engineering — keep it default-on. |
| **Anti-hype guardrail holds** — >40% of agentic-AI projects canceled by 2027; OpenAI Agent **Builder** wound down (gone Nov 30 2026), low-level runtimes are the safe bet | Strategy signal | [Gartner](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) · 2025-06-25 | SocialFlow is on LangGraph/custom — right side of the deprecation. Roadmap discipline: ship **narrow, governed, deadline-driven** value, not autonomy theater. |

---

## 3. Reconciled themes (frequency × impact)

Themes extracted across the four sources and ranked by **frequency** (how many of the 4 streams independently raised it) × **impact**. A theme raised by all four with high impact is a much stronger signal than any single idea.

| # | Theme | Freq | Impact | Triangulated evidence |
|---|---|---|---|---|
| **T-1** | **Close the analytics loop (metrics ingestion)** | 4/4 | **Critical** | T1 (fetchMetrics unimplemented, metrics never written), T3 (C1 Pulse ★ "highest leverage gap"), T4 (Q1 top quick win, Eng 5/Val 5), T2 (observability/Outcomes). |
| **T-2** | **Govern autonomy before extending it** (cost metering + eval-as-CI gate) | 4/4 | **High** | T1 (no cost tracking; eval not in CI), T3 (G1 Meter & Cap), T4 (Q2 cost telemetry + Q5 eval gate, both quick wins), T2 (cost packaging, Outcomes grader, evals-as-CI). |
| **T-3** | **Make memory actually learn** (Dreaming-style curation; insights that explain *why*) | 4/4 | **High** | T1 (`learnedMemory` is a blob), T3 (C2 Rigel Narratives, A3 Hook Lab), T4 (M2/M4), T2 (Dreaming/Outcomes — the headline delta). |
| **T-4** | **Light up the dormant supervisor** (self-healing + pre-flight routing) | 4/4 | **High** | T1 (supervisor defined-not-wired, extension point #3), T3 (F2 Run Doctor, B2 Sentinel), T4 (supervisor can override handoff; one-agent-per-run key blocker), T2 (supervisor/dynamic routing). |
| **T-5** | **Deepen engagement to competitive parity** (intent/sentiment triage, DM, inbox) | 4/4 | **High** | T1 (auto-reply is keyword→template only), T3 (E1 Sirius Triage, E2 Closer), T4 (Q4 triage enrichment + the **prompt-injection correction**), T2 (autonomous engagement = the new battleground). |
| **T-6** | **Compliance: from text-disclosure to provenance** | 4/4 | **High (contested)** | T1 (Aletheia built; no C2PA), T3 (D2 Provenance #2 pick, D1 Praxis Live), T4 (Q3 editable packs = quick win; D5 C2PA = "do not build yet"), T2 (disclosure cliff, EU AI Act Aug 2 2026). **See conflict C-1.** |
| **T-7** | **Turn the composer into an autopilot** (cadence planning, campaigns, recycling) | 3/4 | **High** | T3 (A1 Cadence Architect #3, A2 Recycler), T4 (M1 Campaigns = major bet), T2 (Command Marketing, parallel subagents). |
| **T-8** | **Activate tools (MCP) without over-building** | 4/4 | **Medium** | T1 (MCP never called), T3 (references), T4 (Q6 MCP node = quick win; D2 true ReAct = "do not build"), T2 (MCP 2.0, tool use). **See conflict C-4.** |
| **T-9** | **Enterprise interop & agent identity** | 4/4 | **Medium** | T1 (A2A single-tenant), T3 (F1 A2A Delegation), T4 (D4 A2A marketplace = "do not build yet" pre-PMF), T2 (Okta XAA / Entra Agent ID). |

### Conflicts & decisions needed

Where the streams disagree, the disagreement is the signal. Each is surfaced with a recommended resolution and reasoning — not silently resolved.

**C-1 — C2PA / cryptographic media provenance: "build it #2" (T3) vs "do not build yet" (T4).**
T3 ranks the Provenance Verifier as its #2 build-now feature, driven by the EU AI Act Art. 50 deadline (2026-08-02) and platform enforcement. T4 places C2PA in "do not build yet" (§D5): there is **no signing/watermark toolchain in the repo**, platform support for surviving manifests is immature/partly post-cutoff, and **text disclosure already satisfies the Art. 50 *text-content* requirement** — the heavy part was deliberately deferred to keep deps light.
→ **Resolution: SPLIT the feature — do the cheap 80% now, defer the expensive 20%.**
  - **Now (quick win, T-6):** make the disclosure/policy rule packs **editable per-org** and set each platform's **native AI-content flag** at publish (reuses `brand_profiles.disclosurePolicy` jsonb + the existing settings form + Atlas's `applyDisclosure`; no new toolchain — T4 §Q3). This covers the legal text-label requirement and the platform-flag requirement.
  - **Research-later / fast-follow:** full **C2PA Content Credentials + SynthID embedding** on AI media, gated on (a) a regulated/enterprise customer that contractually requires verifiable *image* credentials, and (b) a per-platform pilot confirming manifests survive re-download.
  - *Reasoning:* the binding legal obligation (text disclosure) is already met; cryptographic image provenance is net-new infra against immature platform support. Shipping the 20% now would be deadline-driven autonomy theater. Keep text-marking as the always-on baseline.

**C-2 — Engagement triage: big feature (T3 E1) vs narrow quick win (T4 Q4) — and a security hole underneath both.**
T3's Sirius Triage is a large feature (intent + sentiment + DM ingestion + an escalation inbox). T4's Q4 is a 3-nullable-column migration + one cheap LLM classification call, comment-only. Critically, T4 also flags a **prompt-injection surface both ignore**: AI auto-replies feed **raw, unbounded commenter text** into a prompt and post the result publicly (`worker/processors/reply.ts:120-137`, gated by `rule.useAi`) — the highest-value injection target in the codebase and, unlike web-search snippets, **not length-bounded**.
→ **Resolution: phase it, and fold the security fix into phase 1.**
  - **Phase 1 (P0, ships in the build-first wave):** the narrow Q4 enrichment (sentiment/intent/urgency columns + a grouped inbox read-out) **plus** harden `composeAiReply` — bound commenter-text length and quarantine it as data, never control. The injection fix is non-negotiable and ships *with* the first triage change, not later.
  - **Phase 2 (P1):** DM ingestion, lead escalation, abuse suppression with audit (T3 E1 stretch + E2 Closer).
  - *Reasoning:* the quick win delivers the competitive-parity value on rails that already exist, and refuses to expand the auto-reply blast radius while a known injection hole is open.

**C-3 — Self-healing supervisor is blocked by the orchestrator's idempotency key.**
T3 proposes Run Doctor (F2) and Sentinel (B2), both implementing the dormant supervisor. T2 pushes parallel-subagent fan-out. But T4 (§Architecture-fact 2) notes the idempotency key assumes **each agent runs at most once per run** (`orchestrator.ts:166-168`) — and a *bounded retry of a failed step re-invokes the same agent*, which would collide with its own stored step.
→ **Resolution: wire the supervisor for bounded recovery first, but ship the per-step idempotency key as its explicit prerequisite (P0 within the Run Doctor work).** Parallel fan-out (re-running/forking the same agent for N platform variants) is **research-later** — it's a bigger change that also needs the per-step key plus a fan-in/merge step.
  - *Reasoning:* recovery is the higher-confidence, in-architecture win and the canonical use of a seam the system was explicitly built for; doing it without the per-step key would double-act on retry.

**C-4 — Tool use: activate MCP (T4 Q6) vs build a true tool-calling ReAct agent (T4 D2 "do not build").**
T2 hypes tool-use/MCP; T1 notes MCP is plumbing-only; T4 says **activate MCP as a direct-call node** (quick win) but **do not** convert the deterministic node graph into a model-bound ReAct loop (unbounded latency/cost, undercuts the testable design).
→ **Resolution: adopt the direct-call MCP node (research-later-adjacent, low priority); reject the ReAct rewrite** until a concrete product need that direct-call nodes can't satisfy appears, *and* cost-metering (T-2) + the eval gate are in place to catch regressions. *Reasoning:* keep the deterministic, testable architecture; add tools additively.

**C-5 — Autopilot (T3 A1 Cadence Architect) vs runaway-cost risk (T4).**
T3's Cadence Architect is the strongest upgrade driver; T4 warns there is **no cost metering**, and agentic planning loops multiply spend.
→ **Resolution: gate autopilot behind cost telemetry (T-2 / Quaestor) landing first; ship planning with a hard per-tier slot cap + mandatory Castor approval (no auto-publish).** *Reasoning:* don't ship an unmetered spend amplifier.

---

## 4. Top 10 feature recommendations (ranked)

Scoring convention: **1–5, where 5 is always most favorable** (highest Impact, highest Confidence it works/is buildable, **lowest** Effort, **lowest** Risk, best Strategic Fit). Sorted by total, with dependencies and the strategic narrative (close the loop → govern → learn → engage → scale) breaking ties.

| Rank | Feature (codename) | Impact | Conf | Effort¹ | Risk² | Fit | Σ | Depends on |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| **1** | **Pulse** — metrics-ingestion agent (close the loop) | 5 | 5 | 4 | 4 | 5 | **23** | — |
| **2** | **Quaestor** — run cost & token telemetry | 4 | 4 | 4 | 5 | 5 | **22** | — |
| **3** | **Vigil** — brand-safety eval as a CI merge gate | 4 | 4 | 4 | 5 | 5 | **22** | — |
| **4** | **Rigel Narratives** — insights that explain *why* | 4 | 5 | 4 | 4 | 5 | **22** | Pulse (better, not required) |
| **5** | **Run Doctor** — self-healing supervisor (+ per-step key) | 4 | 4 | 3 | 4 | 5 | **20** | per-step idempotency key |
| **6** | **Sirius Triage v1** — comment intent/sentiment + injection fix | 4 | 4 | 3 | 3 | 5 | **19** | 1 migration |
| **7** | **Praxis Live v1** — editable policy/disclosure packs + native AI flag | 4 | 4 | 4 | 4 | 5 | **21** | — |
| **8** | **Chronos** — best-time-to-post optimizer | 4 | 3 | 3 | 4 | 4 | **18** | **Pulse** |
| **9** | **Mensa** — Cadence Architect (autopilot calendar) | 5 | 3 | 2 | 3 | 4 | **17** | Quaestor (cost cap) |
| **10** | **Evergreen Recycler** — winner repurposing | 4 | 3 | 3 | 3 | 4 | **17** | **Pulse** |

¹ Effort: 5 = days on existing infra/no migration; 2 = new agent/table/UI. ² Risk: 5 = no new attack surface; 3 = injection/brand/quota exposure.

*Ordering note:* Praxis Live (Σ21) is placed at #7 rather than #4 deliberately — it is a strong quick win, but T-1→T-4 (close-loop, govern, learn, self-heal) are the structural unlocks that everything else compounds on. #8–10 are the payoff features that **Pulse** makes possible; they are ranked below the enablers they depend on.

**Honorable mentions (just below the line, → §7):** Sentinel (pre-flight health, B2 — folds into Run Doctor), MCP tool node (Q6), Hook Lab (A3), Conversation Closer (E2), Campaigns/Meridian (M1).

---

## 5. Mini-PRDs

Full PRDs for the build-first five (#1–5); compact PRD cards for #6–10. All sections per `product-management:write-spec`.

---

### PRD 1 — Pulse (metrics-ingestion agent) ★ foundational

**Problem.** SocialFlow publishes but is blind to outcomes. `post_targets.metrics`/`metricsUpdatedAt` exist and Rigel reads them, but nothing calls the connectors' declared `fetchMetrics()` — so engagement is always zero and **every** learning loop (Rigel, Chronos, Recycler, Hook Lab) runs on empty data (`lib/platforms/base.ts:52`, `lib/agents/rigel/aggregate.ts:13`; T3 §C1, T4 §Q1).

**Why now.** It is the lowest-effort, highest-leverage change in the codebase (the columns, connector interface, and consumer all exist — only the writer is missing) and it is the hard dependency for 4 of the other 9 features.

**Goals.**
- ≥95% of published `post_targets` have non-null `metrics` within 48h of publish.
- Rigel's `topTopics` ranking changes when real metrics land (proves the loop is closed).
- Zero new tables / zero migration for the MVP.

**Non-goals.** Cross-platform metric *normalization* (impressions vs views vs plays) beyond storing raw per-platform values (P1); a metrics *dashboard redesign* (reuse existing surfaces); historical backfill of pre-launch posts.

**Agent architecture.** A new repeatable BullMQ job `metrics-poll` registered per active account by **Sirius** alongside `registerCommentPoll` (`lib/agents/sirius/index.ts`). The processor walks recently-published targets, calls `connector.fetchMetrics(account, externalPostId)`, writes `metrics` + `metricsUpdatedAt`. **Agentic, not a dumb cron:** a maturity-curve schedule — poll a post frequently in its first 48h, taper, stop once values stabilize. Mirrors the proven idempotency/watermark design of `worker/processors/comment-poll.ts`.

**UX flow.** Real engagement column on `/dashboard`; per-post metrics on `/posts/[id]` and `/calendar` (the `externalUrl` already renders). No new approval surface.

**Backend / data changes.** None to schema (writes existing columns). New `worker/processors/metrics-poll.ts`, `registerMetricsPoll()` in `lib/queue/jobs.ts`, a `metrics` `QueueName` in `lib/queue/queues.ts`, worker registration in `worker/index.ts`, and per-connector `fetchMetrics` implementations starting with Meta Graph insights (`lib/platforms/{facebook,instagram}.ts`).

**Integrations.** Platform read APIs (Meta Graph, LinkedIn, TikTok, X, YouTube). Reuse the Postgres `rate_limits` pattern for per-platform read buckets.

**Guardrails / approval.** Read-only against platforms (no publish capability — respects the `lib/agents/capabilities.ts` matrix). Failures are non-fatal and throttled; never burns publish retries.

**Observability / evals.** Emit poll success/failure + per-platform latency to the existing logger; surface "last metrics sync" on `/posts/[id]`. No LLM, so no eval needed.

**Tests.** Unit-test the maturity-curve scheduler and the idempotent write (mirror `comment-poll.test.ts`); integration test that a published target gets `metrics` populated against a mocked connector.

**Success metrics.**
- *Leading:* % published targets with non-null metrics @48h (target ≥95%); poll error rate (<5% per platform).
- *Lagging:* activation of dependent features (Chronos/Recycler become buildable); Rigel report engagement fields non-zero for >90% of active tenants within 30 days.

**Acceptance criteria.**
- [ ] Given a published `post_target` with an `externalPostId`, when the poll runs, then `metrics` and `metricsUpdatedAt` are written and visible on `/posts/[id]`.
- [ ] Given a platform read-API rate-limit error, when the poll runs, then the job backs off and does not mark the post failed.
- [ ] Given a post older than the maturity window, when the poll runs, then it is skipped (no wasted API calls).
- [ ] Given Sirius registers an account, then a `metrics-poll` scheduler exists exactly once (idempotent).

**Open questions.** (eng) Exact Meta Graph insights fields + rate tiers per plan? (data) Is `usage_metadata`-style metric availability consistent across connectors, or is per-connector mapping required (T4 self-check)?

---

### PRD 2 — Quaestor (run cost & token telemetry)

**Problem.** There is **no cost or token tracking anywhere** (no `cost`/`tokenUsage` columns; T4 §Q2). You cannot add spend caps, value-based pricing, or safe autopilot until you can first *measure* spend — and the upcoming agentic features (Mensa, Recycler) multiply LLM calls.

**Why now.** It is the measurement half of FinOps, it is cheap (rides existing `agent_steps.summary` jsonb), and it unblocks the spend-cap enforcement (§7) that makes autopilot safe (conflict C-5).

**Goals.** Per-run token+cost estimate visible in the Lumen run inspector for ≥95% of runs; cost numbers within tolerance of the model bill before any cap is exposed; zero migration for MVP.

**Non-goals.** Hard spend caps / budget enforcement (that's the major-bet follow-up, §7); outcome-based ("per on-brand post") billing (P2); prompt-caching rollout (P1, separable).

**Agent architecture.** A usage recorder at the one LLM chokepoint (`lib/llm/factory.ts`) capturing LangChain `usage_metadata`; the orchestrator stamps per-step token/cost into `agent_steps.summary` (`worker/processors/agent-step.ts`); a cost-model map (per-provider $/MTok) converts tokens→cents.

**UX flow.** A "Cost" line in the `/runs/[runId]` timeline (extends `lib/runs/timeline.ts`); a per-run + month-to-date estimate on `/billing` Usage.

**Backend / data changes.** None for MVP (ride `agent_steps.summary` jsonb). New `lib/billing/cost-model.ts`. (Follow-up adds a `usage` cost metric + `spend_caps` table.)

**Integrations.** LangSmith usage (already wired, `lib/observability/langsmith.ts`); Anthropic prompt-caching as a P1 lever.

**Guardrails / approval.** Read-out only; no behavior change. Cost attribution must be clearly labeled an *estimate* (Max-subscription-style "equivalent cost").

**Observability / evals.** This *is* observability infra. Validate against a known week of real usage before exposing.

**Tests.** Unit-test the token→cost conversion and the per-step rollup; verify `usage_metadata` is parsed for the configured Gemini path (T4 flagged this is provider-dependent).

**Success metrics.** *Leading:* % runs with a cost estimate (≥95%); cost-estimate error vs bill (<10%). *Lagging:* enables spend caps; margin visibility per tenant.

**Acceptance criteria.**
- [ ] Given a completed run, when I open `/runs/[runId]`, then I see total tokens and an estimated cost per step and per run.
- [ ] Given the Gemini provider, when a node calls the model, then `usage_metadata` is captured or a clearly-flagged fallback estimate is used.
- [ ] Given a month of runs, when I open `/billing`, then month-to-date estimated AI cost is shown.

**Open questions.** (data) Is `usage_metadata` populated for Gemini in `@langchain/google-genai`? (finance) Source-of-truth $/MTok table and refresh cadence?

---

### PRD 3 — Vigil (brand-safety eval as a CI merge gate)

**Problem.** The labeled brand-safety dataset, metrics, and `recommendThreshold` exist (`evals/brand-safety/run.ts`, `lib/evals/brand-safety-metrics.ts`) but are **not wired into CI** (`.github/workflows/ci.yml` has no eval step; T4 §Q5). For an autonomous content system, silent guardrail drift is the most dangerous failure mode, and there is no regression gate on it.

**Why now.** It's a safety multiplier that must precede expanding autonomy (every later feature adds agent behavior), it reuses assets already in the repo, and 2026 best practice is exactly this (trend radar: evals-as-CI).

**Goals.** Any PR that drops brand-voice / banned-term / platform-fit precision-recall below threshold fails CI; model-version bumps (`@langchain/anthropic`) are regression-tested before touching a real account.

**Non-goals.** A full eval *platform* / LangSmith dashboards (P2); evals for every agent (start with brand-safety, the highest-risk gate); replacing human review (the gate is additive to Castor/Praetor).

**Agent architecture.** A CI job runs a curated 20–50 example set through the candidate guardrail (`lib/agent/guardrails/model-judge.ts`) and `sys.exit(1)` below `PASS_THRESHOLD`. To keep the blocking gate cheap/deterministic, default to a **fixture/offline judge**; run the **live-LLM judge nightly** (needs a metered key).

**UX flow.** Developer-facing: a required GitHub check; failures annotate the PR with which metric regressed.

**Backend / data changes.** None. New `.github/workflows/` eval job + an offline-judge mode in `evals/brand-safety/run.ts`.

**Integrations.** GitHub Actions; optional LangSmith for nightly trace capture.

**Guardrails / approval.** N/A (it *is* a guardrail). Threshold guidance: start at 0.80, raise to just below observed average; structured-output checks at 0.95–1.00 (trend radar §6).

**Observability / evals.** Trend the eval score over time; alert on nightly live-judge drift even when the offline gate passes.

**Tests.** The eval harness is the test; add a meta-test that a deliberately-bad guardrail change fails the gate.

**Success metrics.** *Leading:* gate present on 100% of PRs touching `lib/agent/**`/`lib/agents/**`/`prompts`; ≥1 regression caught pre-merge in first quarter. *Lagging:* zero brand-safety incidents traced to an un-gated change.

**Acceptance criteria.**
- [ ] Given a PR that weakens the brand-safety judge, when CI runs, then the eval job fails and blocks merge.
- [ ] Given a model-version bump, when CI runs, then the eval set is replayed and the score delta is reported.
- [ ] Given no LLM key in CI, when the gate runs, then the offline-judge mode still produces a deterministic pass/fail.

**Open questions.** (eng) Offline-judge fidelity vs the live judge — acceptable gap? (ops) Who owns threshold updates as the dataset grows?

---

### PRD 4 — Rigel Narratives (insights that explain *why*)

**Problem.** Rigel produces counts (totalPublished, topTopics, runSuccessRate) but no decisions — users get numbers, not "short video on TikTok beat your LinkedIn text 4:1 this week; lean in" (`lib/agents/rigel/aggregate.ts`; T3 §C2).

**Why now.** It converts the data Pulse unlocks into retention-driving value ("your weekly strategist"), and it's a low-risk extension of an existing terminal agent. Works on current report data immediately; far better once Pulse lands.

**Goals.** ≥50% of generated insights rated "useful," ~0% rated "wrong" (hallucinated stats); each insight links to a one-click follow-up run.

**Non-goals.** Free-form chat over analytics (P2); predictive forecasting (P2); auto-acting on insights without human click (keep human-in-the-loop).

**Agent architecture.** A post-aggregate LLM step in `lib/agents/rigel/index.ts` (new `narrate.ts`) that reads the structured `ReportData` + week-over-week deltas and emits 3–5 grounded, actionable insights with a recommended next action; writes structured recommendations into `learnedMemory` for Lyra/Mensa to consume. Rigel keeps only `report` capability (read-only).

**UX flow.** "This week's insights" card on `/dashboard` with action buttons (e.g. "Recycle this winner →" kicks the relevant run); optional weekly email digest.

**Backend / data changes.** Extend `ReportData` with `insights[]` (or a `report_insights` table). No risky migration if stored in the existing `reports.data` jsonb.

**Integrations.** None new; optional email send via existing worker patterns.

**Guardrails / approval.** **Strictly ground on the structured report object — never free-form numbers** (hallucination guard); spot-check via the eval harness (Vigil).

**Observability / evals.** Add a small narrative-quality eval (grounded-in-data check); log insight click-through.

**Tests.** Unit-test that narratives only cite numbers present in `ReportData`; snapshot the prompt; offline-rate 10 historical reports.

**Success metrics.** *Leading:* insight useful-rate (≥50%), wrong-rate (~0%), click-through on "act on this." *Lagging:* retention lift among tenants who view insights weekly.

**Acceptance criteria.**
- [ ] Given a compiled report, when Rigel runs, then 3–5 insights are produced, each citing only figures present in `ReportData`.
- [ ] Given an insight with a recommended action, when I click it, then the relevant pipeline run (e.g. recycle/plan) starts.
- [ ] Given a report with zero engagement data (pre-Pulse), then insights degrade gracefully (volume/cadence only, no fabricated engagement).

**Open questions.** (design) Email digest in v1 or fast-follow? (data) WoW deltas need ≥2 reports — cold-start copy?

---

### PRD 5 — Run Doctor (self-healing supervisor)

**Problem.** When a run fails or stalls, recovery is manual; the reconcile sweep only cleans orphans. A transient model error, a bad payload, and a token problem need different responses, and the `supervisor` hook built for exactly this is a no-op (`orchestrator.ts:66,220`; T3 §F2).

**Why now.** It's the canonical use of a seam the system was explicitly designed around, a pure-internal reliability win (no new platform risk), and an SLA story for agency/enterprise tiers.

**Goals.** A bounded, audited auto-recovery for classifiable failures; the human pause gate is never overridden; recovery actions appear in the integrity-chained run timeline.

**Non-goals.** Parallel subagent fan-out / re-running an agent for N variants (research-later — needs fan-in too); overriding Castor pauses (forbidden by design); unbounded retries.

**Agent architecture.** Implement `OrchestratorDeps.supervisor` wired in `orchestrator.runtime.ts`. On a failed/looping step it classifies (transient → bounded retry w/ backoff; content-quality → re-route to Lyra refine; account/token → hold + surface fix-it (folds in Sentinel B2); hard error → escalate) and applies one bounded action under a **max-recovery budget**. **Prerequisite (P0, conflict C-3):** add a **per-step idempotency key** so a retry of the same agent doesn't collide with its stored `(runId, agent)` step (`orchestrator.ts:166-168`).

**UX flow.** A "Recovery actions" lane in `/runs/[runId]` showing what the supervisor decided and why; a `/dashboard` "Runs needing attention" with one-click human override.

**Backend / data changes.** Per-step key change in the step model; optional `recovery_actions` audit rows (or reuse `agent_steps.control` jsonb). Reuses the `hash`/`prevHash` chain for tamper-evident recovery audit.

**Integrations.** None new; LangSmith trace already correlated by `runId`.

**Guardrails / approval.** Never overrides a pause (human gate stands, already enforced); hard recovery budget prevents loops; every recovery action is written to the integrity chain; escalate after N attempts.

**Observability / evals.** Replay historical failed runs offline to measure correct-vs-wrong recovery before enabling; alert on budget exhaustion.

**Tests.** Extend `orchestrator.test.ts` (already 17+ cases) with per-step-key idempotency, retry-doesn't-double-act, pause-not-overridden, budget-exhaustion-escalates.

**Success metrics.** *Leading:* % classifiable failures auto-recovered correctly (offline ≥ target before enabling live); manual-intervention rate ↓. *Lagging:* failed-campaign rate ↓; agency-tier retention/SLA.

**Acceptance criteria.**
- [ ] Given a transient model error, when the step fails, then the supervisor retries with backoff up to the budget, then escalates.
- [ ] Given the same agent retried in one run, when it re-dispatches, then the per-step key prevents a double-action.
- [ ] Given a run in `awaiting_approval`, when the supervisor evaluates it, then it never resumes past the human gate.
- [ ] Given any recovery action, when it executes, then it is recorded in the run's hash chain and visible in `/runs/[runId]`.

**Open questions.** (eng) Per-step key schema migration sequencing against the unapplied `0000–0024` stack? (product) Recovery budget defaults per plan tier?

---

### PRD 6 — Sirius Triage v1 (comment intent/sentiment + injection fix) — *card*

- **User story.** *As a brand manager, I want incoming comments classified by intent and sentiment so I can prioritize leads and complaints instead of drowning in canned replies.*
- **Why now.** Autonomous comment/DM engagement is the competitive battleground (trend §8); the ingestion pipeline already exists; and it carries the fix for the **#1 injection hole** (conflict C-2).
- **Agent architecture.** Add an LLM intent+sentiment classification step in `worker/processors/comment-poll.ts`; route only safe buckets (question/praise) to existing `reply.ts`; group everything in an inbox. **Harden `composeAiReply`**: bound commenter-text length, quarantine it as data (`worker/processors/reply.ts:120-137`).
- **UX flow.** An "Engagement inbox" (extend `/auto-reply` Activity tab) grouped by intent with Accept/Edit/Send/Ignore; escalations badge the dashboard.
- **Backend / data.** One additive migration: `intent`, `sentiment`, `urgency` nullable columns on `comment_events`.
- **Guardrails / approval.** Never auto-engage negative/abuse buckets; high-risk buckets require approval; injection hardening is P0 and ships with this change.
- **Observability / evals.** Label 200 historical `comment_events`; require ≥80% classifier agreement on safe buckets before enabling auto-reply for them.
- **Goals / non-goals.** *Goal:* lead-aware triage on existing rails + closed injection hole. *Non-goal (P1):* DM ingestion, lead escalation/CRM, abuse audit (→ Conversation Closer).
- **Success metrics.** Safe-bucket classifier agreement ≥80%; zero public replies containing injected instructions; lead-response time ↓.
- **Acceptance.** [ ] commenter text is length-bounded before entering any prompt · [ ] each ingested comment gets intent/sentiment/urgency · [ ] only question/praise auto-reply; leads/complaints/abuse route to inbox/suppression.

---

### PRD 7 — Praxis Live v1 (editable policy/disclosure packs + native AI flag) — *card*

- **User story.** *As an org admin in a regulated market, I want to add my own banned-claim and required-disclaimer rules and have AI posts carry the platform's native AI-content flag, so I stay compliant without a code change.*
- **Why now.** Compliance is the stated P0; per-jurisdiction/brand variance is the most-requested gap; this is the **de-risked half of conflict C-1** (text + native flag now; C2PA later).
- **Agent architecture.** Make the Praxis linter read rules from `brand_profiles.disclosurePolicy` jsonb (already has a settings form) instead of the hardcoded array (`lib/compliance/policy-linter.ts`); set each platform's native AI-content flag in Atlas's `applyDisclosure` path.
- **UX flow.** `/settings` disclosure-policy form gains editable rule rows + an "Embed native AI label" toggle + jurisdiction selector; `/compliance` shows per-post disclosure status.
- **Backend / data.** No new table (ride existing jsonb); extend `disclosure_ledger` write to record `platformLabelApplied`.
- **Guardrails / approval.** Keep human approval for any auto-published path; cite rule source; version rules (reuse `disclosure_ledger.policyVersion`).
- **Observability / evals.** Per-post provenance status (text-labeled / native-flagged); ledger remains append-only audit.
- **Goals / non-goals.** *Goal:* per-org editable rules + native platform AI flag. *Non-goal (→ §7):* C2PA/SynthID cryptographic media signing; autonomous policy-diff watcher (T3 D1 stretch).
- **Success metrics.** % AI posts carrying a native platform flag where supported; admin self-serve rule edits (no eng ticket); zero Art. 50 text-disclosure gaps.
- **Acceptance.** [ ] admin adds a banned-claim rule and Castor blocks a violating draft · [ ] AI post on a supporting platform carries the native AI flag · [ ] `disclosure_ledger` records label applied + policy version.

---

### PRD 8 — Chronos (best-time-to-post optimizer) — *card*

- **User story.** *As a creator, I want the agent to schedule each post when my audience is most active, so I stop guessing at post times.*
- **Why now.** Direct engagement lift; publish jobs are already delay-scheduled; architecture-aligned (aggregation, no vector store). **Hard dependency: Pulse** (needs real `metrics`).
- **Agent architecture.** A pure scorer `lib/scheduling/best-time.ts` learns per-tenant per-platform engagement-by-hour/weekday from `post_targets.publishedAt` + `metrics`; Atlas consults it when `scheduledAt` is absent (`lib/agents/atlas/index.ts`); a periodic job refreshes a `posting_windows` table.
- **UX flow.** "Recommend a time" button + confidence note ("based on 38 past posts") in composer/calendar; a heatmap on `/dashboard`.
- **Backend / data.** New `posting_windows` (clerkUserId, platform, dow, hour, score) or compute-on-read; reuses `posts.timezone`.
- **Guardrails / approval.** Human can always override; cold-start blends with platform-wide priors and labels low confidence.
- **Goals / non-goals.** *Goal:* per-tenant learned send-times with cap-aware slotting. *Non-goal:* cross-tenant benchmarking (privacy); paid-promotion timing.
- **Success metrics.** Engagement lift of "recommended-window" vs "off-window" posts; recommendation acceptance rate.
- **Acceptance.** [ ] with ≥N posts of history, recommended slots reflect the tenant's actual engagement peaks · [ ] new tenants get labeled platform-prior defaults · [ ] recommendations respect per-platform daily caps and timezone.

---

### PRD 9 — Mensa (Cadence Architect — autopilot calendar) — *card*

- **User story.** *As a small social team, I want to approve a two-week, multi-platform content plan in one click instead of filling a blank composer every day.*
- **Why now.** The clearest "Command Marketing" embodiment and strongest upgrade driver; composes existing pipeline runs rather than rebuilding. **Gated by Quaestor** (cost cap) per conflict C-5.
- **Agent architecture.** A new roster agent **Mensa** (capability `plan`) that reads the latest `reports` + `learnedMemory` (feed-forward exists, `orchestrator.ts:266`), pulls 1–2 Vega research fills, emits an N-slot plan, and on approval hands each slot to the existing Lyra→Castor→Atlas pipeline with a scheduled `runAt`. Sits *above* Orion (emits many runs).
- **UX flow.** "Plan my next 2 weeks" on `/calendar` → editable draft calendar (reuse `CalendarGrid`) → one "Approve plan" enqueues the runs.
- **Backend / data.** New `content_plans` (id, clerkUserId, periodStart, status, slots jsonb); new `/api/plans` route + action; add `Mensa` to `types.ts`/`capabilities.ts`/`registry.ts`.
- **Guardrails / approval.** **Hard per-tier slot cap + mandatory Castor approval (no auto-publish)**; never bypasses cost caps (Quaestor).
- **Goals / non-goals.** *Goal:* approve-able multi-platform plan that becomes scheduled runs. *Non-goal (P1):* weekly auto-rebalance from Rigel; gap-detection auto-fill.
- **Success metrics.** Plan approve-rate; % slots surviving edits (T3 validation: <50% ⇒ quality not there); Pro→Premium upgrade lift.
- **Acceptance.** [ ] generates a tier-capped plan from the last report · [ ] each approved slot becomes a scheduled pipeline run gated by Castor · [ ] plan generation is metered and refuses past the tenant's cost cap.

---

### PRD 10 — Evergreen Recycler (winner repurposing) — *card*

- **User story.** *As a creator, I want my best post re-cut for another platform and re-run months later, so my proven winners keep working.*
- **Why now.** Strong retention/"more from content you already made" story. **Hard dependency: Pulse** (needs engagement to find winners).
- **Agent architecture.** A daily `worker/processors/recycle.ts` scans top-engagement `post_targets`, filters by a freshness gap, and enqueues pipeline runs whose `steps[0]` is Lyra (skip Vega — already supported, `orchestrator.ts:95`) with a "re-angle for {platform}, freshen, don't duplicate" instruction → Castor.
- **UX flow.** "Recyclable winners" card on `/dashboard` with "Repurpose →" pre-filling the review queue; optional auto-mode behind the auto-publish threshold.
- **Backend / data.** New nullable `generated_content.derivedFromTargetId` for lineage/dedup; reuses `post_targets.metrics`, `posts.sourceContentId`.
- **Guardrails / approval.** Minimum gap window + freshness re-critique to avoid duplicate-content penalties; Castor still gates.
- **Goals / non-goals.** *Goal:* one-click repurpose of a proven winner. *Non-goal (P1):* fully autonomous weekly recycle; format-change re-cut (e.g. text→video brief).
- **Success metrics.** "Would post" operator-rating of repurposed drafts (T3: >60% ⇒ build autonomous path); engagement of recycled vs original.
- **Acceptance.** [ ] dashboard lists winners by real engagement percentile · [ ] "Repurpose" produces an on-brand re-angle for a platform the winner wasn't posted to · [ ] recycled drafts respect a minimum gap window and pass a freshness re-critique.

---

## 6. Build first — the exact first wave

A coherent 5-feature wave that closes the loop and installs the safety rails, ordered by dependency. **Pulse is the keystone — do it first.**

### Wave 1 (sequence)
1. **Pulse** (PRD 1) → unblocks Chronos, Recycler, Hook Lab, and real Rigel data.
2. **Quaestor** (PRD 2) → makes spend measurable; unblocks safe autopilot + spend caps.
3. **Vigil** (PRD 3) → the eval gate that must precede any further autonomy.
4. **Sirius Triage v1 incl. the injection fix** (PRD 6) → competitive parity + closes the #1 security hole.
5. **Run Doctor** (PRD 5, with its per-step-key prerequisite) → reliability on the seam the system was built for.

(Praxis Live v1, PRD 7, can run in parallel — it's independent and a strong compliance quick win.)

### Exact first implementation tasks — Pulse (precise, in order)
1. **Confirm `fetchMetrics` reality per connector.** Open each of `lib/platforms/{facebook,instagram,linkedin,tiktok,x,youtube,pinterest,discord}.ts` and confirm which override `fetchMetrics` vs inherit the throwing base (`lib/platforms/base.ts:52-57`) — T1 could not verify this connector-by-connector. *Read-only; resolves an open question before writing code.*
2. **Implement `fetchMetrics` for Meta first** (`lib/platforms/facebook.ts`, `instagram.ts`) against Graph API insights; normalize into the existing `Record<string, number>` shape.
3. **Add the queue + processor.** New `metrics` `QueueName` (`lib/queue/queues.ts:6-22`), `worker/processors/metrics-poll.ts` (mirror `comment-poll.ts` idempotency/watermark), register in `worker/index.ts`.
4. **Add `registerMetricsPoll(socialAccountId)`** in `lib/queue/jobs.ts` (mirror `registerTokenRefresh`/`registerSeeding`, `:229-261`) with the maturity-curve cadence; have **Sirius** call it alongside `registerCommentPoll` (`lib/agents/sirius/index.ts`).
5. **Surface the data:** add the engagement column to `/dashboard` and per-post metrics to `app/(dashboard)/posts/[id]/page.tsx`.
6. **Tests:** unit-test the cadence scheduler + idempotent write; integration-test population against a mocked Meta connector.
7. **Respect the constraints:** all of this runs on the **worker** (not a serverless route); the new work is additive and needs **no migration** (writes existing columns). Before the first live deploy, note that migrations `0000–0024` must be applied once (separate, tracked operational step — see §8).

**Definition of done for Wave 1:** real engagement data populates within 48h of publish (Pulse), every run shows an estimated cost (Quaestor), the brand-safety eval blocks regressions in CI (Vigil), comments are triaged and the auto-reply injection hole is closed (Sirius Triage), and classifiable run failures auto-recover within budget without overriding the human gate (Run Doctor).

---

## 7. Research later

Deferred deliberately — each needs a decision, a dependency, or a forcing function first. Revisit when the trigger fires.

- **C2PA / SynthID cryptographic media provenance** (conflict C-1; T4 §D5). *Trigger:* a regulated/enterprise customer contractually requiring verifiable *image* credentials **and** a per-platform pilot proving manifests survive re-download. Text disclosure + native flag (PRD 7) is the baseline until then.
- **Spend caps / budget governor** (the enforcement half of FinOps; T3 §G1, T4 §M3). *Trigger:* Quaestor (PRD 2) shipped and cost numbers validated against the bill. Then add per-tenant budgets at the two metered entry points, reusing the `usage`/rate-limit machinery.
- **Campaigns as first-class objects ("Meridian")** (T4 §M1). *Trigger:* the analytics loop is closed (Pulse) so ROI/repurposing have data; then a multi-table `campaigns` migration + `campaignId` backfill + UI.
- **Multi-brand workspaces ("Atrium")** (T4 §M5). *Trigger:* agency demand strong enough to justify the largest data-model change in the backlog (every `db/schema/*` + every repo + a brand switcher) — schedule as its own milestone with a reversible migration **after** the DB is live.
- **Versioned Voice Card + exemplar retrieval ("Mnemosyne")** (T4 §M4). *Trigger:* a committed decision to add a vector capability (pgvector on Neon + embedding model + cost). Ship the versioning UI first; defer vectors.
- **Semantic search / RAG over past content & comments** (T4 §D3). *Trigger:* a concrete retrieval use-case + the vector-store decision above. No embeddings/pgvector exist today.
- **True tool-calling ReAct agent** (conflict C-4; T4 §D2). *Trigger:* a product need direct-call nodes can't satisfy, **plus** Quaestor + Vigil in place to bound cost and catch regressions. Until then keep deterministic nodes; add the **MCP direct-call node** (T4 §Q6) as the additive tool path.
- **Parallel per-platform subagent fan-out / Dynamic Workflows** (trend §1; conflict C-3). *Trigger:* the per-step idempotency key (from Run Doctor) plus a fan-in/merge step; revisit once Opus 4.8 effort dials are wired as a cost lever.
- **Productionized multi-tenant inbound A2A ("Legate") + agent-identity (Okta XAA / Entra Agent ID)** (T3 §F1, T4 §D4, trend §5). *Trigger:* a named enterprise partner; build a per-tenant credential→tenant auth model first (today's A2A is single-tenant, default-disabled — exposing it without this is a cross-tenant authz risk). Keep disabled pre-PMF.
- **Dreaming-style memory consolidation job** (trend §3). *Trigger:* Pulse + Rigel Narratives shipped (so there's real signal to consolidate); then a scheduled job that curates `brand_profiles.learnedMemory` (winning formats, recurring banned-term hits, best windows) instead of letting it grow stale.

---

## 8. Appendix

### Hard constraints every feature must respect (from T4)
- **Two-lane execution:** `/api/generate` is capped at `maxDuration = 60` and runs the graph in-request (`app/api/generate/route.ts:16-17`); all long/multi-LLM work goes on the always-on BullMQ worker via a new queue + processor.
- **Migrations `0000–0024` are generated, never applied** — the first live `drizzle-kit migrate` is itself an untested step; keep all new migrations additive + nullable.
- **No vector store / no embeddings / no pgvector** — rules out RAG/semantic features until a deliberate vector decision.
- **No LangGraph checkpointer** — intra-graph resilience is orchestrator idempotency only; "re-run from step" needs a checkpointer.
- **Orchestrator one-agent-per-run key** (`orchestrator.ts:166-168`) — any retry/loop/fan-out of the same agent needs a per-step key first (prerequisite baked into Run Doctor).
- **Prompt-injection surface:** AI auto-replies feed **raw, unbounded** commenter text into a public-posting prompt (`worker/processors/reply.ts:120-137`) — the highest-value target; fixed in Sirius Triage v1. Any new node ingesting external text inherits this risk — bound length, never let tool/comment output dictate control.
- **Tenancy is app-enforced (`clerkUserId`), no RLS** — every new repo query must carry the tenant predicate.
- **Secrets:** reuse `deriveSubKey(purpose)` (HKDF) off the validated `ENCRYPTION_KEY`; never store tokens/PII unencrypted.
- **Next.js 16 breaking changes** (`AGENTS.md`) — read `node_modules/next/dist/docs/` before adding routes/actions; copy the in-repo route patterns.

### Source index
- **T1 Repo Intelligence:** [`docs/research/01-repo-intelligence.md`](research/01-repo-intelligence.md)
- **T2 Trends (URLs + dates):** [`docs/research/02-trends.md`](research/02-trends.md)
- **T3 Feature Ideation (14 ideas):** [`docs/research/03-feature-ideation.md`](research/03-feature-ideation.md)
- **T4 Feasibility & Risk (buckets + scores):** [`docs/research/04-feasibility.md`](research/04-feasibility.md)
- Prior research extended by T2: [`ai-agent-trends-2026-06-22.md`](research/ai-agent-trends-2026-06-22.md), [`ai-agent-trends-2026-06-22-refresh.md`](research/ai-agent-trends-2026-06-22-refresh.md)

### Coverage / honesty notes
- All four research files were written and read in full; none missing.
- **T2** flagged two OpenAI model-launch pages returned HTTP 403 — GPT-5.x details are cited from the OpenAI API **changelog** (primary for dates/existence); capability superlatives labeled secondary. The MCP 2026-07-28 RC is post-cutoff/provisional — do not implement against it.
- **T1/T4** could not verify per-connector `fetchMetrics` coverage or exercise anything at runtime (no live DB/Redis/LLM/social creds); all verdicts are code-verified, not behavior-verified. Pulse task #1 resolves the connector question before code is written.

*Compiled 2026-06-24. Read-only synthesis of four cited research files; no code modified.*
