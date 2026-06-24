# AI-Agent Trends — Refresh, as of June 22–23, 2026

**Companion to** [`ai-agent-trends-2026-06-22.md`](./ai-agent-trends-2026-06-22.md). That doc covers the core production-agent stack (orchestration, subagents, memory, tool-use/code-mode, MCP, A2A, computer-use, tracing/evals, HITL, background agents, governance) with adversarial verification. **This refresh does three things:** (1) adds the areas that doc under-covered — **agentic workflow UI patterns**, **cost controls & usage-based packaging**, **content/creator use cases**, and **AI-content disclosure/provenance compliance**; (2) refreshes the named-vendor state (Vercel AI SDK, OpenAI AgentKit, Google Antigravity); (3) **corrects the SocialFlow gap matrix**, because the prior doc's P0/P1/P2 gaps were implemented and merged to `main` the same day (see [`AGENT_UPGRADE_PLAN.md`](../AGENT_UPGRADE_PLAN.md)).

> **Method & honesty note.** Fresh primary-source sweep (OpenAI, Anthropic, Google, Vercel, LangChain, MCP/A2A, EU/regulatory) + a re-run of the deep-research harness. **The harness's verify/synthesize phases were throttled by a session-usage limit**, so its automated "refuted" verdicts are unreliable (verifiers abstained, they did not disprove). Confidence tags below reflect **primary-source confirmation obtained directly**, not the harness vote. Secondary/blog facts are labeled. Two time-sensitive flags: the MCP `2026-07-28` RC is dated *after* this cutoff (provisional); EU AI Act Art. 50 dates are near-term and worth re-checking.

---

## 1) Trend radar

| Tier | Trends |
|---|---|
| 🟢 **Table stakes — adopt now** | Durable/idempotent orchestration · full-session tracing · **HITL approval before high-impact actions** · **MCP inward** for tools · prompt caching + basic cost controls · **AI-content disclosure/provenance** (becoming legally mandatory) |
| 🔵 **Trial — production-ready, adopt selectively** | Persistent per-tenant memory · trace-based evals / LLM-as-judge · least-privilege subagents · supervisor + parallel fan-out · **agentic UI** (Agent Inbox / generative UI / AG-UI) · background/async agents · usage/outcome-based packaging |
| 🟡 **Assess — pilot, don't depend on** | Browser/computer use · **A2A outward** · **MCP Apps** in-client UI · **A2UI** · managed-agent cloud runtimes · OpenTelemetry GenAI conventions |
| 🔴 **Hold — don't chase yet** | **OpenAI Agent Builder/Evals** (being sunset) · unsupervised auto-posting · **AP2 agent payments** for a content tool · multi-framework abstraction layers · A2A **inbound** marketplace before PMF |

---

## 2) Source-backed evidence (12 areas)

