# SocialFlow

**AI social-content automation.** Research a niche, generate platform-tailored
posts with an LLM, then schedule and auto-publish across every connected social
account - with a calendar, per-target retry/reschedule, engagement metrics, and
keyword/AI auto-replies to comments.

Connectors: **Facebook, Instagram** (Meta Graph), **LinkedIn, TikTok, Discord,
YouTube, Pinterest, X**. Non-Meta connectors are env-gated (hidden until their
credentials are set).

## Architecture

Two processes share one database (Neon/Postgres) and one queue broker
(Upstash Redis):

| Process | Runtime | Responsibility |
|---|---|---|
| **App** (`next`) | Serverless (Vercel) | UI, auth, server actions, API routes. Uses the stateless Neon **HTTP** driver. |
| **Worker** (`tsx worker/index.ts`) | Always-on (Railway/Render) | BullMQ processors: publish, comment-poll, reply, research, token-refresh. Uses a **pooled** Postgres driver (`DB_DRIVER=pool`). |

All scheduling lives in the worker via BullMQ **delayed jobs**, with a durable
`schedules` ledger for idempotency. Key building blocks:

- **Auth:** Clerk - **DB/ORM:** Neon + Drizzle (`db/`, migrations in `db/migrations/`)
- **Queue:** BullMQ + Upstash (`lib/queue/`, `worker/`)
- **AI:** LangGraph agent (Gemini default) -> `/api/generate` (returns JSON)
- **Media:** ImageKit (upload + URL transforms) - **Billing:** Clerk Billing + usage quotas

## Environment

Copy [`.env.example`](./.env.example) to `.env.local` (app) and set the same
variables on the worker host. Required: `DATABASE_URL`, `REDIS_URL`, Clerk keys,
`ENCRYPTION_KEY`, ImageKit keys, `META_APP_ID`/`META_APP_SECRET`. Everything else
(other platforms, LLM providers, LangSmith, Tavily, `HEALTH_CHECK_TOKEN`) is
optional and documented inline in `.env.example`.

## Local development

```bash
npm install

# 1. Apply database migrations (through the latest in db/migrations/)
npm run db:migrate

# 2. Run the app (http://localhost:3000)
npm run dev

# 3. In a second terminal, run the always-on worker
npm run worker        # or: npm run worker:dev  (watch mode)
```

Both processes need `.env.local`. The worker defaults to the pooled DB driver;
override with `DB_DRIVER=http` if needed.

## Checks

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test        # node:test unit tests (via tsx)
npm run build       # next build
```

CI runs all four on every PR (`.github/workflows/ci.yml`) with placeholder
secrets (`SKIP_ENV_VALIDATION=true`).

## Docs

- [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md) - single active source of truth.
- Older plans and condensed roadmap artifacts are preserved under [`docs/archive/`](./docs/archive/).
