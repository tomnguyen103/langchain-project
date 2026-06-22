# AI-Agent Trends — as of June 22, 2026

**Cited trend cards for SocialFlow** (AI social-content automation: drafting, scheduling, multi-platform publishing, brand-safety/guardrails, analytics).

> Research method: a 6-angle deep-research fan-out (31 sources fetched, 153 claims extracted, 25 adversarially verified by 3-vote panels, 23 confirmed / 2 refuted) **plus** an independent primary-source sweep (Anthropic, OpenAI, Google, LangChain/LangGraph, MCP/A2A, GitHub, Microsoft/Forrester). Every card leads with a primary source where one exists; secondary-only facts are labeled. Confidence and time-sensitivity are flagged per card. Two refuted claims are listed at the end — do not rely on them.

---

## Executive summary — the agent stack has converged

As of June 2026 the industry has settled on a recognizable **production agent stack**, and most of its layers are now first-class vendor features rather than custom plumbing:

- **Orchestration primitives are standardized.** OpenAI's Agents SDK (Agents / Handoffs / Guardrails / Sessions / Tracing) and LangGraph (durable execution, two-tier memory, native human-in-the-loop) are the reference shapes; Anthropic ships context-isolated **subagents** with least-privilege tool allowlists; Google's ADK + Gemini Enterprise Agent Platform target the same patterns.
- **Two interop standards reached maturity and are explicitly complementary:** **MCP** (agent → tools/data) and **A2A** (agent → agent, v1.0, 150+ orgs, native in Azure/Bedrock/Copilot Studio).
- **Context engineering + memory** became a discipline: just-in-time context, compaction, and persistent file-based memory tools.
- **Tool use got cheaper and bigger** via code-mode / programmatic tool calling and on-demand tool search (37–98.7% token reductions reported by Anthropic).
- **Observability is ahead of evals** in adoption (89% vs 52%), and **quality is the #1 production blocker** — so human-in-the-loop approvals and trace-based evals are now standard practice in regulated/brand-sensitive deployments.
- **Background/async agents** (task → result while you're away) went mainstream, raising the governance bar: identity, audit, and least-privilege for non-human actors.

**The one-line takeaway for SocialFlow:** your `Orion` orchestrator + `Lyra` LangGraph pipeline already sit on the winning architecture (durable, idempotent handoffs on BullMQ/Postgres, LangSmith tracing). The gaps the market now treats as table-stakes are exactly the three you don't have yet: **(1) a human approval gate + output guardrail before publishing to real brand accounts, (2) trace-based brand-safety evals, and (3) persistent per-brand memory** — plus two strategic adds, **MCP inward** and **A2A outward**.

---

## Trend cards

### 1. Multi-agent orchestration: supervisor + handoff + fan-out are now the default shapes
**What's happening.** The OpenAI Agents SDK ships five standardized primitives — **Agents, Handoffs (delegation / agents-as-tools), Guardrails, Sessions, Tracing** — is provider-agnostic (OpenAI Responses/Chat + 100+ other LLMs via adapters), and treats MCP as a first-class tool type. LangGraph is the dominant low-level runtime for stateful multi-agent graphs (supervisor and swarm patterns). Anthropic's pattern is a **lead agent that plans and delegates to specialist subagents, then synthesizes** (fan-out/fan-in). Google's **ADK** (Python/TS/Go/Java, 7M+ Python downloads) natively composes multi-agent teams under the rebranded **Gemini Enterprise Agent Platform** (Cloud Next 2026).
**Primary sources.** [OpenAI Agents SDK (GitHub)](https://github.com/openai/openai-agents-python) · [Anthropic — multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) · [LangGraph (GitHub, v1.2.6 Jun 18 2026)](https://github.com/langchain-ai/langgraph) · [Google ADK docs](https://google.github.io/adk-docs/) · [Google — Gemini Enterprise Agent Platform](https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-agent-platform)
**Confidence.** High (3-0 verified on OpenAI/LangGraph/Anthropic primitives).
**Why it matters for SocialFlow.** `Orion` is already a multi-agent orchestrator, but it's a **strictly linear handoff chain** (Vega→Lyra→Atlas→Sirius, plus standalone Rigel/Polaris). The market has moved to (a) a **supervisor** that can route dynamically and retry/redirect, and (b) **parallel fan-out** for independent work. Concretely: draft all platform variants in parallel subagents and synthesize the best set, and let a supervisor decide whether to loop Lyra again or escalate — instead of one fixed pipeline. Your handoff contract (`agent_steps.handoff`) is the right foundation to evolve toward this without a rewrite.

---

### 2. Subagents & context isolation = a built-in least-privilege guardrail
**What's happening.** Anthropic's Claude Agent SDK / Claude Code make **subagents** a shipping primitive: each runs in **its own isolated context window** with a custom system prompt, **specific tool access, and independent permissions**, and returns only a distilled **1,000–2,000-token summary** to the orchestrator. Tool access is locked down with an **allowlist (`tools`) or denylist (`disallowedTools`)** — e.g. a reviewer restricted to Read/Grep so it can't write files or call MCP tools. The agent loop is **gather context → take action → verify work**, with automatic **compaction** near the context limit.
**Primary sources.** [Anthropic — Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents) · [Anthropic — Building agents with the Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk) · [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
**Confidence.** High (3-0 verified verbatim against primary docs, June 2026).
**Why it matters for SocialFlow.** This is a ready-made security model for your roster. Today nothing stops any agent from doing anything. Apply least-privilege: a **brand-safety/compliance subagent gets read-only tools and cannot publish**, while **only `Atlas` holds write access to the social APIs**. Isolated contexts also mean the publishing agent never sees (and can't leak) credentials or another step's reasoning — directly relevant when one Meta login fans out to many tenants' FB Pages + IG accounts.

---

### 3. Agent memory & state: persistent, two-tier memory is now a product feature
**What's happening.** Memory moved from DIY to vendor-supported. **Anthropic's memory tool** lets Claude write context to files for **learning across sessions**, with client-controlled storage and per-write audit/versioning; **Memory for Claude Managed Agents** is in public beta (header `managed-agents-2026-04-01`), alongside **multi-agent sessions** and **Outcomes**. **LangGraph** formalizes **two-tier memory** — short-term thread-scoped checkpoints + **long-term cross-thread `Store`**. The OpenAI Agents SDK adds **Sessions** (automatic conversation history). Anthropic's context-engineering guidance pushes **just-in-time loading** (lightweight identifiers, load on demand) and **compaction** to fight "context rot."
**Primary sources.** [Anthropic — Managed Agents](https://www.anthropic.com/engineering/managed-agents) · [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) · [LangGraph — memory concepts](https://docs.langchain.com/oss/python/concepts/memory) · [LangGraph — persistence](https://docs.langchain.com/oss/python/langgraph/persistence) · [OpenAI Agents SDK — Sessions](https://github.com/openai/openai-agents-python)
**Confidence.** High for LangGraph two-tier + Anthropic memory tool/managed-agents beta (primary-verified). *Note: a related "Dreaming"/async-consolidation claim circulated only in secondary blogs and could not be confirmed against a primary source — excluded here.*
**Why it matters for SocialFlow.** You have **no long-term memory** — every `Lyra` run starts cold from `topic + platforms`. Per-brand **voice, banned terms, do/don't lists, best-performing formats, and campaign history** are exactly long-term-memory data, and **`Rigel`'s analytics should feed back into it** so drafting improves over time. Caveat the market learned the hard way: long-term memory needs a **DB-backed store** in production (you already have Neon/Drizzle — add a `brand_memory` store rather than an in-memory default).

---

### 4. Tool use: code-mode / programmatic tool calling slashes token cost as the tool surface grows
**What's happening.** Anthropic shipped **advanced tool use** (Nov 2025): **Programmatic Tool Calling** (Claude writes Python that orchestrates tools in a sandbox; results don't all re-enter context) cut tokens **43,588 → 27,297 (~37%)** on complex research with accuracy up (GIA 46.5%→51.2%); **Tool Search** (load tool defs on demand) gives an **~85% context reduction** and lifted Opus 4.5 from **79.5%→88.1%**; **Tool Use Examples** raised parameter-handling accuracy **72%→90%**. **Code execution with MCP** ("code mode") reported a **150,000 → 2,000 token (98.7%)** reduction on a Drive→Salesforce workflow by exposing MCP servers as code APIs with progressive disclosure.
**Primary sources.** [Anthropic — Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use) · [Anthropic — Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
**Confidence.** High (numbers quoted from primary engineering posts).
**Why it matters for SocialFlow.** Right now tool use is minimal — `Vega` calls **Tavily** directly and there's no structured tool-calling layer. As you add tools (8 platform publishers, analytics pulls, ImageKit transforms, research), loading every tool definition into every prompt bloats cost and degrades accuracy. Adopting **tool search / code-mode** keeps context lean and lets `Lyra`/`Vega` scale to dozens of tools cheaply — and **code execution keeps intermediate data (e.g. raw analytics, tokens) out of the model's context** by default, a privacy win for a multi-tenant SaaS.

---

### 5. MCP: the tool/data interop standard is maturing fast (stateless core, async Tasks, interactive UI)
**What's happening.** The MCP **2026 roadmap** prioritizes **transport/scalability** (stateless HTTP, `.well-known` server discovery), the **Tasks** primitive for long-running ops, governance, and **enterprise readiness** (audit trails, SSO auth, gateways). The **2026-07-28 release candidate** makes the protocol **stateless** (removes the init handshake + `Mcp-Session-Id` so any request hits any instance), formalizes **Tasks** (`tasks/get|update|cancel`), and hardens auth (clients must validate the `iss` parameter per RFC 9207). Separately, **MCP Apps** (launched **Jan 26 2026**, the first official extension, co-developed by Anthropic + OpenAI + MCP-UI) lets tools return **interactive UI** (forms, dashboards, multi-step flows) rendered in sandboxed iframes. The registry has grown to ~10k public servers.
**Primary sources.** [MCP — 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) · [MCP — 2026-07-28 release candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) · [MCP — Tasks extension](https://modelcontextprotocol.io/extensions/tasks/overview) · [MCP Apps](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
**Confidence.** High on direction; ⏱ **time-sensitive** — the 2026-07-28 RC is dated ~5 weeks *after* this report's cutoff and is a **release candidate**, so exact method/header/normative wording may change. Treat API shapes as provisional.
**Why it matters for SocialFlow.** You have **no MCP** today. Adopting **MCP inward** turns each social-platform/analytics/asset integration into a standard, swappable connector instead of bespoke adapters. The **Tasks** primitive is the natural fit for the slow operations you already run (delayed publish, video render, large analytics pulls): kick off → poll → cancel a bad post in flight — and **statelessness** means MCP connectors scale horizontally behind your worker fleet with no sticky sessions. **MCP Apps** is a distribution play: render an in-chat **post composer / approval form / analytics dashboard** natively inside Claude, ChatGPT, Slack, or VS Code — reaching users where they already are.

---

### 6. A2A: agent-to-agent interoperability hit v1.0 and went enterprise
**What's happening.** **Agent2Agent (A2A)** reached **v1.0** (first stable spec) with **150+ supporting organizations** (up from ~50), including AWS, Cisco, Google, IBM, Microsoft, Salesforce, SAP, ServiceNow, under **Linux Foundation** governance. It's **natively integrated** into Microsoft **Azure AI Foundry** + **Copilot Studio** and **AWS Bedrock AgentCore Runtime**, and is **explicitly complementary to MCP** (A2A = agents talking to agents across org boundaries; MCP = agents talking to tools/data). **LangSmith/LangGraph** expose every assistant over A2A at **`/a2a/{assistant_id}`** (needs `langgraph-api >= 0.4.21`) with JSON-RPC methods `message/send`, `message/stream` (SSE), `tasks/get`.
**Primary sources.** [Linux Foundation — A2A surpasses 150 orgs](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year) · [A2A v1.0](https://a2a-protocol.org/latest/announcing-1.0/) · [A2A & MCP complementarity](https://a2a-protocol.org/latest/topics/a2a-and-mcp/) · [AWS Bedrock AgentCore — A2A](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-a2a.html) · [LangSmith — Agent Server A2A](https://docs.langchain.com/langsmith/server-a2a)
**Confidence.** High (3-0 verified against neutral standards body + vendor primary docs).
**Why it matters for SocialFlow.** A2A is your **enterprise ecosystem story**. Because you're already on the LangChain/LangGraph stack, a **version bump exposes each assistant at `/a2a/{assistant_id}` with a discoverable Agent Card** — letting an enterprise customer's marketing-ops agent **delegate "draft and schedule this campaign" to SocialFlow** with no bespoke integration. Mental model: **MCP inward** (connect your agents to tools), **A2A outward** (let other orgs' agents call yours). `message/stream` gives responsive live drafting; `tasks/get` pairs with your long-running publish/render jobs.

---

### 7. Browser/computer use: consolidating, with an API-first pivot
**What's happening.** The standalone "computer-use" products are **consolidating**: Google **shut down Project Mariner (May 4 2026)**; OpenAI's **Operator was folded into ChatGPT Agent**; Anthropic ships **Claude for Chrome** plus dedicated **prompt-injection defenses**. Capability is rising but still unreliable — **Claude Computer Use reportedly ~44% on OSWorld, up from ~14% in 2024**. The net industry signal is **"prefer APIs; use computer/browser control as a fallback,"** with security (prompt injection on live pages) a first-class concern.
**Sources.** Primary: [Anthropic — Claude for Chrome](https://www.anthropic.com/news/claude-for-chrome) · [Anthropic — prompt-injection defenses](https://www.anthropic.com/research/prompt-injection-defenses) · [OpenAI — ChatGPT Agent](https://openai.com/index/introducing-chatgpt-agent/). Secondary (benchmarks/shutdown dates): OSWorld round-ups and Project Mariner shutdown coverage.
**Confidence.** Medium — direction is clear from primary sources, but specific benchmark numbers/shutdown dates are secondary-sourced and **did not survive the deep-research verifier** (flagged as an open question), so treat the figures as indicative.
**Why it matters for SocialFlow.** Validates your current design: you publish via **platform APIs** (Meta Graph, LinkedIn, TikTok, etc.), which is the reliable path. Where a platform lacks a good API (or gates analytics behind the UI), a **browser-use fallback** is tempting — but at ~44% reliability and with prompt-injection exposure on logged-in brand accounts, keep it **last-resort, sandboxed, and behind human approval**. Don't bet core publishing on computer use.

---

### 8. Tracing & evals: observability is ahead of evals — and quality is the #1 blocker
**What's happening.** LangChain's **State of Agent Engineering** (n=1,340, Nov–Dec 2025): **57.3% have agents in production**; **89% have some observability** (94% among production agents) but only **52.4% run offline evals / 37.3% online**; **quality is the top production blocker (33%)**, ahead of latency (20%). Eval practice mixes **human review (59.8%)** and **LLM-as-judge (53.3%)**. **LangSmith** traces every step + full multi-turn conversations and runs **LLM-as-judge / code / multi-turn evals on real production traces**, including **"Align Evals"** to calibrate judges to human preferences. Agent failures live in **multi-step causal chains**, so full-session traces (not per-call logs) are required; OpenTelemetry is the emerging vendor-neutral baseline.
**Primary sources.** [LangChain — State of Agent Engineering](https://www.langchain.com/state-of-agent-engineering) · [LangSmith platform](https://www.langchain.com/langsmith-platform) · [LangSmith — evaluation](https://www.langchain.com/langsmith/evaluation) · [LangChain — agent observability](https://www.langchain.com/resources/agent-observability)
**Confidence.** High (survey + vendor primary; some vendor marketing absolutism noted).
**Why it matters for SocialFlow.** You're in the **89% with tracing** (LangSmith run deep-links, `runId` correlation onto `generated_content`) but in the **~48% with no evals** — and "quality" is precisely the brand-safety risk of auto-publishing. Add **trace-based evals**: score live drafts for **brand-voice adherence, banned-term/policy violations, and platform-fit**, using an **LLM-as-judge calibrated to the brand team's standards (Align Evals)** plus periodic human review. This is how you prove brand safety at scale and catch off-brand posts *before* `Atlas` schedules them.

---

### 9. Guardrails & human-in-the-loop approvals: now standard before high-impact actions
**What's happening.** Both major SDKs ship guardrails + approvals as first-class. **OpenAI Agents SDK**: **input / output / tool guardrails** plus **approvals** — the model proposes an action and the run **pauses, returns an interruption + resumable state**, and your app approves/rejects and **resumes the same run**. **LangChain/LangGraph**: `interrupt()` HITL with **checkpointing (pause → inspect → resume)** and **human-approval middleware** explicitly recommended for **financial transactions, deleting/modifying production data, and external communications**. HITL before sensitive actions is now standard practice in regulated/brand-sensitive deployments.
**Primary sources.** [OpenAI — guardrails & approvals](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals) · [OpenAI Agents SDK — guardrails](https://openai.github.io/openai-agents-python/guardrails/) · [LangGraph — human-in-the-loop](https://docs.langchain.com/oss/python/langchain/human-in-the-loop) · [LangGraph — interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
**Confidence.** High (3-0 verified against primary docs).
**Why it matters for SocialFlow — highest-priority gap.** Your autonomous path has **no approval gate and no output guardrail**: `Lyra` **auto-accepts** all generated content and `Atlas` **schedules it to real brand accounts without review**. "Posting to an external party's audience" is the textbook high-impact action these frameworks gate. Add an **approval interrupt + output guardrail between `Lyra` and `Atlas`** (auto-publish only above a confidence/brand-safety threshold; otherwise queue for human approval in the dashboard). Your idempotent, replay-safe `agent_steps` design makes a pause/resume gate natural to add. **Caveat the market flags:** framework HITL ships *without* built-in notifications, timeouts, escalation, or audit logging — you must build that layer (you already have BullMQ + an `agent_steps` audit trail to build on).

---

### 10. Background / async agents went mainstream — durable execution is the backbone
**What's happening.** "Assign a task, get a result later" agents are now a category: **Claude Code Remote Tasks** (Mar 20 2026), **GitHub Copilot coding agent** (issue → PR, assigned like a teammate), **OpenAI Codex** (app + cloud + CLI + IDE), **Devin**, Cursor/Jules background agents. The enabling tech is **durable execution** — LangGraph persists state per super-step and **auto-resumes from the last checkpoint after a crash**; **MCP Tasks** standardizes long-running calls. Async wins when a task runs minutes-to-hours and doesn't need mid-edit course-correction.
**Primary sources.** [LangGraph — durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution) · [GitHub Copilot](https://github.com/features/copilot) · [GitHub Docs — OpenAI Codex](https://docs.github.com/en/copilot/concepts/agents/openai-codex) · [MCP — Tasks](https://modelcontextprotocol.io/extensions/tasks/overview)
**Confidence.** High on durable-execution + Tasks (primary-verified); background-product roster partly secondary.
**Why it matters for SocialFlow.** Your **always-on BullMQ worker is already a background-agent platform** — durable, idempotent handoffs that survive restarts (`Orion` re-delivers a completed step's handoff without re-running). You're **ahead** here. Align with the patterns: keep state in a **DB-backed checkpointer**, model slow publish/render as **Tasks** (poll/cancel), and — crucially — pair autonomy with the **approval gate from card 9** so "background" never means "unsupervised posting." Note the scaling caveat: OSS LangGraph has no built-in supervisor/distributed coordination, so for thousands of concurrent tenant jobs your **BullMQ fleet (or managed LangGraph Platform / Temporal)** remains the orchestration backbone.

---

### 11. Enterprise governance: agent identity, audit, and least-privilege are the new buyer requirements
**What's happening.** Adoption is outpacing control: **~80% of Fortune 500 use active AI agents** (Microsoft, Feb 2026) while **~29% of employees use unsanctioned ("shadow") agents**. The emerging consensus: **every agent must have a verifiable identity** (no anonymous actors), **least-privilege access** enforced like human/service identities, **purpose-built observability** (prompts, decisions, tool calls, outputs as first-class signals), and **tamper-evident audit logs**. Frameworks are forming — Forrester's **AEGIS**, Microsoft's governance guidance + **Agent 365**, Google's **Gemini Enterprise Agent Platform**. Standards reinforce it: MCP's **`iss`/RFC 9207** auth hardening; **EU AI Act Article 14** "human oversight" is a live compliance target that current framework HITL does **not** satisfy out-of-the-box.
**Primary sources.** [Microsoft — 80% of Fortune 500 use active AI agents](https://www.microsoft.com/en-us/security/blog/2026/02/10/80-of-fortune-500-use-active-ai-agents-observability-governance-and-security-shape-the-new-frontier/) · [Microsoft — agent governance & security](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ai-agents/governance-security-across-organization) · [Forrester — AEGIS framework](https://www.forrester.com/technology/aegis-framework/) · [Google — Gemini Enterprise Agent Platform](https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-agent-platform)
**Confidence.** High on the trend; some adoption stats are vendor/analyst-sourced.
**Why it matters for SocialFlow.** To sell to enterprise brands you'll need: **per-agent identity** (attribute each `Orion` roster member + tie to a tenant), **least-privilege tool scoping** (card 2), a **tamper-evident audit trail** (you already persist `agent_runs`/`agent_steps` — harden it to be append-only/signed), **human-oversight conformance** (the approval gate, card 9), and **OAuth issuer validation** on connected social accounts to resist token mix-up attacks. Your existing `agent_steps` lineage + LangSmith `runId` correlation is a strong head start most competitors lack.

---

## Do NOT rely on these (refuted in verification)

- **"MCP Apps gives write-once cross-client UI portability with zero client-specific code."** ❌ Refuted (1-2). Cross-client portability is **not** guaranteed — plan per-client testing/fallbacks for Claude vs ChatGPT vs Slack vs VS Code. [src](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
- **"The MCP 2026-07-28 RC aligns auth to OAuth 2.1."** ❌ Refuted (1-2). The RC references **OAuth 2.0**, not 2.1. [src](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)
- **"Anthropic 'Dreaming' async memory consolidation."** ⚠️ Unconfirmed — appeared only in secondary blogs; no primary Anthropic source found. Excluded from claims above.

## Time-sensitivity & confidence notes
- ⏱ **MCP 2026-07-28 RC** (card 5) is dated ~5 weeks *after* the June 22 2026 cutoff and is a **release candidate** — the *direction* (stateless, Tasks, `iss` auth) was real by June (Tasks shipped experimentally in the 2025-11-25 spec; auth SEPs merged May 2026), but exact API shapes are provisional.
- **Capability ≠ production-readiness** (recurring): durable execution needs a configured DB-backed checkpointer; long-term memory needs a DB-backed Store (in-memory defaults are dev-only); framework HITL lacks built-in notifications/timeouts/escalation/audit — build those layers yourself.
- **Browser/computer-use** figures (card 7) are secondary-sourced and did not survive the deep-research verifier; treat as indicative.

---

## What this means for SocialFlow — gap matrix & prioritized moves

| Trend | SocialFlow today | Gap | Priority |
|---|---|---|---|
| Approvals / HITL (card 9) | `Lyra` auto-accepts, `Atlas` auto-schedules to brand accounts | **No approval gate / output guardrail before publish** | 🔴 P0 |
| Tracing → **evals** (card 8) | LangSmith tracing + `runId` correlation | **No evals** for brand-voice/banned-terms/policy | 🔴 P0 |
| Memory (card 3) | Postgres/queue step state only | **No long-term per-brand memory**; runs start cold | 🟠 P1 |
| Least-privilege subagents (card 2) | All agents effectively unrestricted | No per-agent tool allowlist / identity | 🟠 P1 |
| Orchestration shape (card 1) | Linear handoff chain | No supervisor / parallel fan-out | 🟡 P2 |
| MCP inward (card 5) | Bespoke connectors, Tavily-only tools | No MCP; tool surface will bloat context | 🟡 P2 |
| A2A outward (card 6) | None | Not callable by enterprise customer agents | 🟡 P2 |
| Tool-use efficiency (card 4) | Direct calls, few tools | Will get expensive as tools grow | 🟢 P3 |
| Background durability (card 10) | BullMQ idempotent handoffs ✅ | Mostly there; add Tasks semantics + approval | ✅ strength |
| Enterprise governance (card 11) | `agent_steps` lineage ✅ | Harden to signed/append-only; add identity | 🟠 P1 |

**Suggested sequence (smallest blast radius first):**
1. **P0 — Approval gate + output guardrail** between `Lyra` and `Atlas` (interrupt/resume on your existing `agent_steps`; auto-publish only above a brand-safety threshold). Pairs with a dashboard approval queue.
2. **P0 — Brand-safety evals** in LangSmith on live `generated_content` traces (LLM-as-judge calibrated to the brand team via Align Evals + spot human review).
3. **P1 — Long-term `brand_memory` store** (Neon/Drizzle) feeding `Lyra` voice/banned-terms and `Rigel` analytics back into drafting.
4. **P1 — Least-privilege + identity** per roster agent; harden `agent_steps` audit to append-only/signed.
5. **P2 — Supervisor + parallel per-platform drafting**; then **MCP inward** for connectors and **A2A outward** (`/a2a/{assistant_id}`) for enterprise distribution.

---

*Compiled 2026-06-22. Primary sources prioritized; secondary clearly labeled. Claims marked "3-0 verified" passed independent 3-vote adversarial verification in the deep-research run.*