1. **Multi-agent orchestration — supervisor + handoff + parallel fan-out is the default.** [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) · [Anthropic — building agents w/ Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) (*"subagents by default … spin up multiple subagents to work on different tasks simultaneously"*, verified) · [LangGraph](https://www.langchain.com/langgraph) (MIT, free — verified). **[primary]**

2. **Memory & context persistence — two-tier, DB-backed, with compaction.** [Anthropic — context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) · [Anthropic SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) (compaction *"summarizes previous messages when the context limit approaches"*, verified) · [LangGraph memory](https://docs.langchain.com/oss/python/concepts/memory). **[primary]**

3. **Tool use / computer use / code execution / sandboxes.** [Anthropic — advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use) (Tool Search ~85% context cut) · [Anthropic — code execution w/ MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) (~98.7% reduction) · [Claude for Chrome](https://www.anthropic.com/news/claude-for-chrome) · [Google Antigravity](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/) (drives editor/terminal/**browser**; Gemini **Managed Agents** = one API call → isolated Linux env). API-first; computer-use is fallback. **[primary; computer-use reliability indicative]**

4. **HITL & guardrails — first-class, pause/resume before sensitive actions.** [OpenAI — guardrails & approvals](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals) (`needsApproval` → resumable interruption) · [LangGraph HITL](https://docs.langchain.com/oss/python/langchain/human-in-the-loop) (recommended for **external communications**) · [Vercel AI SDK 6](https://vercel.com/blog/ai-sdk-6) (`needsApproval`). **[primary]**

5. **Observability, tracing & evals — observability ahead of evals; quality is #1 blocker.** [LangChain — State of Agent Engineering](https://www.langchain.com/state-of-agent-engineering) (57% prod, 89% observability, ~52% evals) · [LangSmith evaluation](https://www.langchain.com/langsmith/evaluation) (LLM-as-judge on prod traces, Align Evals) · [OpenTelemetry GenAI](https://opentelemetry.io/blog/2026/genai-observability/) · [Anthropic SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) (*"have another language model 'judge' the output … based on fuzzy rules"*, verified 3-0). **[primary]**

6. **MCP / A2A / interoperability — two complementary standards.** MCP = agent→tools: [2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/), [MCP Apps](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/), [registry](https://registry.modelcontextprotocol.io/), [`2026-07-28` RC](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) (*post-cutoff, provisional*: stateless + Tasks). A2A = agent→agent: [v1.0, 150+ orgs, Linux Foundation](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year), [complementary to MCP](https://a2a-protocol.org/latest/topics/a2a-and-mcp/), native in Azure/Bedrock; LangGraph exposes `/a2a/{assistant_id}`. **[AP2](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)** (Agent Payments Protocol, 16 Sep 2025) extends A2A+MCP with signed **Intent/Cart Mandates** for HITL-authorized payments. **[primary; RC time-sensitive]**

7. **Background / async agents — durable execution backbone.** [LangGraph durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution) · [MCP Tasks](https://modelcontextprotocol.io/extensions/tasks/overview) · [GitHub Copilot coding agent](https://github.com/features/copilot) · Antigravity async **Manager** surface; Gemini Managed Agents. **[primary]**

8. **Agentic workflow UI patterns — NEW.** The chat box is no longer the unit of UI. (a) **Approval inbox** — [LangChain Agent Inbox](https://github.com/langchain-ai/agent-inbox): interrupts as **Accept / Edit / Respond / Ignore**, over LangGraph `interrupt`/`HumanInterrupt`; [Agent Chat UI](https://github.com/langchain-ai/agent-chat-ui). (b) **Generative UI** — agents stream typed UI, not text: [Vercel AI SDK](https://vercel.com/blog/ai-sdk-6) (`InferAgentUIMessage`, `createAgentUIStreamResponse`); [A2UI v0.9](https://developers.googleblog.com/a2ui-v0-9-generative-ui/) (framework-agnostic, 17 Apr 2026, Flutter/Lit/Angular/React, over MCP/WS/REST); MCP Apps sandboxed iframes. (c) **Chat + side canvas** w/ streamed state + provenance: [AG-UI](https://docs.ag-ui.com/introduction) (event protocol; interrupts; supported by LangGraph/CrewAI/MS Agent Framework/Google ADK; CopilotKit client); Antigravity **Artifacts** (plans/screenshots/recordings). **[primary]**

9. **Enterprise governance — identity, least-privilege, tamper-evident audit.** [Microsoft — 80% of Fortune 500 run active agents](https://www.microsoft.com/en-us/security/blog/2026/02/10/80-of-fortune-500-use-active-ai-agents-observability-governance-and-security-shape-the-new-frontier/) · [Microsoft — agent governance](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ai-agents/governance-security-across-organization). EU AI Act **Art. 14** human-oversight is a live target. **[primary/analyst]**

10. **Cost controls & usage-based packaging — NEW.** Models: usage-based, **outcome-based** ([Sierra](https://sierra.ai/blog/outcome-based-pricing-for-ai-agents)), value-based; **hybrid dominates** (~43%→61% adoption, +38% revenue growth — *secondary*). Levers: [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), batch, model routing, **customer spend limits + usage dashboards** (anti bill-shock). Token pass-through "rarely works outside developer platforms" ([metered-billing guide](https://www.buildmvpfast.com/blog/metered-billing-ai-agents-usage-based-pricing-agent-workload-2026)). **[primary for caching; pricing trend secondary]**

11. **Content/marketing/social/creator — NEW + a compliance cliff.** "Command Marketing": human sets strategy/guardrails, agent executes drafting/scheduling/comment-DM triage/optimization; market ~$2.1B (2024)→~$7.9B (2029) (*secondary*; [Zapier roundup](https://zapier.com/blog/best-ai-social-media-management/)). **Decisive new fact = disclosure law:** [EU AI Act Art. 50](https://artificialintelligenceact.eu/article/50/) machine-readable marking of synthetic audio/image/video/**text**, applies **2 Aug 2026** (GPAI grace to **2 Dec 2026**; [Code of Practice](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content) sign-by **22 Jul 2026**; fines ≤3% global revenue); **California SB 942** (eff. **1 Jan 2026**: visible label + machine-detectable watermark + free detection tool); platforms enforce via [C2PA Content Credentials + SynthID](https://www.institutepm.com/knowledge-hub/ai-content-provenance-watermarking) (TikTok since Jan 2025, **1.3B+** videos; Meta Q1 2026; LinkedIn lighter — [comparison](https://www.auditsocials.com/blog/cross-platform-ai-content-labeling-requirements-2026-meta-google-tiktok-youtube-comparison)). **[regulatory primary; market figures secondary]**

12. **Table stakes vs experimental + hype warning.** Table stakes: durable orchestration, tracing, HITL gates, MCP, disclosure/provenance. Experimental: reliable computer use, agent payments, cross-client generative UI, A2A marketplaces. **Anti-hype anchor:** [Gartner predicts >40% of agentic-AI projects canceled by end of 2027](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) (cost, unclear value, weak risk controls; "agent washing"). **[primary headline]**

**Vendor state refresh:** Vercel **AI SDK 6** GA 22 Dec 2025 ([blog](https://vercel.com/blog/ai-sdk-6)): `Agent`/`ToolLoopAgent`, generative UI, `needsApproval` HITL, DevTools, MCP, Workflow DevKit `DurableAgent`; AI SDK 5 (31 Jul 2025) added `stopWhen`/`prepareStep` + AI Gateway default. **OpenAI AgentKit** (DevDay, 6 Oct 2025: Agent Builder/ChatKit/Evals/Connector Registry) — **Agent Builder + Evals being wound down** (announced 3 Jun 2026; Evals read-only 31 Oct 2026; both gone 30 Nov 2026; [deprecations](https://developers.openai.com/api/docs/deprecations)); migrate to Agents SDK/ChatKit. **Google Antigravity** agent-first IDE (public preview; async Manager; browser control; Artifacts; model optionality Gemini 3 Pro / Claude Sonnet 4.5 / GPT-OSS) + Antigravity 2.0 & Managed Agents at I/O 2026.

---

## 3) SocialFlow implications — CORRECTED current-state matrix

The prior doc's gaps were **implemented & merged to `main`** (runtime verification deferred — no creds). Confirmed in code:

| Prior "gap" | Status | Evidence |
|---|---|---|
| HITL approval gate (Castor + threshold + queue) | ✅ Built | `lib/agents/castor/index.ts`, `app/(dashboard)/review/`, `lib/agents/capabilities.ts` |
| Brand-safety evals | ✅ Built | `lib/evals/brand-safety-metrics.ts`, `evals/brand-safety/run.ts`, `lib/agent/guardrails/brand-safety.ts` |
| Per-brand memory | ✅ Built | `db/schema/brand-profiles.ts`, `lib/repos/brand-profiles.ts` |
| Least-privilege / identity | ✅ Built | `lib/agents/capabilities.ts` |
| MCP inward | ✅ Built | `lib/mcp/client.ts`, `lib/mcp/rpc.ts` |
| A2A outward | ✅ Built | `lib/a2a/protocol.ts`, `app/api/a2a/route.ts`, `lib/a2a/agent-card.ts` |
| Supervisor / orchestration | ✅ Built | `lib/agents/orchestrator.ts` |

**Genuinely still open (this research's actionable delta):**

- 🔴 **P0 — AI-content disclosure & provenance (NEW, not built).** No C2PA/SynthID/AI-label module found. **Time-boxed** (EU AI Act Art. 50 → 2 Aug 2026; CA SB 942 live; TikTok/Meta enforce C2PA). → Embed C2PA Content Credentials + per-platform AI-label flags at publish in `Atlas`; add a per-tenant disclosure ledger; expose a "this post is AI-assisted" toggle/policy per brand.
- 🟠 **P1 — Approval-inbox UX upgrade.** Review queue exists (`app/(dashboard)/review/review-queue.tsx`); add the **Agent-Inbox action model** (Accept/Edit/Respond/Ignore), **generative per-platform previews**, and streamed `Castor`/`Lyra` reasoning.
- 🟡 **P2 — Usage/outcome packaging + cost controls.** No metering/spend-cap/prompt-caching signal. → per-tenant metering, customer spend caps, prompt caching, usage dashboard; price per "published, on-brand post."
- ℹ️ **Runtime-verify** the built features once creds exist; **don't adopt** OpenAI Agent Builder (sunsetting) — you're on LangGraph/custom.

## 4) Feature opportunity areas
- **Compliance-as-a-feature** (provenance + platform AI labels + disclosure ledger) — concrete EU/enterprise differentiator, deadline-driven.
- **"Approve-to-publish" inbox** (Agent-Inbox pattern) with generative per-platform previews — turns the existing gate into a UX selling point.
- **Outcome/usage packaging** with spend caps + usage dashboard — aligns price to value, prevents bill shock.
- **A2A campaign delegation** — let enterprise marketing-ops agents call SocialFlow (`/api/a2a` exists; productize the Agent Card + discovery).

## 5) Risk warnings
- Auto-posting to others' audiences is the textbook high-impact action every framework gates — keep the gate **on** by default for real accounts.
- **Regulatory deadline is real & near** (EU Art. 50 marking 2 Aug 2026; CA SB 942 live) — unlabeled synthetic content for EU/CA users is non-compliant.
- Framework HITL ships without notifications/timeouts/escalation/audit — you built your own layer; keep it.
- Prompt injection if browser-use ever touches logged-in brand accounts — sandbox + last-resort.
- Capability ≠ production-readiness — runtime-verify memory/durability with DB-backed stores.
- Cost runaway from loops + growing tool surfaces — instrument caching, caps, per-tenant metering early.
- [Gartner: >40% of agentic projects canceled by 2027](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) — ship narrow, governed value, not autonomy theater.

## 6) What NOT to chase yet
- **OpenAI Agent Builder/Evals** — sunsetting 30 Nov 2026; never adopt.
- **Computer/browser use for core publishing** — APIs first; browser sandboxed fallback only.
- **AP2 agent payments** — revisit only if you add shoppable/commerce flows.
- **Cross-client MCP Apps / A2UI portability** — immature/post-cutoff; pilot, don't depend.
- **Multi-framework abstraction layers** and **A2A inbound marketplace** — premature before PMF.
- **Fully autonomous, unsupervised posting** — market converged on "Command Marketing" *with* an oversight gate.

---

*Compiled 2026-06-23 as a refresh of the 2026-06-22 run. Primary sources prioritized; secondary labeled; harness verification was throttled (see method note) so confidence reflects direct primary checks.*
