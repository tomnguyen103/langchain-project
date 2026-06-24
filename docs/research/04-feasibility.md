# Research Task 4 — Feasibility & Risk

_Date: 2026-06-24. Read-only analysis. Judges what is buildable on the EXISTING SocialFlow architecture (Next.js 16 + React 19, LangChain/LangGraph 1.x, Drizzle + Neon Postgres, BullMQ worker, Clerk, ImageKit, LangSmith, Zod 4) WITHOUT a rewrite. Candidate features derived from what the architecture invites — not from other tasks' outputs. Every claim is grounded in files opened, cited `path:LINE`._

> **Standing caveat (inherited, confirmed):** nothing has run against live DB/Redis/LLM/social APIs. Migrations `0000`–`0024` are **generated, not applied** ([db/migrations/meta/_journal.json] — 25 entries, latest `0024_certain_ironclad`). "Feasible" below means "fits the code-verified architecture," not "proven live." This is the dominant residual risk and it amplifies every score's downside.

Scoring key (1 = worst / hardest / riskiest, 5 = best / easiest / safest):
- **Eng** = engineering effort (5 = schema/worker/agent already supports it; 1 = needs major new infra)
- **Sec** = security/privacy risk (5 = no new attack surface; 1 = new token/PII/injection/tenant exposure)
- **Cost** = operational cost (5 = negligible LLM/queue/API load; 1 = heavy spend or hits third-party limits)
- **Val** = user value (5 = clear, broad; 1 = niche)
- **Arch** = architecture alignment (5 = fits LangGraph+BullMQ+Drizzle cleanly; 1 = fights it)

---

## Architecture facts that drive every verdict

These were verified by opening the code and are the load-bearing constraints behind the buckets.

1. **Two distinct execution lanes, with very different limits.**
   - **Synchronous, serverless-bound:** `/api/generate` runs the LangGraph `contentGraph` *inside the HTTP request* and declares `export const maxDuration = 60` ([app/api/generate/route.ts:16-17], [app/api/generate/route.ts:64]). Any feature that adds LLM hops to the inline generate path eats into a hard 60 s serverless ceiling.
   - **Async, always-on worker:** `/api/agents/run` only `consumeQuota` + `orchestrator.startRun` + returns a `runId` ([app/api/agents/run/route.ts:77-81]); the real multi-agent pipeline executes on the BullMQ worker ([worker/index.ts:69-79]), which is a long-running Node process with no request timeout. **This is where heavy/long features belong.** New durable work = a new `QueueName` + processor + `enqueue*` helper following the existing ledger-first idempotent pattern ([lib/queue/jobs.ts:22-60], [lib/queue/queues.ts:6-22]).

2. **The orchestrator is additive by construction.** Agents are an `AgentDefinition { name, run(input, ctx) }` resolved through a registry with **no switch** ([lib/agents/registry.ts]), wired with injected deps (no `db`/`env` imports inside agent code), with a least-privilege capability matrix enforced by test ([lib/agents/capabilities.ts:12-22]). Adding an agent = add a folder + register + grant a capability. Handoffs are idempotent on `(runId, agent)` ([lib/agents/orchestrator.ts:169-188]); a supervisor hook can already override a handoff ([lib/agents/orchestrator.ts:222-231]). **Caveat:** the idempotency key assumes each agent runs **at most once per run** ([lib/agents/orchestrator.ts:166-168]) — any feature that re-invokes the same agent twice in one run needs a per-step key first.

3. **The content graph is small, linear, and easy to extend.** `START → analyze → draftPerPlatform → critique → (refine ⇄ critique | finalize) → END`, `MAX_REVISIONS = 2`, compiled at boot ([lib/agent/graph.ts]). State is a typed `Annotation.Root` with clear reducers ([lib/agent/state.ts]). Adding a node/state-channel is additive. **But** the graph is recompiled-fixed (no dynamic nodes) and is **not** checkpointed.

