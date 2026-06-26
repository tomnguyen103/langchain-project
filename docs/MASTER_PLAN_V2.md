# Master Plan V2 — Media-Generation Pivot & Deployment-Ready Stack

_Created 2026-06-26. Source trigger: the TubeGuruji mega-tutorial **"Build 3 Full Stack AI SaaS Apps with Next.js, React & AI"** ([youtube.com/watch?v=rcEUVADmH2g](https://www.youtube.com/watch?v=rcEUVADmH2g), 7h50m, published 2026-06-25)._

> **Relationship to the existing plan.** This is **not** a replacement for [docs/MASTER_PLAN.md](MASTER_PLAN.md) (internally "v5"), which remains the canonical status contract for the **text-first** SocialFlow product (publishing, agents, governance, compliance — all complete at repo level). This V2 is a **forward-looking expansion plan**: it adapts the *new product angles* and *tech stack* introduced by the video and re-architects the app to be **deployment-ready on Vercel + Trigger.dev**. Where the two overlap, the existing v5 foundation is the base we build on, not something we throw away. The "v2" label is the user's framing ("Master Plan v2" = the next-generation plan from the video); it does not renumber the v5 product plan.

---

## 0. TL;DR (read this first)

1. **The big angle shift: text → generative media.** The video's three apps are all **AI image/video/voice generation** products. Our repo is a **text-first** content engine (LangChain writes captions; ImageKit only *transforms* existing images). The single most important adaptation is adding a **generative media layer** (Luma for image/video, ElevenLabs for voice, HeyGen/D-ID for talking avatars, Whisper/FFmpeg/Remotion for long→short). This also unblocks three items our v5 plan marked `[blocked] External`: the **on-brand visual generation agent (Pictor)**, the **DM/inbox agent (Hermes)**, and **threaded multi-turn replies (Lyra-Dialogue)**.

2. **Deployment recommendation: YES to Vercel + Trigger.dev — but that pair alone is not "deployment-ready."** Vercel hosts the Next.js app; **Trigger.dev replaces the BullMQ + Redis always-on worker** (the one thing that doesn't fit Vercel) and is purpose-built for the multi-minute video/avatar renders this pivot introduces. But a deployable media SaaS also needs **blob storage, a social-publishing API (Zernio), Arcjet for AI-spend/abuse protection, Stripe credit-metering, and the media-AI providers.** Full topology in §5.

3. **Adopt surgically, don't re-platform.** The repo's clean abstractions (`PlatformConnector` registry, LLM factory, queue/processor split) are perfect seams. Swap a **Zernio-backed connector** into the registry; add a **media-provider factory** mirroring the LLM factory; port each `worker/processors/*.ts` to a `trigger/*.ts` task. **Keep Neon + Drizzle + Clerk** — do not churn to Supabase/InsForge auth/db just because the tutorial did.

4. **AI media is the cost driver, not infra.** A single Luma video clip is ~$0.32–$1.05. At even modest usage that dwarfs Vercel/Neon/Clerk combined. **Credit metering + Arcjet token-budget rate limits are mandatory, not optional** (§7).

---

## 1. What the video actually builds (comprehensive analysis)

**Channel:** TubeGuruji · **Runtime:** 7:50:21 · **Theme (their words):** "AI content creator and video automation." Three separate production-style apps, each with: Next.js + React + Tailwind, auth, database, storage, **background jobs**, **AI media APIs**, and **payments/credits**.

### Chapters
| Time | App |
|---|---|
| 00:00 | Introduction |
| 01:37:19 | **App 1 — AI Influencer Generator & Auto Scheduler** |
| 02:15:45 | **App 2 — Long-to-Short Video Generator** (YouTube Shorts / Reels / TikTok) |
| 05:17:03 | **App 3 — AI Avatar Studio** (avatars, voice cloning, talking-avatar video) |

### App 1 — AI Influencer Generator & Auto Scheduler
- **What it does:** create a persistent AI "model/influencer" (gender, body type, skin tone, age, hairstyle, vibe, custom prompt) → generates **portrait + full-body** images → create on-brand **posts** (campaign, product, goal, scene, outfit, lighting, props, CTA, up to 3–9 reference images) → Luma generates 2 **post variants** → **schedule** to connected platforms (Instagram, X, …) with a **calendar** view → **credit system** (free/paid; credits deducted per generation).
- **Stack:** Next.js/React/Tailwind · **Supabase** (Postgres DB + Auth, incl. social OAuth sign-in) · **Luma AI** (image + image-to-post variant generation) · **Zernio API** (multi-platform scheduling) · credit-based metering.

### App 2 — Long-to-Short Video Generator
- **What it does:** upload a long video → auto-detect viral moments → cut into short clips → **auto-caption/subtitle** → format for 9:16 (Shorts/Reels/TikTok) → schedule/publish.
- **Stack:** Next.js/React/Tailwind · **Clerk** (auth) · **Zernio API** (social scheduling) · **Arcjet** (security + rate limiting) · (implied media pipeline: transcription → moment-selection → FFmpeg/caption render — run as background jobs).

### App 3 — AI Avatar Studio
- **What it does:** generate AI avatars, **clone voices**, produce **talking-avatar videos**, manage everything in a SaaS dashboard. These are **long-running renders** → needs durable background jobs.
- **"Free tech stack" they showcase:** **Trigger.dev** (background jobs / long-running tasks) · **InsForge** (open-source BaaS: auth/db/storage/functions/AI/Stripe) · **Flowstep** (AI design/landing generation) · **Planarc.dev** (project planning/code review). (Voice + avatar AI providers aren't named in the description — the category maps to ElevenLabs-class voice cloning and HeyGen/D-ID/Tavus-class talking-avatar APIs.)

### Cross-cutting "new angles" (the part that matters for us)
1. **Generative media is the product**, not a side feature. Image gen, video gen, video repurposing, voice clone, talking head.
2. **Long-running, async, expensive jobs** (renders/polls) → a real durable-jobs platform is structural, not optional.
3. **Buy the social layer (Zernio) instead of building 15 OAuth connectors.**
4. **Credit metering** is first-class because each action costs real $ per call.
5. **Buy security (Arcjet)** instead of hand-rolling rate limits — and specifically to cap **AI token/$ budgets** and block bots from draining them.
6. **AI-assisted build tooling** (Eraser docs, Flowstep design, Planarc planning) — peripheral, not product.

---

## 2. Repo vs. Video — tech-stack comparison

| Concern | **Repo today (SocialFlow v5)** | **Video (TubeGuruji)** | Verdict for V2 |
|---|---|---|---|
| Framework | Next.js 16 + React 19 + Tailwind v4 | Next.js + React + Tailwind | ✅ Same — keep |
| Auth | **Clerk** | Supabase Auth (app 1) / Clerk (app 2) | ✅ Keep Clerk |
| Database | **Neon Postgres + Drizzle ORM** | Supabase / InsForge | ✅ Keep Neon + Drizzle |
| Background jobs | **BullMQ + Redis, always-on `worker/`** | **Trigger.dev** | 🔁 **Replace with Trigger.dev** (deployment-critical) |
| Social publishing | **8 hand-rolled OAuth connectors** + token crypto + comment polling | **Zernio API** (15+ platforms, 1 REST API) | 🔁 **Adopt Zernio behind the connector interface** |
| Generative images | ❌ none (ImageKit only *transforms*) | **Luma AI** | ➕ **New: add Luma** |
| Generative video | ❌ none | **Luma AI** (Ray) | ➕ **New** |
| Long→short repurpose | ❌ none (text repurposing only) | transcription + FFmpeg/caption render | ➕ **New pipeline** |
| Voice cloning | ❌ none | ElevenLabs-class | ➕ **New** |
| Talking avatar | ❌ none | HeyGen/D-ID-class | ➕ **New** |
| Blob/object storage | ❌ none (ImageKit CDN for images only) | Supabase Storage / InsForge | ➕ **New: real blob store for video/audio** |
| Security / rate limit | Postgres fixed-window limiter | **Arcjet** | 🔁 **Adopt Arcjet** (adds bot + prompt-injection + AI-budget) |
| Billing | Clerk Billing (plan tiers) | **credit system** | ➕ **Add credit metering (Stripe)** |
| LLM (text) | LangChain + LangGraph (Anthropic/OpenAI/Gemini) | (lighter LLM use) | ✅ Keep — it's an asset the video lacks |
| Agent governance/compliance | Castor gate, audit hash-chain, Aletheia disclosure, roles, A2A/MCP | ❌ none | ✅ **Our moat — keep & reuse for media** |
| Tracing | LangSmith | ❌ | ✅ Keep |
| Deploy target | self-host worker + Vercel (implied) | **Vercel + Trigger.dev** | ✅ Adopt |

**Reading of the table:** we are *ahead* of the tutorial on governance, agents, compliance, and code quality, and *behind* on exactly one axis that happens to be the whole point of the video — **generative media + the infra to run it cheaply and safely.** V2 closes that gap without discarding our lead.

---

## 3. New stacks / technologies to add (the explicit list)

Grouped by necessity. Each row: what it is · why · where it plugs into our code · rough cost · alternative.

### Tier 1 — Structural (do these first; everything else depends on them)
| Tech | Why we need it | Plug-in point | Cost (small scale) | Alt |
|---|---|---|---|---|
| **Trigger.dev** (v4) | Durable, long-running, retry-heavy jobs (video/avatar renders, async-poll Luma/HeyGen, schedule dispatch). Replaces always-on BullMQ worker that can't run on Vercel. | Port `worker/processors/*.ts` → `trigger/*.ts` tasks; keep ledger semantics via idempotency keys. | Free tier → ~$10–50/mo | **Inngest** (close 2nd) |
| **Object/blob storage** | Store uploaded long videos + generated images/video/audio. ImageKit only handles image CDN/transforms. | New `lib/storage/*` provider; presigned uploads from client. | **Cloudflare R2** (zero egress) ~$0.015/GB; or **Vercel Blob** (simplest) | Supabase Storage, S3 |
| **Stripe credit metering** | Each AI media call costs $; plan-tier quotas aren't granular enough. | Extend `lib/billing/*`: add `credits` ledger + per-action debit; reuse atomic-usage pattern. | Stripe fees only | Clerk Billing usage records, InsForge billing |

### Tier 2 — The media engine (the actual new product)
| Tech | Why | Plug-in point | Cost | Alt |
|---|---|---|---|---|
| **Luma AI (Dream Machine) API** | Generative **images** (Photon/Uni ~$0.04/img) + **video** (Ray ~$0.32–$1.05/clip). Powers App-1 influencer + App-3 b-roll. | New `lib/media/providers/luma.ts` behind a `MediaProvider` interface (mirror `lib/llm/factory.ts`). | $0.04/img, $0.32–$1.05/clip | Replicate, fal.ai, Runway, Google Veo, Kling |
| **Voice cloning API** (ElevenLabs) | App-3 voice clone + narration for shorts. | `lib/media/providers/voice.ts` | ~$5–99/mo + usage | PlayHT, Cartesia, OpenAI TTS |
| **Talking-avatar / lip-sync API** (HeyGen or D-ID or Tavus) | App-3 talking-head video. | `lib/media/providers/avatar.ts` | ~$0.05–0.30/min or sub | D-ID, Tavus, Synthesia, open SadTalker |
| **Transcription + word timestamps** (OpenAI Whisper or Deepgram) | App-2 long→short captions + viral-moment detection. | `trigger/long-to-short/transcribe.ts` | ~$0.006/min (Whisper) | Deepgram, AssemblyAI |
| **Video render** — **FFmpeg** (clip/caption burn-in) and/or **Remotion** (programmatic React video for captioned shorts) | App-2/App-3 final render. Runs inside Trigger.dev tasks. | `trigger/render/*` | compute only | Shotstack (hosted), Creatomate |

### Tier 3 — Buy-vs-build wins (replace home-grown surface)
| Tech | Why | Plug-in point | Cost | Note |
|---|---|---|---|---|
| **Zernio API** | One REST API for publish/schedule/**comments**/**DMs** across 15+ platforms. Collapses our 8 connectors + comment-poll + the *blocked* DM/threaded-reply backlog. Has a Node SDK + an MCP server (280+ tools). | Implement `ZernioConnector` in `lib/platforms/registry.ts`; route comment/DM ingestion through Zernio webhooks. | Free (2 accts) → $1–6/acct/mo | **Biggest leverage item.** Keep direct connectors as fallback. |
| **Arcjet** | Bot protection, rate limiting (token-bucket = per-user **AI $ budget**), **prompt-injection detection**, signup/WAF — no Redis to run. | Wrap `proxy.ts` middleware + `/api/generate`, `/api/agents/run`, new `/api/media/*`. | Free tier → ~$49/mo | Replaces `lib/rate-limit.ts` (Postgres) for abuse paths |

### Tier 4 — Optional / dev-tooling (the tutorial uses; we likely skip)
| Tech | Verdict |
|---|---|
| **Supabase** (DB/auth/storage) | ❌ Skip for DB/auth (we have Neon+Clerk). ✅ Supabase **Storage** is a viable blob option if we don't pick R2/Vercel Blob. |
| **InsForge** (BaaS) | ❌ Don't re-platform onto it. ⚠️ Its Storage/Stripe/AI could be used à la carte; an InsForge MCP + skill is already available in this workspace if we want to spike it. |
| **Flowstep** (AI design→landing) | 🟡 Optional build-time tool for the marketing page. Not runtime. |
| **Eraser.io** (arch diagrams) | 🟡 Nice for the V2 architecture doc; not product. |
| **Planarc.dev** (planner/review) | 🟡 Optional; we already have CodeRabbit + this plan. |

---

## 4. Deployment recommendation (my pick, with the reasoning)

**Your instinct — Vercel + Trigger.dev — is correct. I'm endorsing it, with the explicit caveat that those two are necessary but not sufficient.** Here's the honest case.

### Why Trigger.dev (over keeping BullMQ, and over Inngest)
- **The problem it solves:** our `worker/index.ts` is an **always-on Node process** bound to **Redis**. Vercel has no always-on compute — so today "deploy" means *also* renting a Railway/Render/Fly box + Upstash Redis and self-managing scaling, retries, and observability. The media pivot makes this worse: video/avatar renders run **minutes to hours**, far beyond any serverless function timeout.
- **Why Trigger.dev fits:** it runs **your** code on **its** infra with **no timeout**, durable state, built-in retries/concurrency/queues, **scheduled triggers** (replaces our `enqueueWithLedger` cron ledger), idempotency keys, and **waitpoints** ("pause this run until the Luma webhook fires") — which is exactly the async media-gen pattern. Native Vercel pairing.
- **Why not Inngest (the close runner-up):** Inngest is excellent and also Vercel-friendly, but its classic model executes steps **inside your own serverless functions** (timeout-bound), which is awkward for heavy FFmpeg/Remotion renders. Trigger.dev's long-running container execution is the better fit **for this specific render-heavy workload.** If we were doing only short event-driven steps, Inngest would tie or win.
- **Why not just keep BullMQ:** maximum control, but you own the box, the Redis, the autoscaling, and the dashboards — and you still can't run the renders on Vercel. Wrong trade for a small team shipping a media SaaS.

### The full deployment-ready topology (not just the two boxes)
```
                         ┌─────────────────────────────────────────────┐
        Users ──────────▶│  VERCEL  — Next.js 16 (RSC/API/edge)         │
                         │  · Arcjet middleware (bot/rate/prompt-inj)   │
                         │  · Clerk auth · presigned upload endpoints   │
                         └───────┬───────────────────────┬─────────────┘
                                 │ trigger.tasks()       │ reads/writes
                                 ▼                       ▼
            ┌────────────────────────────┐     ┌──────────────────────┐
            │  TRIGGER.DEV (durable jobs) │     │  NEON Postgres        │
            │  · content-agent runs       │◀───▶│  + Drizzle ORM        │
            │  · luma img/video gen+poll  │     └──────────────────────┘
            │  · long→short render (FFmpeg│
            │    /Remotion + Whisper)     │     ┌──────────────────────┐
            │  · voice clone / avatar     │────▶│ BLOB: Cloudflare R2   │
            │  · schedule dispatch →Zernio│     │ (video/audio/img src) │
            │  · comment/DM poll ←Zernio  │     └──────────────────────┘
            └───────┬───────────┬─────────┘     ┌──────────────────────┐
                    │           └──────────────▶│ ImageKit (img CDN)    │
                    ▼                            └──────────────────────┘
   ┌─────────────────────────────────────────────────────────────────┐
   │ External AI/media + social: Luma · ElevenLabs · HeyGen/D-ID ·    │
   │ Whisper/Deepgram · Zernio (15+ platforms) · Stripe · LangSmith   │
   └─────────────────────────────────────────────────────────────────┘
```

### Managed-services shopping list (what "deployment-ready" actually requires)
**Vercel** (app) · **Trigger.dev** (jobs) · **Neon** (db) · **Clerk** (auth) · **Cloudflare R2 or Vercel Blob** (media) · **ImageKit** (image CDN, keep) · **Luma** (img/video) · **ElevenLabs** (voice) · **HeyGen/D-ID** (avatar) · **Whisper/Deepgram** (transcribe) · **Zernio** (social) · **Arcjet** (security) · **Stripe** (credits) · **LangSmith** (tracing). Decommission at cutover: the self-hosted **worker host + Redis/Upstash**.

---

## 5. Phased implementation roadmap

Each wave is independently shippable and maps to existing repo seams. Follow the repo's PR→CodeRabbit→merge loop.

### Wave 0 — Deployment re-platform (no new features)
**Goal:** ship today's product on the target topology so later waves land on stable ground.
1. **Trigger.dev migration.** Stand up `trigger.config.ts`; port processors one-by-one (`publish`, `reconcile`, `token-refresh`, `comment-poll`, `agent-step`, `research-watch`, `evergreen`, `publish-repair`, `report`, `seeding`) to `trigger/*.ts`. Preserve idempotency via Trigger idempotency keys; replace the schedule ledger's cron with `schedules.task`. Keep BullMQ behind a feature flag until parity is verified.
2. **Arcjet** in `proxy.ts` + on `/api/generate` and `/api/agents/run`; migrate abuse-path limits off the Postgres limiter (keep Postgres limiter only for business quotas).
3. **Vercel project** + env wiring; **R2/Vercel Blob** provisioned.
4. **Verify:** generate → Castor gate → review → schedule → publish runs end-to-end on Trigger.dev; delete worker-host/Redis.

### Wave 1 — Generative media foundation
**Goal:** the `MediaProvider` abstraction + storage + credits, with Luma as first provider.
1. `lib/media/` factory + `MediaProvider` interface (mirror `lib/llm/factory.ts`); `luma.ts` (image first).
2. `lib/storage/` provider (R2/Vercel Blob); presigned client uploads; `media_assets` schema extension for generated/source media + provider job ids.
3. **Credit ledger** in `lib/billing/` (atomic debit, refund-on-failure mirroring existing quota refunds); Arcjet **token-bucket** per user keyed to credits.
4. Trigger task `trigger/media/generate-image.ts` with waitpoint for Luma async completion → webhook → store in blob → ImageKit for delivery.

### Wave 2 — App-1 capability: AI Influencer + on-brand posts (unblocks **Pictor**)
1. `ai_models` schema (persona attributes) + studio UI (gender/body/age/hair/vibe/prompt) → portrait + full-body gen.
2. Post composer extension: reference images, scene/outfit/lighting/props/CTA → Luma **N-variant** image (and optional video) generation, reusing the existing best-of-N + Castor brand-safety gate (our governance now wraps media).
3. Schedule via Zernio (Wave 4) or existing connectors interim.

### Wave 3 — App-2 capability: Long→Short repurposer
1. Long-video upload → R2; `trigger/long-to-short/` pipeline: transcribe (Whisper, word timestamps) → LLM moment-selection (reuse LangGraph) → FFmpeg/Remotion clip + caption burn-in + 9:16 → store → review gate → schedule.
2. Extends the existing Phoenix/Evergreen repurposing surface into **video**.

### Wave 4 — Zernio adoption (buy-vs-build)
1. `ZernioConnector` implementing `PlatformConnector`; register in `lib/platforms/registry.ts` (the no-switch registry makes this a drop-in).
2. Route scheduling/publish through Zernio; map comment/DM **webhooks** into existing `comment_events` + auto-reply.
3. **Unblocks v5's `[blocked]` items:** DM/inbox agent (**Hermes**) and threaded multi-turn reply (**Lyra-Dialogue**) via Zernio's unified Comments+DMs API.

### Wave 5 — App-3 capability: Avatar Studio
1. Voice clone (`lib/media/providers/voice.ts`) + talking-avatar (`avatar.ts`) providers; long renders as Trigger tasks with waitpoints.
2. Studio dashboard; credit-metered; same review/disclosure (**Aletheia**) path — important: AI-avatar/voice content needs the AI-disclosure ledger we already built.

### Wave 6 — Polish & cost controls
Credit purchase UI (Stripe) · per-feature budget caps (extends **Quaestor** spend governor) · provider fallbacks (Luma→fal/Replicate) · usage dashboards.

---

## 6. Decisions you should weigh in on

1. **Keep Neon+Drizzle+Clerk, or move to Supabase/InsForge?** — **My recommendation: keep.** The tutorial uses Supabase/InsForge because it's greenfield; we have a mature, tested data + auth layer and a governance stack built on it. Re-platforming is pure churn with no product gain. (Use Supabase/InsForge **Storage** only if you'd rather not run R2/Vercel Blob.)
2. **Replace the 8 OAuth connectors with Zernio, or run hybrid?** — **My recommendation: Zernio-primary behind the interface, connectors as fallback.** Massive maintenance reduction + unlocks DM/threaded backlog. Risk: vendor dependency + per-account cost. The `PlatformConnector` seam means we can keep both.
3. **Blob storage: Cloudflare R2 vs Vercel Blob?** — R2 = cheapest egress (best for video). Vercel Blob = simplest DX. **Recommend R2** for a video-heavy product; Vercel Blob acceptable for MVP.
4. **Talking-avatar provider** (HeyGen vs D-ID vs Tavus) and **voice** (ElevenLabs vs Cartesia) — pick on quality/price after a spike; the provider interface keeps it swappable.
5. **Trigger.dev vs Inngest** — Recommend **Trigger.dev** for render-heavy long jobs; revisit only if our jobs turn out to be mostly short event steps.
6. **Scope:** ship all three app capabilities, or start with **App-1 (influencer)** as the flagship (highest overlap with our existing scheduler)? — **Recommend App-1 first.**

---

## 7. Cost reality (why metering is non-negotiable)

| Item | Unit cost | At ~100 active users (illustrative) |
|---|---|---|
| Luma **video** (Ray, 5s 1080p) | ~$0.32–$1.05/clip | 2,000 clips/mo → **$640–$2,100/mo** ⟵ dominant |
| Luma **image** | ~$0.04/img | 10,000 imgs → ~$400/mo |
| ElevenLabs voice | sub + usage | ~$22–99/mo + usage |
| HeyGen/D-ID avatar | ~$0.05–0.30/min | scales with minutes |
| Whisper transcribe | ~$0.006/min | minor |
| Zernio | $1–6/acct/mo | ~$200–600/mo @200 accts |
| Trigger.dev | usage | ~$10–50/mo |
| Vercel Pro / Neon / Clerk / Arcjet | flat-ish | ~$20 / $19 / $25 / $0–49 |
| R2/Blob | $0.015/GB | minor unless huge libraries |

**Conclusion:** infra is ~$100–150/mo; **AI media generation is 5–15× that and scales with every click.** Therefore: (a) **credit ledger** debited per generation with refund-on-failure, (b) **Arcjet token-bucket** per user to hard-cap spend, (c) **Quaestor** budget governor extended to media, (d) cache/reuse generated assets aggressively.

---

## 8. Sources
- Video: [Build 3 Full Stack AI SaaS Apps with Next.js, React & AI | Mega Tutorial — TubeGuruji](https://www.youtube.com/watch?v=rcEUVADmH2g)
- [Zernio — Social Media & Messaging API](https://zernio.com/) · [docs](https://docs.zernio.com/)
- [Arcjet — JS/TS security SDK](https://github.com/arcjet/arcjet-js) · [rate limiting](https://docs.arcjet.com/rate-limiting/quick-start) · [bot protection](https://docs.arcjet.com/bot-protection/quick-start/)
- [Luma Dream Machine API pricing](https://lumalabs.ai/pricing) · [eesel: Luma AI pricing 2026](https://www.eesel.ai/blog/luma-ai-pricing)
- [Trigger.dev](https://trigger.dev) · [Inngest](https://www.inngest.com) (alternative)
- InsForge BaaS (MCP + skill available in this workspace)

## Changelog
- **2026-06-26 (v2, run #1)** — Created from the TubeGuruji 3-app media-gen tutorial. Established the text→media angle shift, the repo-vs-video stack comparison, the full new-tech list, the Vercel + Trigger.dev deployment topology (with the additional services it requires), a 7-wave adoption roadmap mapped to existing seams, open decisions, and a cost model. Does not alter the v5 product status in `docs/MASTER_PLAN.md`.
