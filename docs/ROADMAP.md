# Roadmap & Goal Prompts — AI Social Content Automation SaaS

Companion to the full plan at `C:\Users\huuth\.claude\plans\i-want-to-build-fluttering-breeze.md`.
This file turns that plan into **11 runnable Goal prompts** (Goal 0 → Goal 10), one per phase.

---

## How to run this project

- **1 Goal = 1 Phase = 1 feature branch = 1 PR = 1 merge to `main`.**
- Run goals **strictly in order** (each builds on the previous merge).
- Open a **fresh Claude Code session per goal**, paste the `/goal …` block for that goal, and let it run to completion (each prompt contains all its tasks).
- Every goal ends by driving its PR to green and **merging to `main`** (you authorized end-of-goal merges).

---

## Roadmap at a glance

| Goal | Phase | Delivers | Depends on |
|---|---|---|---|
| **0** | Foundation & Infra | Scaffold, design system, DB/queue wiring, **GitHub repo + CI + CodeRabbit**, deploy skeleton | — |
| **1** | Auth & App Shell | Clerk auth, landing page, dashboard shell | 0 |
| **2** | First Vertical Slice (**MVP**) | Connect 1 platform → compose → upload → schedule → auto-publish → calendar | 1 |
| **3** | Multi-Platform Publishing | 4–5 native adapters, multi-select, per-platform variants, per-target status | 2 |
| **4** | LangGraph Content Agent | LLM factory (Gemini), StateGraph, streaming generate, LangSmith | 2 |
| **5** | Niche Research Pipeline | Research tool, research→generate chaining, research/ideas UI | 4 |
| **6** | Billing & Feature Gating | Clerk Billing plans, entitlements, usage quotas (7/day cap) | 1 (+ features from 2–5) |
| **7** | Auto Comment-Reply | Rules, comment ingestion, keyword/AI auto-replies | 3 |
| **8** | Remaining Platforms + Media AI | TikTok + Discord adapters, ImageKit AI transforms | 3, 4 |
| **9** | Observability & Hardening | LangSmith deep links, queue health/alerts, token-refresh monitoring | 2–8 |
| **10** | Polish & Launch | Drag-reschedule, analytics, onboarding, a11y/perf QA | all |

### Run order (canonical)

```
Goal 0  →  Goal 1  →  Goal 2  ──(MVP shippable)──►  Goal 3  →  Goal 4  →  Goal 5
                                                                     │
   Goal 6  →  Goal 7  →  Goal 8  →  Goal 9  →  Goal 10  ◄────────────┘
```