4. **No tool-calling loop, no vector store, no checkpointer — by design.**
   - Tools are plain async functions called inside nodes, **not** LangChain `tool()` bound to the model ([lib/agent/tools/web-search.ts:8-37] is the *only* tool, called directly in [lib/agent/research.ts], not bound to the graph). A true tool-use agent would be new machinery.
   - **No embeddings / pgvector / semantic search anywhere** (confirmed across `lib/` and `db/`). `@langchain/langgraph-checkpoint` appears only transitively in `package-lock.json` (3 hits), **not** in `package.json` deps.
   - `contentGraph.compile()` has **no checkpointer** ([lib/agent/graph.ts]); intra-graph resilience comes from the orchestrator's step idempotency, not LangGraph persistence.

5. **Multi-tenant model is `clerkUserId`-scoped, single-brand.** No `brands` table, no `brandId` columns anywhere; `brand_profiles` is 1:1 with a tenant ([db/schema/brand-profiles.ts]). A2A is single-tenant and default-disabled (`A2A_TENANT_ID`, [app/api/a2a/route.ts]).

6. **Crypto/secret posture is solid.** OAuth tokens are AES-256-GCM at rest with scrypt-derived keys + HKDF sub-keys for domain separation (PKCE) ([lib/utils/crypto.ts]); `ENCRYPTION_KEY` is validated unconditionally ([lib/env.ts:24-26]); webhooks use constant-time HMAC; bearer checks are `timingSafeEqual`. New features should reuse `deriveSubKey(purpose)` rather than inventing key handling.

7. **Eval/CI gap.** CI runs lint + typecheck + `drizzle-kit check` + unit tests + build ([.github/workflows/ci.yml]). The brand-safety eval (`npm run eval:brand-safety`, [evals/brand-safety/run.ts]) is **NOT** wired into CI, and its judge run is deferred to live (needs an LLM key). There is no quality/regression gate on agent output in CI. 44 `*.test.ts` files under `lib/`; integration tests skip without a DB.

---

## Bucket 1 — Quick wins (high value, low effort, fits the architecture, low risk; buildable in days on existing infra)

### Q1. Per-target metrics-fetch worker (close the analytics loop) — Eng 5 · Sec 4 · Cost 4 · Val 5 · Arch 5
The single highest leverage gap. `post_targets.metrics` is **already a `jsonb $type<Record<string, number>>` column with `metricsUpdatedAt`** ([db/schema/post-targets.ts]), connectors **already expose `fetchMetrics(account, externalPostId)`** ([lib/platforms/types.ts]), and Rigel **already aggregates from published targets** ([lib/agents/rigel/index.ts:55-67]) — but *nothing populates `metrics`*. Add one repeatable BullMQ job (mirror `registerTokenRefresh` / `registerSeeding`, [lib/queue/jobs.ts:229-261]) that walks recently-published targets, calls `fetchMetrics`, and writes the jsonb. No new table, no migration, no new agent. Rationale: turns the existing dashboard + Rigel feed-forward from estimates into real engagement data.
- Key files: `worker/processors/metrics.ts` (new), [lib/queue/jobs.ts], [lib/queue/queues.ts], [lib/platforms/types.ts], [lib/agents/rigel/aggregate.ts], `worker/index.ts`.
- Risk note: third-party read-API rate limits (Cost 4 not 5) — throttle per platform; failures are non-fatal.

### Q2. Run cost & token telemetry (FinOps groundwork, "Quaestor/Tally" MVP) — Eng 4 · Sec 5 · Cost 5 · Val 4 · Arch 5
There is **no cost/token tracking anywhere** (confirmed: no `cost`/`tokenUsage`/`spend` columns/tables). LangChain responses carry `usage_metadata`; `agent_steps.summary` is a free `jsonb` ([db/schema/agent-steps.ts]) and the LLM factory is the one chokepoint ([lib/llm/factory.ts:14-24]). Quick win: capture token counts into `agent_steps.summary` / `generated_content` and surface a per-run cost estimate in the Lumen run inspector ([app/(dashboard)/runs/[runId]/page.tsx]). Pure additive read-out; no migration if you ride existing jsonb. Rationale: you can't add spend caps (a backlog "do-not-yet") until you can first *measure* spend — this is the measurement half, cheaply.
- Key files: [lib/llm/factory.ts], [lib/agent/index.ts], [lib/agents/orchestrator.ts] (step recording), [lib/runs/timeline.ts], `components/runs/*`.

