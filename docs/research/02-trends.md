# T2 Trend Research

Date checked: 2026-06-26. Primary-source web research was used for current AI-agent trends. When a source is living documentation without a visible publication date, the date below is "accessed 2026-06-26."

Scope: trend cards tied to this repo's product and architecture. This is not a generic chatbot trend list.

## Source Set

- OpenAI, "Introducing workspace agents in ChatGPT," published 2026-04-22. URL: https://openai.com/index/introducing-workspace-agents-in-chatgpt/
- OpenAI, "Built-in tools" platform docs, accessed 2026-06-26. URL: https://developers.openai.com/api/docs/guides/tools
- OpenAI, "Speeding up agentic workflows with WebSockets," published 2026-06-16. URL: https://openai.com/index/speeding-up-agentic-workflows-with-websockets/
- Anthropic, "Claude Code: Best practices for agentic coding," published 2025-04-18. URL: https://www.anthropic.com/engineering/claude-code-best-practices
- Anthropic, "Agent Skills overview," docs, accessed 2026-06-26. URL: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Anthropic, "Computer use," docs, accessed 2026-06-26. URL: https://docs.anthropic.com/en/docs/build-with-claude/computer-use
- Anthropic, "Code execution with MCP," published 2025-11-25. URL: https://www.anthropic.com/engineering/code-execution-with-mcp
- Google Developers Blog, "Agent Development Kit: Making it easy to build multi-agent applications," published 2025-04-09. URL: https://developers.googleblog.com/en/agent-development-kit-easy-to-build-multi-agent-applications/
- Google Developers Blog, "How to build a cross-language multi-agent team using the Agent Development Kit and Agent2Agent protocol," published 2026-06-22. URL: https://developers.googleblog.com/build-cross-language-multi-agent-team-with-google-agent-development-kit-and-a2a/
- Google Developers Blog, "Agent2Agent: The Foundation for Collaborative Multi-agent Systems," published 2025-12-17. URL: https://developers.googleblog.com/agent2agent-the-foundation-for-collaborative-multi-agent-systems/
- LangChain/LangGraph docs, "LangGraph overview," accessed 2026-06-26. URL: https://docs.langchain.com/oss/javascript/langgraph/overview
- LangGraph docs, "Human-in-the-loop," accessed 2026-06-26. URL: https://docs.langchain.com/oss/javascript/langgraph/human-in-the-loop
- Vercel, "AI SDK 7," published 2026-06-25. URL: https://vercel.com/blog/ai-sdk-7
- GitHub Blog, "What's new with GitHub Copilot coding agent," published 2026-02-26. URL: https://github.blog/ai-and-ml/github-copilot/whats-new-with-github-copilot-coding-agent/
- GitHub Docs, "Extending Copilot Coding Agent with the Model Context Protocol," accessed 2026-06-26. URL: https://docs.github.com/en/enterprise-cloud@latest/copilot/customizing-copilot/extending-copilot-coding-agent-with-mcp
- GitHub Docs, "About custom agents," accessed 2026-06-26. URL: https://docs.github.com/copilot/customizing-copilot/customizing-or-creating-agents/about-custom-agents

## Trend Cards

### 1. Agent products are shifting from chat surfaces to delegated background work

Current signal:

- OpenAI's workspace-agent launch frames agents as delegatable workers for files, data connections, memories, saved context, deep research, image generation, and recurring scheduled runs. Source: OpenAI, 2026-04-22, https://openai.com/index/introducing-workspace-agents-in-chatgpt/
- GitHub positions Copilot coding agent as a background agent for issues, automated code review findings, and pull-request work, with the user assigning work and the agent returning a branch/PR. Source: GitHub, 2026-02-26, https://github.blog/ai-and-ml/github-copilot/whats-new-with-github-copilot-coding-agent/

Tie to SocialFlow:

- SocialFlow already has a background worker architecture and queued agent steps (`lib/queue/queues.ts:5`, `lib/queue/queues.ts:11`, `worker/index.ts:71`, `worker/processors/agent-step.ts:24`).
- The product's best-fit trend is not "add chat"; it is delegated content operations: research, draft, review, schedule, publish, monitor, and recover without requiring the user to drive every step.

Repo implication:

- Prioritize features that turn existing queues, run inspector, review queue, and dashboards into reliable delegated work loops. Avoid generic chat interfaces unless they control a concrete SocialFlow workflow.

### 2. Multi-agent orchestration is becoming explicit, typed, and inspectable

Current signal:

- Google's Agent Development Kit is presented as a framework for multi-agent systems, and Google's June 2026 ADK/A2A example shows cross-language agent teams communicating through Agent2Agent. Sources: Google, 2025-04-09, https://developers.googleblog.com/en/agent-development-kit-easy-to-build-multi-agent-applications/ and Google, 2026-06-22, https://developers.googleblog.com/build-cross-language-multi-agent-team-with-google-agent-development-kit-and-a2a/
- Google describes Agent2Agent as a protocol foundation for collaborative multi-agent systems. Source: Google, 2025-12-17, https://developers.googleblog.com/agent2agent-the-foundation-for-collaborative-multi-agent-systems/
- LangGraph emphasizes low-level orchestration for long-running stateful agents. Source: LangGraph docs, accessed 2026-06-26, https://docs.langchain.com/oss/javascript/langgraph/overview

Tie to SocialFlow:

- SocialFlow has named agents and a sequential orchestrator with recorded steps, handoffs, pause, resume, supervisor overrides, and a tamper-evident timeline (`lib/agents/types.ts:16`, `lib/agents/orchestrator.ts:94`, `lib/agents/orchestrator.ts:121`, `lib/agents/orchestrator.ts:159`, `lib/repos/agent-runs.ts:99`, `app/(dashboard)/runs/[runId]/page.tsx:73`).
- This is already aligned with the trend, but its orchestration is mostly internal. A2A is present and disabled by default (`app/api/a2a/route.ts:46`, `lib/a2a/agent-card.ts:10`).

Repo implication:

- New agent work should preserve the existing inspectable handoff model and route through `agent_runs`/`agent_steps`. External A2A expansion should stay gated until tenant auth, approval, and audit requirements are hardened.

### 3. Human approval is moving from an afterthought to a first-class agent primitive

Current signal:

- LangGraph documents interrupt-based human-in-the-loop behavior for pausing execution, reviewing state, and resuming. Source: LangGraph docs, accessed 2026-06-26, https://docs.langchain.com/oss/javascript/langgraph/human-in-the-loop
- Vercel AI SDK 7 highlights tool approvals and resumable streams as agent UX primitives. Source: Vercel, 2026-06-25, https://vercel.com/blog/ai-sdk-7
- GitHub's coding-agent pattern is PR-centered: autonomous work is reviewed through normal GitHub review/checks rather than silently merged. Source: GitHub, 2026-02-26, https://github.blog/ai-and-ml/github-copilot/whats-new-with-github-copilot-coding-agent/

Tie to SocialFlow:

- SocialFlow has human approval for held drafts and plans (`lib/agents/castor/index.ts:149`, `app/(dashboard)/review/actions.ts:169`, `app/(dashboard)/plans/[id]/actions.ts:11`).
- The existing review queue can accept, edit, respond, ignore, reject, approve all, or reject all (`app/(dashboard)/review/review-queue.tsx:166`, `app/(dashboard)/review/review-queue.tsx:178`, `app/(dashboard)/review/review-queue.tsx:190`, `app/(dashboard)/review/review-queue.tsx:202`, `app/(dashboard)/review/review-queue.tsx:241`, `app/(dashboard)/review/review-queue.tsx:279`).

Repo implication:

- Approval should expand horizontally across high-risk actions: external tool calls, auto-replies, risky publish retries, seeding interactions, and client-facing approval. Keep "approval as workflow state," not just a modal.

### 4. MCP is becoming the standard connector layer for agents

Current signal:

- OpenAI's built-in tool docs include remote MCP as a tool category in the Responses API. Source: OpenAI docs, accessed 2026-06-26, https://developers.openai.com/api/docs/guides/tools
- Anthropic's code-execution-with-MCP article frames MCP as a way for Claude apps to use local or remote tools and ship code execution behind a connector boundary. Source: Anthropic, 2025-11-25, https://www.anthropic.com/engineering/code-execution-with-mcp
- GitHub documents extending Copilot coding agent with MCP servers for repository-specific tools. Source: GitHub docs, accessed 2026-06-26, https://docs.github.com/en/enterprise-cloud@latest/copilot/customizing-copilot/extending-copilot-coding-agent-with-mcp

Tie to SocialFlow:

- SocialFlow has an MCP client, but not a SocialFlow MCP server (`lib/mcp/client.ts:5`, `lib/mcp/client.ts:22`, `lib/mcp/client.ts:50`).
- The app's internal capabilities already map to tools: generate, research, schedule, list accounts, fetch metrics, retry failed targets, and review held drafts.

Repo implication:

- MCP is a serious integration trend for this product, but the first safe version should expose narrow tenant-scoped SocialFlow tools, not broad arbitrary tool execution.

### 5. Agent2Agent is the emerging cross-agent protocol, but product value depends on trust boundaries

Current signal:

- Google A2A is explicitly about collaboration among agents across languages and providers. Sources: Google, 2025-12-17, https://developers.googleblog.com/agent2agent-the-foundation-for-collaborative-multi-agent-systems/ and Google, 2026-06-22, https://developers.googleblog.com/build-cross-language-multi-agent-team-with-google-agent-development-kit-and-a2a/

Tie to SocialFlow:

- SocialFlow already has A2A routes for agent card, message/send, tasks/get, and task streaming, and maps `awaiting_approval` to input-required (`app/api/a2a/route.ts:82`, `app/api/a2a/route.ts:90`, `app/api/a2a/route.ts:119`, `lib/a2a/protocol.ts:1`, `lib/a2a/protocol.ts:38`).
- The master plan itself flags A2A as default-disabled and "hold pre-PMF" (`docs/MASTER_PLAN.md:305`, `docs/MASTER_PLAN.md:306`, `docs/MASTER_PLAN.md:307`, `docs/MASTER_PLAN.md:308`).

Repo implication:

- A2A is trend-aligned but not necessarily a near-term user-value bet. Treat as an enterprise/integration track after core user-facing automations prove demand.

### 6. Memory is splitting into operational state, long-term learned preferences, and portable procedural skills

Current signal:

- OpenAI workspace agents can use saved memories and saved context. Source: OpenAI, 2026-04-22, https://openai.com/index/introducing-workspace-agents-in-chatgpt/
- Anthropic Agent Skills are documented as folders of instructions, scripts, and resources that agents can load for task-specific behavior. Source: Anthropic docs, accessed 2026-06-26, https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- LangGraph emphasizes persistence, long-running workflows, and memory as part of agent state. Source: LangGraph docs, accessed 2026-06-26, https://docs.langchain.com/oss/javascript/langgraph/overview

Tie to SocialFlow:

- SocialFlow stores brand voice, banned terms, learned memory, disclosure policy, policy rules, and voice history on `brand_profiles` (`db/schema/brand-profiles.ts:32`, `db/schema/brand-profiles.ts:36`, `db/schema/brand-profiles.ts:37`, `db/schema/brand-profiles.ts:40`, `db/schema/brand-profiles.ts:42`, `db/schema/brand-profiles.ts:43`, `db/schema/brand-profiles.ts:44`).
- Rigel feeds learned memory back into future agent runs through reports and brand profiles (`lib/agents/rigel/index.ts:79`, `lib/agents/rigel/index.ts:92`, `lib/agents/orchestrator.ts:256`).