**Why this order (don't break the main logic):**
- **0 before all** — nothing compiles/deploys/reviews without the scaffold, CI, and CodeRabbit.
- **1 before 2** — the composer/calendar live inside the authed dashboard shell.
- **2 before 3/4** — Goal 2 establishes the `PlatformConnector` interface, the `posts/post_targets` schema, and the BullMQ publish worker. 3 adds more adapters to that interface; 4 wires AI generation into that composer. **Never start 3 or 4 before 2 is merged.**
- **4 before 5** — research feeds the agent built in 4.
- **3 before 7** — auto-reply needs comment-capable adapters from 3.
- **3 + 4 before 8** — 8 extends the adapter pattern (3) and the agent tools (4).
- **6 after 2–5** — gating is only meaningful once there are features (posts, AI, research) to gate. It only hard-depends on auth (1), so it *can* slot earlier if you want billing live sooner.
- **9 then 10 last** — hardening and polish over a complete feature set.

**Safe parallelism (optional, advanced):** within Goal 3 and Goal 8 the individual platform adapters are independent and can be built by parallel sub-agents inside that one goal/PR. Goals 4 and 6 are only loosely coupled to Goal 3, so an experienced operator could run them on parallel branches — but the **safe default is strictly sequential**, one merge at a time.

---

## One-time prerequisites (set up during Goal 0)

- **GitHub**: a repo + `gh` CLI authenticated (`gh auth status`). Goal 0 creates the remote and pushes.
- **CodeRabbit**: install the CodeRabbit GitHub App on the repo so it auto-reviews non-draft PRs. Add `.coderabbit.yaml`.
- **Branch protection** on `main`: require the CI check + at least the CodeRabbit review to pass.
- **Accounts/keys** (added to `.env.local` + the worker host as you reach each phase): Clerk (+Billing), Neon, Upstash, ImageKit, Google AI Studio (Gemini), LangSmith, `ENCRYPTION_KEY`, Tavily (Phase 5), and a developer app per social platform (Phase 2/3/8). See the plan's Prerequisites section.

---

## Definition of Done — applies to EVERY goal

Each Goal's prompt ends with this loop. It mirrors your global `CLAUDE.md` Git & PR workflow. **You have authorized merging to `main` at the end of each goal**, once the two gates below are both satisfied.

1. **Implement every task** in the goal, in order. Each task meets its acceptance criteria.
2. **Local gates GREEN before pushing**: `npm run lint && npm run typecheck && npm run build` (and `npm test` once tests exist). Fix locally — never push red.
3. **Self-review** the full diff (`git diff main...HEAD`).
4. **Push** the feature branch and **open a NON-DRAFT PR** to `main` (this triggers CodeRabbit's auto-review).
5. **Drive the PR to green**: poll `gh pr checks <#>`; read the actual CodeRabbit findings via `gh api repos/<owner>/<repo>/pulls/<#>/comments` (not just the green check). Fix every actionable finding → re-verify all local gates → **push once** → comment `@coderabbitai review` exactly once → wait ~2–3 min and re-poll. Repeat until **CodeRabbit is clean AND CI is green**.
6. **Merge to `main`** (squash), then delete the branch.
7. Do **not** stop at "PR opened." The goal is done only after the merge.

> Quota tip: CodeRabbit is rate-limited per hour. Verify green locally first so the auto-review on open isn't wasted. Check remaining quota without spending a review via `@coderabbitai rate limit`.

---

## Current progress (already done in this session)

- ✅ **0.1** Next.js **16.2.9** scaffolded (App Router, TS, **Tailwind v4**, ESLint, `@/*` alias, no `src/`).
- ⏳ **ShadCN** init running (Radix base, CSS variables). Tailwind v4 is CSS-first → design tokens live in `app/globals.css` (`@theme`), not a `tailwind.config.ts`.
- ⬜ Remaining Goal 0 tasks (design system, DB/queue wiring, repo/CI/CodeRabbit, deploy) still to do.

When you run **Goal 0**, it will detect the existing scaffold and continue from here.

---

# The Goal Prompts

Copy one block at a time into a fresh session. Each is self-contained.

---

### Goal 0 — Foundation, Infra, CI & CodeRabbit

```
/goal Goal 0 — Foundation & Infrastructure

Project: AI Social Content Automation SaaS. Full plan: C:\Users\huuth\.claude\plans\i-want-to-build-fluttering-breeze.md ; roadmap: docs/ROADMAP.md. Implement Phase 0. The Next.js 16 scaffold + ShadCN may already exist — detect and continue, don't re-scaffold.

Branch: from main, create `goal0-foundation`.

Tasks (do all, in order):
0.2 Design system: source a SaaS/dashboard DESIGN.md (designmd.ai or Stitch MCP), map tokens to ShadCN CSS variables in app/globals.css (Tailwind v4 @theme), light/dark mode, install base ShadCN components (button, card, input, dialog, tabs, dropdown-menu, badge, sonner, avatar, separator, sheet, skeleton). Render a /theme-check scratch page proving tokens in light+dark.
0.3 Data layer: db/index.ts (drizzle + @neondatabase/serverless), drizzle.config.ts → db/schema, lib/env.ts (zod, server/client split, fail-fast), .env.example documenting every var, package.json scripts db:generate/db:migrate/typecheck.
0.4 Queue+worker skeleton: lib/queue/connection.ts (ioredis, maxRetriesPerRequest:null), lib/queue/queues.ts (QueueName enum), worker/index.ts (boots one Worker per queue stub, logs "worker ready", graceful SIGTERM), "worker" script via tsx.
0.5 Deploy skeleton: prep Vercel (app, enqueue-only) + a worker host (Railway/Render, always-on) + Upstash + Neon; document required env on both; healthcheck route /api/health.
0.6 Repo + CI + CodeRabbit: ensure GitHub remote (create via gh if missing); add .github/workflows/ci.yml running install + lint + typecheck + build on PRs; add .coderabbit.yaml; enable branch protection on main requiring CI; confirm the CodeRabbit GitHub App is installed.

Checkpoint 0: both processes boot; db:migrate runs against Neon (or is verified ready if no DATABASE_URL yet); theme renders; lint+typecheck+build GREEN; CI runs on the PR; CodeRabbit reviews it.

Definition of Done: follow my CLAUDE.md Git & PR workflow — local gates green → push → NON-DRAFT PR → resolve CI + CodeRabbit findings (poll, fix, push once, comment "@coderabbitai review", repeat until clean+green) → MERGE to main → delete branch. Do not stop at "PR opened".
```

---

### Goal 1 — Auth & App Shell

```
/goal Goal 1 — Auth & App Shell

Project plan: C:\Users\huuth\.claude\plans\i-want-to-build-fluttering-breeze.md ; roadmap: docs/ROADMAP.md. Implement Phase 1. Prerequisite: Goal 0 merged to main.

Branch: from updated main, create `goal1-auth-shell`.

Tasks:
1.1 Clerk auth: ClerkProvider in app/layout.tsx; middleware.ts protecting (dashboard)/* and leaving (marketing)/* public; sign-in/up routes; lib/clerk.ts exposing requireUserId()/getOrgId().
1.2 Marketing landing page: app/(marketing)/{layout,page}.tsx — hero, feature sections, platform logos, "up to 7 posts/day" value prop, social proof, CTA→sign-up; responsive; matches design system; footer + legal stubs (privacy, terms).
1.3 Dashboard shell: app/(dashboard)/layout.tsx with sidebar (Overview, Create, Calendar, Accounts, Research, Auto-Reply, Billing, Settings) + topbar (UserButton, QuotaBadge placeholder); active-route highlight; mobile-collapsible; placeholder page.tsx for each route.

Checkpoint 1: sign up → land on dashboard → navigate all sections; landing presentable; unauth /dashboard redirects to sign-in. lint+typecheck+build GREEN.

Definition of Done: follow my CLAUDE.md Git & PR workflow → push → NON-DRAFT PR → resolve CI + CodeRabbit → MERGE to main → delete branch.
```

---

### Goal 2 — First Vertical Slice (MVP)

```
/goal Goal 2 — First Vertical Slice (manual publish, MVP)

Project plan: C:\Users\huuth\.claude\plans\i-want-to-build-fluttering-breeze.md ; roadmap: docs/ROADMAP.md. Implement Phase 2 — the first shippable end-to-end loop on ONE platform (use LinkedIn or X — simplest OAuth + text post). Prerequisite: Goal 1 merged.

Branch: from updated main, create `goal2-mvp-publish`.

Tasks (in order — schema → connector → flows → worker):
2.1 Core schema + repos: db/schema/{enums,social-accounts,posts,post-targets,media-assets,schedules}.ts; migrate; lib/repos/{accounts,posts,schedules,media}.ts typed CRUD. post_targets is the per-platform publish unit.
2.2 PlatformConnector: lib/platforms/{types,registry,base}.ts (interface incl. getAuthUrl/exchangeCode/refreshToken/publishNow/fetchComments/postReply + capabilities; registry getConnector(); AbstractConnector refresh-on-expiry); one concrete adapter; lib/utils/crypto.ts to encrypt tokens at rest.
2.3 OAuth + Accounts page: app/api/oauth/[platform]/{start,callback}/route.ts (signed state → exchange → upsert encrypted social_accounts); app/(dashboard)/accounts/page.tsx with ConnectCard + AccountStatusBadge.
2.4 ImageKit upload: app/api/imagekit/auth/route.ts (signed params); lib/imagekit/{server,client}.ts; components/composer/MediaUploader.tsx (direct browser upload → media_assets row).
2.5 Composer + create post: app/(dashboard)/create/page.tsx (body editor, attach media, pick the connected account, SchedulePicker with tz); app/api/posts/route.ts creates post + one post_target.
2.6 Publish queue + worker: lib/queue/jobs.ts enqueuePublish(targetId,{delay}); app/api/posts/[id]/schedule/route.ts computes delay = scheduledAt−now per target, enqueues with deterministic jobId=target.id, writes schedules ledger; worker/processors/publish.ts loads target+account, calls getConnector(platform).publishNow(), records externalPostId/publishedAt, retry attempts:4 exponential backoff. BullMQ owns scheduling for ALL platforms.
2.7 Calendar read view: app/(dashboard)/calendar/page.tsx month/week grid; components/calendar/{CalendarGrid,DayColumn,PostChip} status-colored.

Checkpoint 2 (MVP): connect → compose → upload → schedule 2 min out → worker auto-publishes live → post_targets.status=published with real externalUrl → calendar reflects it; failures surface an error. lint+typecheck+build GREEN.

Definition of Done: follow my CLAUDE.md Git & PR workflow → push → NON-DRAFT PR → resolve CI + CodeRabbit → MERGE to main → delete branch.
```

---

### Goal 3 — Multi-Platform Publishing

```
/goal Goal 3 — Multi-Platform Publishing

Project plan: C:\Users\huuth\.claude\plans\i-want-to-build-fluttering-breeze.md ; roadmap: docs/ROADMAP.md. Implement Phase 3. Prerequisite: Goal 2 merged (PlatformConnector + publish worker exist).

Branch: from updated main, create `goal3-multi-platform`.

Tasks:
3.1 Add adapters against the existing PlatformConnector interface: lib/platforms/{facebook,instagram,pinterest,youtube}.ts (OAuth + publishNow + capabilities); register each. Build each as its own sub-task; you may parallelize adapter sub-agents within this one PR. Start Meta/Google app-review submissions now (note in PR).
3.2 Composer multi-select + variants: components/composer/{PlatformMultiSelect,VariantEditor}.tsx — only connected accounts selectable; per-platform tab with independent body/media/platformOptions; enforce per-platform limits from capabilities; app/api/posts/route.ts creates N post_targets.
3.3 Per-target schedule/cancel + status rollup: per-target schedule/reschedule/cancel; lib/repos/posts.ts recomputeStatus → published | partially_published | failed; failed-target manual retry in UI.

Checkpoint 3: one compose → tailored variants published to 4–5 platforms with independent status; cancel one target leaves others; induced failure → partially_published + retry works. lint+typecheck+build GREEN.

Definition of Done: follow my CLAUDE.md Git & PR workflow → push → NON-DRAFT PR → resolve CI + CodeRabbit → MERGE to main → delete branch.
```

---

### Goal 4 — LangGraph Content-Generation Agent

```
/goal Goal 4 — LangGraph Content Agent

Project plan: C:\Users\huuth\.claude\plans\i-want-to-build-fluttering-breeze.md ; roadmap: docs/ROADMAP.md. Implement Phase 4 — the AI-ecosystem centerpiece. Prerequisite: Goal 2 merged (composer exists). Independent of Goal 3.

Branch: from updated main, create `goal4-langgraph-agent`.

Tasks:
4.1 LLM factory: lib/llm/factory.ts getChatModel() → LangChain BaseChatModel; default ChatGoogleGenerativeAI (@langchain/google-genai); providers/{openai,anthropic}.ts mirror; LLM_PROVIDER env switch. The graph never imports a concrete provider.
4.2 StateGraph: lib/agent/{state,graph,prompts,index}.ts + lib/agent/nodes/{research,digest,ideate,draftPerPlatform,critique,refine,finalize}.ts. ContentState with reducers + bounded revisionCount (MAX_REVISIONS=2); topology research→digest→ideate→draftPerPlatform→critique→(conditional refine↩ or finalize)→END; finalize persists generated_content (add db/schema/generated-content.ts). Build node groups as sub-tasks.
4.3 Streaming generate + panel: app/api/generate/route.ts (Node runtime) streams short single-platform asks via streamContentAgent; components/composer/GeneratePanel.tsx streams into editor; large multi-platform runs enqueue the generate queue + worker/processors/generate.ts.
4.4 LangSmith: set LANGCHAIN_* env in app AND worker; capture langsmithRunId onto generated_content.

Checkpoint 4: topic + platforms → tailored drafts written to generated_content, accepted into composer; refine loop bounded at 2; a matching LangSmith trace exists. lint+typecheck+build GREEN.

Definition of Done: follow my CLAUDE.md Git & PR workflow → push → NON-DRAFT PR → resolve CI + CodeRabbit → MERGE to main → delete branch.
```

---

### Goal 5 — Niche Research Pipeline

```
/goal Goal 5 — Niche Research Pipeline

Project plan: C:\Users\huuth\.claude\plans\i-want-to-build-fluttering-breeze.md ; roadmap: docs/ROADMAP.md. Implement Phase 5. Prerequisite: Goal 4 merged (the agent exists).

Branch: from updated main, create `goal5-research`.

Tasks:
5.1 Research schema + tool: db/schema/research.ts (research_topics); lib/agent/tools/{webSearch,platformGuide}.ts (webSearch behind one interface — Tavily/SerpAPI/Bing); wire lib/agent/nodes/research.ts to call it and concat findings into state.
5.2 Research→generate chaining: app/api/research/route.ts creates a topic + enqueues research; worker/processors/research.ts runs research then chains a generate job; set provenance posts.sourceContentId when an idea becomes a post.
5.3 Research page: app/(dashboard)/research/page.tsx with tabs Topics / Ideas; components/research/{TopicList,IdeaCard,GeneratePanel}; "Accept → composer" prefills create.

Checkpoint 5: submit a niche → findings → ideas → tailored drafts with no manual steps; accept an idea straight into the scheduler; provenance links post→generated_content→research_topic. lint+typecheck+build GREEN.

Definition of Done: follow my CLAUDE.md Git & PR workflow → push → NON-DRAFT PR → resolve CI + CodeRabbit → MERGE to main → delete branch.
```

---

### Goal 6 — Billing & Feature Gating

```
/goal Goal 6 — Billing & Feature Gating (Premium)

Project plan: C:\Users\huuth\.claude\plans\i-want-to-build-fluttering-breeze.md ; roadmap: docs/ROADMAP.md. Implement Phase 6. Prerequisite: Goal 1 merged (auth). Best run after Goals 2–5 so there are features to gate.

Branch: from updated main, create `goal6-billing`.

Tasks:
6.1 Plans + entitlements: define Free/Pro/Premium plans + features in the Clerk dashboard; lib/billing/plans.ts (plan→feature/quota map); lib/billing/entitlements.ts can(userId,feature)/checkQuota(metric) via Clerk has().
6.2 Usage metering + enforcement: db/schema/usage.ts + lib/repos/usage.ts; increment on schedule/generate/research/connect; enforce caps at enqueue — ≤7 posts/day, AI generations/month, connected accounts; over-limit → upgrade prompt.
6.3 Billing page + pricing + webhook: app/(dashboard)/billing/page.tsx (tabs Plan/Usage/Invoices) with Clerk PricingTable + portal; app/(marketing)/pricing CTAs; app/api/webhooks/billing/route.ts updates plan snapshot + resets quotas; gate premium UI with has()/<Show>.

Checkpoint 6: 8th same-day schedule is blocked with an upgrade CTA; subscribing unlocks gated features + raises quotas via the webhook. lint+typecheck+build GREEN.

Definition of Done: follow my CLAUDE.md Git & PR workflow → push → NON-DRAFT PR → resolve CI + CodeRabbit → MERGE to main → delete branch.
```

---

### Goal 7 — Auto Comment-Reply

```
/goal Goal 7 — Auto Comment-Reply

Project plan: C:\Users\huuth\.claude\plans\i-want-to-build-fluttering-breeze.md ; roadmap: docs/ROADMAP.md. Implement Phase 7. Prerequisite: Goal 3 merged (comment-capable adapters).

Branch: from updated main, create `goal7-auto-reply`.

Tasks:
7.1 Schema + rules UI: db/schema/{auto-reply,comment-events}.ts; lib/repos/replies.ts; app/(dashboard)/auto-reply/page.tsx with RuleTable + RuleForm (keywords, matchType any/all/exact/regex, template with {{author}}, AI toggle, per-account scope, cooldownSec, maxPerDay).
7.2 Comment ingestion: implement fetchComments/postReply on comment-capable adapters; worker/processors/comment-poll.ts repeatable per active account (registered on connect); app/api/webhooks/comments/[platform]/route.ts where webhooks exist; dedupe via unique (socialAccountId, externalCommentId).
7.3 Reply matching + dispatch: worker/processors/reply.ts matches rules, composes templated or AI reply, calls postReply, records replied/replyExternalId, honors cooldown/maxPerDay.

Checkpoint 7: a comment containing a rule keyword on a live post gets one auto-reply within the poll window; dedupe + cooldown + daily cap respected. lint+typecheck+build GREEN.

Definition of Done: follow my CLAUDE.md Git & PR workflow → push → NON-DRAFT PR → resolve CI + CodeRabbit → MERGE to main → delete branch.
```

---

### Goal 8 — Remaining Platforms + Media AI

```
/goal Goal 8 — Remaining Platforms + Media AI

Project plan: C:\Users\huuth\.claude\plans\i-want-to-build-fluttering-breeze.md ; roadmap: docs/ROADMAP.md. Implement Phase 8. Prerequisite: Goals 3 (adapter pattern) and 4 (agent tools) merged.

Branch: from updated main, create `goal8-platforms-media-ai`.

Tasks:
8.1 TikTok + Discord adapters: lib/platforms/{tiktok,discord}.ts against PlatformConnector (Discord posts via webhook → supportsComments:false; TikTok via Content Posting API); register; complete TikTok app review (note in PR).
8.2 ImageKit AI transform + variants: lib/agent/tools/imagekitTransform.ts generates platform-sized/branded image variants; composer can request AI media variants; derived assets link via media_assets.sourceAssetId.

Checkpoint 8: all 8 platforms publish a real post/message from a test account; generating an AI media variant produces a usable transformed asset. lint+typecheck+build GREEN.

Definition of Done: follow my CLAUDE.md Git & PR workflow → push → NON-DRAFT PR → resolve CI + CodeRabbit → MERGE to main → delete branch.
```

---

### Goal 9 — Observability & Hardening

```
/goal Goal 9 — Observability & Hardening

Project plan: C:\Users\huuth\.claude\plans\i-want-to-build-fluttering-breeze.md ; roadmap: docs/ROADMAP.md. Implement Phase 9. Prerequisite: Goals 2–8 merged.

Branch: from updated main, create `goal9-observability`.

Tasks:
9.1 LangSmith deep links + structured logging: link generated content → its LangSmith trace; structured logs in all worker processors.
9.2 Queue health + failed-publish alerting: a BullMQ board/health endpoint; alert on repeated publish failures; surface dead-letter targets in the UI.
9.3 Token-refresh monitoring + account health: proactive refresh; flag expired/revoked accounts in accounts/page.tsx; block scheduling onto dead accounts with a reconnect CTA.

Checkpoint 9: induce a token expiry and a publish failure → both caught, retried where valid, surfaced clearly, no silent drops. lint+typecheck+build GREEN.

Definition of Done: follow my CLAUDE.md Git & PR workflow → push → NON-DRAFT PR → resolve CI + CodeRabbit → MERGE to main → delete branch.
```

---

### Goal 10 — Polish & Launch

```
/goal Goal 10 — Polish & Launch

Project plan: C:\Users\huuth\.claude\plans\i-want-to-build-fluttering-breeze.md ; roadmap: docs/ROADMAP.md. Implement Phase 10 — production-quality finish. Prerequisite: Goal 9 merged.

Branch: from updated main, create `goal10-polish`.

Tasks:
10.1 Calendar drag-to-reschedule + bulk scheduling + post duplication.
10.2 Engagement analytics pull-back: fetch basic metrics (likes/comments/views) onto published targets; overview dashboard.
10.3 Onboarding wizard + empty states + dark-mode pass: first-run "connect → first post" flow; polished empty states; verified dark mode across pages.
10.4 Final QA: Lighthouse, keyboard nav, error boundaries, loading skeletons.

Checkpoint 10: full feature set, polished UX, observable, monetized; a11y + perf pass. lint+typecheck+build GREEN.

Definition of Done: follow my CLAUDE.md Git & PR workflow → push → NON-DRAFT PR → resolve CI + CodeRabbit → MERGE to main → delete branch. This is the final launch-readiness merge.
```