### Q3. Editable per-org policy/disclosure rule packs — Eng 4 · Sec 4 · Cost 5 · Val 4 · Arch 5
Praxis policy-linter rule packs are curated-but-hardcoded ([lib/compliance/policy-linter.ts]) and run inside Castor ([lib/agents/castor/index.ts:101]); `brand_profiles.disclosurePolicy` is **already a `jsonb` with a settings form** ([db/schema/brand-profiles.ts], [app/(dashboard)/settings/disclosure-policy-form.tsx]). Let orgs add banned-claim/required-disclaimer rules into that existing jsonb and have the linter read them. No new table. Rationale: compliance is the stated P0, and per-jurisdiction/per-brand variance is the most-requested gap; this is config, not infra.
- Key files: [lib/compliance/policy-linter.ts], [db/schema/brand-profiles.ts], [app/(dashboard)/settings/*], [lib/agents/castor/index.ts].

### Q4. Comment triage enrichment (sentiment/category/urgency) — Eng 3 · Sec 4 · Cost 4 · Val 4 · Arch 5
`comment_events` has **no `sentiment`/`category`/`urgency` columns** (confirmed [db/schema/comment-events.ts]) — so this needs **one additive migration** (three nullable columns; safe, append-only). The ingestion pipeline + worker already exist ([worker/processors/comment-poll.ts], [worker/processors/reply.ts]); classification can be a cheap single LLM call in the poll processor or a follow-on job. Rationale: upgrades auto-reply from keyword-only to lead-aware triage — the "Sirius+" backlog item — on rails that already exist. Drops to Eng 3 because it touches a live-DB migration and adds LLM cost per comment (gate behind a per-rule/plan toggle).
- Key files: [db/schema/comment-events.ts] (+ new migration), [worker/processors/comment-poll.ts], [lib/agents/sirius/index.ts], review/inbox UI.

### Q5. Wire the brand-safety eval into CI as a regression gate ("Vetus/Vigil" MVP) — Eng 4 · Sec 5 · Cost 4 · Val 4 · Arch 5
The labeled dataset + metrics + `recommendThreshold` already exist ([evals/brand-safety/run.ts], [lib/evals/brand-safety-metrics.ts]) but aren't in CI ([.github/workflows/ci.yml] has no eval step). Add a CI job (or a deterministic offline-judge mode) that fails the build on precision/recall regression. Rationale: closes the most dangerous gap for an autonomous content system — silent guardrail drift — using assets already in the repo. Cost 4 because a real-LLM judge in CI needs a metered key; mitigate with a fixture/offline judge for the blocking gate and a nightly live run.
- Key files: [.github/workflows/ci.yml], [evals/brand-safety/run.ts], [lib/agent/guardrails/model-judge.ts].

### Q6. Add an MCP-tool node to the content graph (activate dormant MCP) — Eng 4 · Sec 3 · Cost 5 · Val 3 · Arch 4
The MCP-inward client is **built but never called** — `listMcpTools`/`callMcpTool` over stateless HTTP, graceful no-op when `MCP_SERVER_URL` unset ([lib/mcp/client.ts], [lib/mcp/rpc.ts]), exported and dormant. A new node ([lib/agent/nodes/*]) can try MCP tools then fall back to `searchWeb`, wired additively after `analyze`. Rationale: unlocks external knowledge/tools with near-zero new infra. Sec 3 (not higher) because MCP results become **untrusted text entering prompts** — treat like web-search snippets and bound length (see Hard constraints / prompt-injection).
- Key files: `lib/agent/nodes/<new>.ts`, [lib/agent/graph.ts], [lib/agent/state.ts], [lib/mcp/client.ts].

---

## Bucket 2 — Next major bets (high value, real effort/new infra; do after the quick wins)

### M1. Campaigns as first-class objects ("Meridian") — Eng 2 · Sec 4 · Cost 4 · Val 5 · Arch 3
No `campaign`/`campaignId` table or column anywhere (confirmed). Needs a new `campaigns` table + nullable `campaignId` FK backfilled across `posts`/`generated_content`/`agent_runs` + UI. The orchestrator's `agent_runs.plan` jsonb ([db/schema/agent-runs.ts]) can already carry a campaign brief, so the *agent* side is cheap; the *data-model + migration + UI* side is the real cost. Rationale: campaigns are the organizing primitive for repurposing, scheduling cadence, and ROI — a force-multiplier, but a multi-table migration against an as-yet-unmigrated DB (Arch 3, Eng 2).
- Key files: `db/schema/campaigns.ts` (new) + migration, [db/schema/posts.ts], [lib/agents/orchestrator.ts], dashboard.

### M2. Scheduling intelligence / self-optimizing send-times ("Chronos") — Eng 3 · Sec 4 · Cost 4 · Val 4 · Arch 4
Becomes feasible **only after Q1** (you need real per-target `metrics` to learn from). Atlas already owns scheduling ([lib/agents/atlas/index.ts]); a periodic job can compute best-time windows from `post_targets.metrics` + `publishedAt` and feed Atlas's `runAt`. Fits BullMQ + the existing feed-forward pattern; no vector store needed (it's aggregation, not retrieval). Rationale: direct engagement lift, architecture-aligned, but gated on the analytics loop and on enough live data to be non-trivial.
- Key files: `worker/processors/*` (new analysis job), [lib/agents/atlas/index.ts], [lib/agents/rigel/aggregate.ts].

### M3. Spend caps / budget governor (the enforcement half of FinOps) — Eng 3 · Sec 4 · Cost 5 · Val 4 · Arch 4
After Q2 makes spend *measurable*, add per-tenant budgets enforced at the two metered entry points ([app/api/generate/route.ts], [app/api/agents/run/route.ts]) reusing the `usage`/quota machinery ([lib/billing/entitlements.ts], [lib/repos/usage.ts]) and the Postgres rate-limiter pattern ([lib/repos/rate-limits.ts]). Needs a small `budgets`/cost-rollup table + a cost-model map. Rationale: protects gross margin once usage grows; clean fit with existing metering, but real money/billing logic warrants care (and a migration).

### M4. Versioned Voice Card with exemplar retrieval ("Mnemosyne") — Eng 2 · Sec 4 · Cost 3 · Val 4 · Arch 2
`brand_profiles.voice` + `learnedMemory` exist ([db/schema/brand-profiles.ts]); the *versioned card + diff timeline* is moderate. The **exemplar-retrieval** half is the expensive part: **there is no embeddings/pgvector capability** (confirmed) — adding it means the pgvector extension (Neon supports it, but it's net-new infra + an embedding-model dependency + cost) and an ingestion path. Rationale: high-quality on-brand voice is valuable, but the retrieval layer is the first thing in this codebase that genuinely fights the current "no vector store" design (Arch 2). Ship the versioning UI first; defer vectors to a deliberate decision.
- Key files: `db/schema/brand-profiles.ts` (+ versioning) and, for exemplars, new embedding infra.

### M5. Multi-brand workspaces ("Atrium") — Eng 1 · Sec 3 · Cost 4 · Val 5 · Arch 3
Explicitly deferred in prior planning, and the scan confirms why: a `brands` table + nullable `brandId` backfilled across **posts, social_accounts, agent_runs, generated_content, reports, brand_profiles** + a brand switcher + re-scoping every tenant query. High value for agencies, but it's the largest data-model change in the backlog and rewrites the tenant-scoping assumption (`clerkUserId`-keyed throughout). **Major bet, not a quick win** — schedule it as its own milestone with a careful, reversible migration once the DB is actually live.
- Key files: nearly every `db/schema/*` + every repo + topbar.

---

## Bucket 3 — Do not build yet (infeasible without a rewrite, too risky, or poor architecture fit)

### D1. Streaming / agentic generative UI in the inline generate path — **WHY:** `/api/generate` runs LangGraph synchronously under `maxDuration = 60` ([app/api/generate/route.ts:16-17]); the endpoint returns JSON, not a stream, and streaming was explicitly descoped. True token-streaming UI + multi-tool agentic loops in-request would blow the serverless timeout and require either a streaming transport or moving generation onto the worker with a client poll/subscribe channel. **What must change first:** decide on a streaming/SSE transport or a worker-backed generate lane (with a results channel), then build the agentic loop there — not in the request path.

### D2. True tool-calling ReAct agent (model-bound tools) — **WHY:** the system deliberately uses **direct function calls in nodes, not bound tools** ([lib/agent/tools/web-search.ts] is the only tool and is called directly, never `model.bindTools(...)`). Converting to a bound-tool agent changes the agent contract, adds an unbounded tool-call loop (latency + cost + new failure modes), and undercuts the current deterministic, testable node design. **What must change first:** a product reason that direct-call nodes can't satisfy, plus loop bounds, a per-call cost budget (Q2/M3), and the eval gate (Q5) to catch regressions. Today it's complexity without a forcing function.

### D3. Semantic search / RAG over past content & comments — **WHY:** there is **no vector store, no embeddings, no pgvector** in the codebase (confirmed across `lib/` + `db/`); search is keyword-only via Tavily. Adding RAG is net-new infra (extension, embedding model, ingestion, retrieval, cost) — an architectural addition, not a feature. **What must change first:** a committed decision to introduce a vector capability (its own milestone; see M4), justified by a concrete retrieval use-case. Until then it's premature.

### D4. Productionized multi-tenant inbound A2A marketplace ("Legate") — **WHY:** A2A ships as a single-tenant, **default-disabled** scaffold bound to one `A2A_TENANT_ID` with a single shared bearer token, no per-tenant credential→tenant mapping, no SSE, agent-card at `/api/a2a` not `/.well-known/...` ([app/api/a2a/route.ts]). Exposing it externally without a credential→tenant model is a **cross-tenant authorization risk**. **What must change first:** a real multi-tenant auth model (token issuance scoped per tenant), full task lifecycle, and a named partner to justify the attack surface. Keep disabled pre-PMF.

### D5. C2PA / SynthID cryptographic media signing — **WHY:** disclosure today is text + a per-platform AI-label flag + ledger ([lib/compliance/disclosure.ts], [db/schema/disclosure-ledger.ts]); cryptographic image provenance was deliberately deferred to keep deps light. It needs a signing/watermark toolchain (and key management) that doesn't exist here. **What must change first:** a regulated/enterprise customer requiring verifiable *image* credentials; until then the text-marking MVP satisfies the EU Art.50 text-content requirement. Schedule as a fast-follow, not now.

---

## Hard constraints (the boundaries every candidate must respect)

- **Serverless execution ceiling on the inline lane.** `/api/generate` is capped at `maxDuration = 60` and runs the graph in-request ([app/api/generate/route.ts:16-17]). Long/multi-LLM work must go to the **worker** (no request timeout, [worker/index.ts]) via a new queue + processor, not into the API route.
- **BullMQ worker must be deployed and always-on.** Every async feature (agents, metrics, replies, reports) depends on `npm run worker` running with a reachable Redis. CI uses placeholder `REDIS_URL`; nothing is proven live.
- **DB migrations are generated, not applied (0000–0024).** Any feature needing a new column/table adds to a stack that has **never been run** against a real Neon DB. New migrations should be additive + nullable to stay reversible; the first real `drizzle-kit migrate` is itself an untested step.
- **Missing tables/columns block specific features:** no `brands`/`brandId` (multi-brand), no `campaign`/`campaignId` (campaigns), no `cost`/`tokenUsage` (FinOps enforcement), no `sentiment`/`category`/`urgency` on `comment_events` (triage). These each require a migration before the feature.
- **No vector store / no embeddings / no pgvector.** Rules out any retrieval/semantic feature until a vector capability is deliberately added.
- **No LangGraph checkpointer.** Resilience is orchestrator-level idempotency only ([lib/agents/orchestrator.ts:169-188]); intra-graph re-runs start from `START`. "Re-run from step" / resumable graphs would need a checkpointer.
- **Orchestrator one-agent-per-run key.** `findCompletedStep` keys on `(runId, agent)` and assumes linear runs ([lib/agents/orchestrator.ts:166-168]); any loop/debate/multi-pass-of-same-agent feature needs a per-step key first.
- **Prompt-injection surface (notable correction).** Untrusted text reaches LLMs in three places: (1) **AI auto-replies feed raw commenter text into a prompt and post the result publicly** — `composeAiReply(...){ ... Their comment: "${vars.text}" ... }` ([worker/processors/reply.ts:120-137], gated by `rule.useAi`). This is the **highest-value injection target** and is **not** length-bounded the way web-search is. (2) Tavily snippets into ideation, but hard-capped at 400 chars ([lib/agent/tools/web-search.ts:32], [lib/agent/research.ts]). (3) User topic/voice/banned-terms into draft prompts (expected, user-owned). Any new node that ingests external text (e.g. Q6 MCP) inherits surface (1)'s risk — bound length and never let tool output dictate control instructions.
- **Secrets/keys: reuse, don't reinvent.** `ENCRYPTION_KEY` is the root; derive new domain keys via `deriveSubKey(purpose)` (HKDF) ([lib/utils/crypto.ts]). All platform OAuth secrets are optional and gate UI visibility ([lib/env.ts], [lib/oauth/registry.ts]). Never add a feature that stores tokens/PII unencrypted.
- **Third-party API limits + spend.** New per-target metrics polling, comment classification, and any added LLM hop multiply against platform read limits and LLM cost — and there is **no cost metering yet** (Q2 must precede any spend-bounded feature). Default LLM is Gemini ([lib/llm/factory.ts:16]).
- **Eval/CI gate gap.** No agent-output regression gate in CI ([.github/workflows/ci.yml]); the brand-safety eval exists but is unwired and its judge is deferred to live. Autonomy features should not expand before Q5.
- **Next.js 16 caveat (`AGENTS.md`).** The repo warns Next 16 has breaking changes vs. training data and to read `node_modules/next/dist/docs/` before writing code. Feasibility impact: route/runtime conventions (`runtime`, `maxDuration`, `dynamic`, route-handler signatures, server-action wiring) may differ from older Next — verify against the in-repo docs before adding routes/actions. I did **not** open `node_modules/next/dist/docs/` (see Self-check); existing routes already use `export const runtime = "nodejs"` / `maxDuration` ([app/api/generate/route.ts:16-17]), so the pattern in-repo is the safe template to copy.

---

## Self-check — what I could NOT verify

- **Nothing was exercised at runtime.** No DB/Redis/LLM/social creds; all verdicts are code-verified, not behavior-verified. Latency/cost/timeout estimates for new LLM hops are inferred, not measured — D1's "would blow 60 s" is a reasoned bound, not a profiled one.
- **Next.js 16 specifics not cross-checked against `node_modules/next/dist/docs/`** per `AGENTS.md`. I relied on the conventions already present in the repo's routes. Anyone implementing new routes/actions should read those docs first (breaking changes flagged).
- **I did not open every file.** Three sub-agents surveyed (a) the agent layer/graph/guardrails/MCP, (b) the full `db/schema` + migrations, and (c) env/crypto/OAuth/platforms/API-routes/billing; I directly opened the orchestrator, queue jobs/queues, worker entry, LLM factory, LangSmith, both metered routes, the reply processor, Rigel, and CI. A few server actions and some platform adapters were summarized by sub-agents rather than opened line-by-line by me.
- **LLM `usage_metadata` availability (Q2) is provider-dependent.** LangChain surfaces it for the major providers, but I did not confirm the exact field is populated for the configured Gemini path — validate before relying on it for cost math.
- **Exact migration sequencing risk** for the additive migrations proposed (Q4, M1, M3, M5) can't be assessed until `0000–0024` are applied once against real Neon; the first live migrate is itself unverified.
- **Platform read-API rate limits** (Q1 metrics, M2) are not enumerated here — they vary per platform/tier and need confirmation against each provider's current ToS before scheduling cadence.