Repo implication:

- Roadmap features should distinguish durable brand memory from transient run state and procedural playbooks. This repo already has brand memory; the missing surface is user-visible memory management and proof that memory improves outcomes.

### 7. Browser/computer use is real but should be reserved for hard-to-API surfaces

Current signal:

- Anthropic documents computer use as a capability where Claude can operate a computer environment, with dedicated security and prompting guidance. Source: Anthropic docs, accessed 2026-06-26, https://docs.anthropic.com/en/docs/build-with-claude/computer-use
- OpenAI's tool docs include computer use among built-in agent tools. Source: OpenAI docs, accessed 2026-06-26, https://developers.openai.com/api/docs/guides/tools
- GitHub's Copilot agent can be extended with MCP servers; GitHub also documents MCP usage patterns for coding agents. Source: GitHub docs, accessed 2026-06-26, https://docs.github.com/en/enterprise-cloud@latest/copilot/customizing-copilot/extending-copilot-coding-agent-with-mcp

Tie to SocialFlow:

- SocialFlow has API-based social connectors and workers; no repo evidence shows browser or computer-control tools.
- Publishing to platforms is already handled through platform APIs where available (`worker/processors/publish.ts:75`, `lib/platforms/types.ts:112`).

Repo implication:

- Do not make browser/computer use a first-line roadmap dependency. Use it only for platform workflows that cannot be supported through official APIs and only after strict approval, sandboxing, and observability exist.

### 8. Tool use is becoming more structured, streaming, and resumable

Current signal:

- OpenAI's WebSockets article focuses on speeding up agentic workflows through real-time interactions. Source: OpenAI, 2026-06-16, https://openai.com/index/speeding-up-agentic-workflows-with-websockets/
- Vercel AI SDK 7 emphasizes resumable streams, tool approvals, and richer agent UI primitives. Source: Vercel, 2026-06-25, https://vercel.com/blog/ai-sdk-7
- LangGraph supports streaming and persistence for long-running agents. Source: LangGraph docs, accessed 2026-06-26, https://docs.langchain.com/oss/javascript/langgraph/overview

Tie to SocialFlow:

- SocialFlow's A2A streaming route polls run state and sends task updates over SSE (`app/api/a2a/route.ts:142`, `app/api/a2a/route.ts:154`, `app/api/a2a/route.ts:198`, `app/api/a2a/route.ts:230`).
- The internal dashboard run page shows timelines after the fact rather than a rich live agent control stream (`app/(dashboard)/runs/[runId]/page.tsx:73`).

Repo implication:

- The product can get more value from live run visibility and approval/resume flows than from raw streaming chat. A run-control surface would align better with existing `agent_steps`.

### 9. Tracing, evals, and run audits are now table stakes for production agents

Current signal:

- LangGraph/LangSmith positioning emphasizes stateful agent workflows with debugging, observability, and deployment support. Source: LangGraph docs, accessed 2026-06-26, https://docs.langchain.com/oss/javascript/langgraph/overview
- GitHub's agent model uses PRs, checks, and review surfaces as operational guardrails. Source: GitHub, 2026-02-26, https://github.blog/ai-and-ml/github-copilot/whats-new-with-github-copilot-coding-agent/
- Vercel AI SDK 7 continues to push framework-level agent primitives, which increases the need for typed tools, approvals, and telemetry. Source: Vercel, 2026-06-25, https://vercel.com/blog/ai-sdk-7

Tie to SocialFlow:

- SocialFlow already has LangSmith links, cost estimates, agent step audit hashes, and deterministic brand-safety evals (`lib/observability/langsmith.ts:3`, `lib/repos/agent-runs.ts:183`, `lib/audit/run-audit.ts:35`, `evals/brand-safety/gate.ts:1`).
- The deterministic brand-safety gate runs in CI, while live model judge calibration is separate and key-dependent (`.github/workflows/ci.yml:64`, `evals/brand-safety/run.ts:1`, `evals/brand-safety/run.ts:3`).

Repo implication:

- Roadmap features should include acceptance tests, run traces, and eval hooks from the start, especially for autonomous publish, reply, and brand-risk decisions.

### 10. Agent governance is converging on least privilege, tenant scoping, and explicit action boundaries

Current signal:

- GitHub custom agents and MCP docs frame agent extension through controlled configuration and repository/org-level tools. Sources: GitHub docs, accessed 2026-06-26, https://docs.github.com/copilot/customizing-copilot/customizing-or-creating-agents/about-custom-agents and https://docs.github.com/en/enterprise-cloud@latest/copilot/customizing-copilot/extending-copilot-coding-agent-with-mcp
- Anthropic computer-use docs emphasize environment and safety considerations for actions taken on behalf of users. Source: Anthropic docs, accessed 2026-06-26, https://docs.anthropic.com/en/docs/build-with-claude/computer-use
- OpenAI workspace agents have a workspace/admin context rather than arbitrary unmanaged agents. Source: OpenAI, 2026-04-22, https://openai.com/index/introducing-workspace-agents-in-chatgpt/

Tie to SocialFlow:

- SocialFlow already has role-based permissions for owner/admin/approver/creator/viewer (`lib/auth/roles.ts:1`, `lib/auth/roles.ts:17`, `lib/auth/roles.ts:27`, `lib/auth/roles.ts:37`), tenant-scoped run and review access (`lib/repos/agent-runs.ts:69`, `lib/repos/content-reviews.ts:66`), and agent capabilities (`lib/agents/capabilities.ts:3`).

Repo implication:

- Governance features should be productized rather than treated as internal plumbing: explain why a run paused, what tool/data it used, who approved it, and what it will do next.

## Trend Radar for This Repo

| Trend | 2026 relevance | SocialFlow readiness | Notes |
|---|---:|---:|---|
| Delegated background agents | High | High | Product already runs background social workflows; needs better user-facing control and recovery. |
| Human-in-the-loop approvals | High | High | Review queue and run pause exist; expand to more action classes. |
| MCP tool ecosystems | High | Medium | MCP client exists; server/external tool exposure absent. |
| A2A multi-agent interoperability | Medium | Medium | Route exists but master plan says hold pre-PMF. |
| Durable memory/state | High | Medium | Brand memory exists; user-visible memory governance is thin. |
| Browser/computer use | Medium | Low | No implementation evidence; use only for non-API gaps. |
| Tracing/evals/audit | High | High | Strong foundation via LangSmith links, audit chain, CI eval gate. |
| Background coding-style agent UX | Medium | Medium | Pattern translates to "assign content ops"; do not clone coding UI literally. |
| Tool approvals/resumability | High | Medium | Run pause exists; tool-level approval not yet modeled. |
| Governance/admin controls | High | Medium | Roles and scoping exist; need workflow-level policy surfaces. |

## Product-Specific Takeaways

1. The strongest 2026-aligned path is not a chatbot; it is a governed background content-operations agent.
2. SocialFlow's existing architecture already has the hard primitives: queues, steps, run audit, review queue, platform connectors, brand profiles, reports, and billing.
3. Near-term bets should reuse current orchestration and review surfaces before adding new protocols.
4. MCP/A2A should be framed as integration layers after the core workflow proves repeatable value.
5. Browser/computer use is a late-stage escape hatch, not a core architecture choice for this repo.

## Self-Check

- Every external trend above cites a primary source URL plus source date or access date.
- Each trend is tied back to concrete SocialFlow files where possible.
- No trend is used to imply this repo already implements behavior that the opened code does not show.
