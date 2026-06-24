> Archived 2026-06-24. Superseded by docs/MASTER_PLAN_v2.md.

# SocialFlow — Remediation Fix Plan

Derived from the full project review. **25 findings** (H1–H4, M1–M10, L1–L11) are grouped into
**10 sequential goals**. Each goal is a self-contained `/goal` prompt with internal tasks, a
"do not break" guard rail, and a Definition of Done that ends in a merged PR.

---

## Priority & coverage matrix

| Goal | Title | Findings covered | Severity peak | Blast radius |
|---|---|---|---|---|
| 1 | Unblock comment webhooks + reconcile health endpoint | H1, M5 | High | 1 file (`proxy.ts`) |
| 2 | Quota integrity (consume-on-success / atomic enqueue) | M1, L1 | Medium | billing + 2 routes |
| 3 | Schedule future-time validation (client + server) | M8 | Medium | composer + 2 actions |
| 4 | Reply rate-limit race hardening | M2 | Medium | reply pipeline |
| 5 | Worker pooled DB driver (performance) | M3 | Medium | `db/` (core) |
| 6 | Backend test coverage | M4 | Medium | tests only |
| 7 | SEO/metadata + typography + docs | H2, H3, L3, L4 | High | config + marketing |
| 8 | Accessibility pass | H4, M9, M10, L7, L8 | High | many components |
| 9 | Calendar mobile + reschedule a11y | M6, M7 | Medium | calendar |
| 10 | Cleanup nits | L2, L5, L6, L9, L10, L11 | Low | scattered |

**Run order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10.**

### Why this order (don't break main logic)
- **1 first** — one-file matcher change, no logic risk, restores a dead feature. Doing it first means
  every later branch rebases onto a main where webhooks already work.
- **2 → 3** are adjacent because both touch `app/(dashboard)/create/actions.ts`. Running them
  back-to-back (rebase 3 onto merged 2) avoids a merge conflict in that file.
- **4, 5** are backend-isolated (reply pipeline; DB driver). **5 touches core `db/`**, so it runs only
  after the other backend logic (2–4) is settled and on main.
- **6 (tests) runs after all backend logic (1–5) is final**, so tests encode the *fixed* behavior and
  lock it before any frontend churn.
- **7 → 8 → 9** are frontend/config, ordered low-risk → cross-cutting → feature work. **8 before 9**
  because the a11y pass establishes the skip-link/focus patterns the calendar rework should follow.
- **10 last** — cosmetic nits, bundled into one PR to minimize review overhead.

---

## Standard workflow (applies to every goal)

Each goal is one branch → one PR → one merge. The Definition of Done in every goal is:

1. Develop on the goal's feature branch (named in the goal).
2. **CI must be green locally before pushing:** `npm run lint && npm run typecheck && npm run test && npm run build`.
3. `git push -u origin <branch>` (retry on network error: 2s/4s/8s/16s backoff).
4. Open a PR to `main` (do **not** merge yet).
5. **Wait for CodeRabbit review.** Read every finding.
6. Apply actionable CodeRabbit fixes; reply to any suggestion that is wrong/not-applicable with the reason.
7. Re-run CI; once green and review is clean, **merge to `main`** (squash).
8. Only then start the next goal (rebase its branch on the freshly merged `main`).

> Keep each PR scoped to its goal's findings. Do not opportunistically fix unrelated items —
> that's what the later goals are for, and it keeps the blast radius small.

---

## Goal 1 — Unblock comment webhooks + reconcile health endpoint

```
/goal Goal 1 — Unblock comment webhooks and reconcile the queue-health endpoint

Covers: H1, M5
Branch: claude/fix-goal-1-webhooks
Run order: 1 of 10 — no dependencies.

Context:
The Clerk middleware (proxy.ts) protects every /api/* route except a small public allow-list.
The Meta comment webhook (app/api/webhooks/comments/[provider]/route.ts) is NOT on that list, so
auth.protect() rejects Meta's unauthenticated handshake (GET) and event delivery (POST) before they
reach the handler — the HMAC verifySignature() is dead code behind the gate, and the webhook can't
even be registered in Meta's dashboard. Separately, app/api/health/queues advertises itself as an
uptime probe but is also behind auth, so monitors can't reach it.

Tasks:
1. In proxy.ts, add "/api/webhooks(.*)" to the createRouteMatcher public-route list so webhook
   requests bypass Clerk auth. The webhook's own HMAC signature check (x-hub-signature-256) remains
   the security boundary — verify that logic still runs and rejects bad signatures with 401.
2. Decide and implement access for /api/health/queues:
   - Preferred: keep it auth-gated but add a separate lightweight, public liveness probe is already
     /api/health; OR gate /api/health/queues behind an optional HEALTH_CHECK_TOKEN bearer check and
     add "/api/health(.*)" to the public matcher. Choose the token approach so queue depths aren't
     exposed publicly, and add HEALTH_CHECK_TOKEN (optional) to lib/env.ts + .env.example.
   - If a token is set, require it; if unset, fall back to current auth behavior. Update the route's
     docstring so it matches reality.
3. Manually reason through / add a unit test for verifySignature in the webhook route (valid sig
   passes, tampered body fails, missing header fails) — this is cheap and guards the now-public route.

Do not break:
- Dashboard/API auth for every other route must stay enforced. Only webhooks (and optionally the
  token-guarded health endpoint) become reachable without a Clerk session.

Definition of Done: see "Standard workflow" — CI green, push, PR, CodeRabbit, apply fixes, merge to main.
```

---

## Goal 2 — Quota integrity (consume-on-success / atomic enqueue)

```
/goal Goal 2 — Make quota consumption fair and post creation atomic

Covers: M1, L1
Branch: claude/fix-goal-2-quota-integrity
Run order: 2 of 10 — start after Goal 1 is merged.

Context:
- M1: /api/generate consumes the ai_generations quota BEFORE runContentAgent, and never refunds it if
  generation fails (LLM error/timeout). On Free (5/month) a failed run still burns a unit.
- L1: createPost (app/(dashboard)/create/actions.ts) consumes posts quota and creates the post+targets,
  then enqueues publish jobs in a loop. If enqueuePublish throws mid-loop, the post and quota are
  committed but some targets are never scheduled.

Tasks:
1. Add a refund/release helper to lib/repos/usage.ts, e.g. releaseUsage(userId, metric, periodStart)
   that decrements count (floored at 0) for the current period, and expose releaseQuota(userId, metric)
   from lib/billing/entitlements.ts mirroring periodFor().
2. In app/api/generate/route.ts, wrap runContentAgent so that on thrown error (after a successful
   consumeQuota) the ai_generations unit is released before returning 500. Keep the 429 path unchanged.
3. In createPost (create/actions.ts), make the publish enqueue resilient: either (a) enqueue all targets
   and, on any failure, mark the affected targets as "failed"/needs-attention with lastError so they
   surface in the dashboard, or (b) wrap the loop so a failure releases the posts_scheduled unit and
   surfaces a clear error. Prefer (a) — the post still exists, no target is silently lost.
4. Confirm the atomic consumeUsage (setWhere count < limit) semantics are untouched.

Do not break:
- The atomicity guarantee of consumeUsage. The 429 (QuotaExceededError) behavior and messages.

Definition of Done: see "Standard workflow".
```

---

## Goal 3 — Schedule future-time validation (client + server)

```
/goal Goal 3 — Reject past scheduling times on client and server

Covers: M8
Branch: claude/fix-goal-3-schedule-validation
Run order: 3 of 10 — start after Goal 2 is merged (both touch create/actions.ts; rebase on main first).

Context:
datetime-local inputs (components/composer/schedule-picker.tsx, components/posts/post-detail.tsx) have
no `min` and no future-time check. createPost only checks the date parses, not that it's in the future,
and enqueuePublish does delay = max(0, ...), so a past time publishes immediately — a UX trap that
produces surprise/instantly-failing posts.

Tasks:
1. Add a `min` attribute (current local datetime) to both datetime-local inputs and a small client-side
   guard that blocks submission with a clear toast if the chosen time is in the past.
2. In createPost (create/actions.ts), reject scheduledAt that is in the past (allow a small grace window,
   e.g. now - 60s, to tolerate clock skew) with a clear thrown Error.
3. Apply the same server-side guard to the reschedule action used by post-detail.tsx (and the calendar
   reschedule action if present) so every scheduling entry point is covered.
4. Keep a single shared validation helper (e.g. lib/utils/schedule.ts assertFutureDate) used by all
   call sites to avoid drift.

Do not break:
- Existing default (+1h) behavior. Legitimate "publish ~now" within the grace window must still work.

Definition of Done: see "Standard workflow".
```

---

## Goal 4 — Reply rate-limit race hardening

```
/goal Goal 4 — Make auto-reply cooldown and daily-cap enforcement race-safe

Covers: M2
Branch: claude/fix-goal-4-reply-race
Run order: 4 of 10 — backend-isolated; start after Goal 3 is merged.

Context:
worker/processors/reply.ts checks cooldownSec and maxPerDay by reading counts, THEN claims the comment
(claimReply) and posts. With Reply worker concurrency 5, two jobs for different comments matching the
same rule can both pass the cap/cooldown check and both post, slightly exceeding maxPerDay. claimReply
correctly prevents double-posting a single comment; this is a cross-comment rate race only.

Tasks:
1. Enforce cooldown/cap atomically with the claim. Options (pick one, document the choice):
   a) Add a per-rule guard in the DB: a single conditional UPDATE/INSERT that increments a rule-scoped
      counter for the current period only when under maxPerDay and outside cooldown, returning whether
      the slot was granted — claim the reply only if granted.
   b) Serialize per-rule dispatch (e.g. a short Redis lock / BullMQ rate-limiter group keyed by ruleId)
      so cap/cooldown reads-then-writes can't interleave.
2. Ensure a failed post (releaseReply) also rolls back any slot/counter consumed in step 1, so retries
   aren't starved.
3. Add a focused test simulating two concurrent matched comments for the same rule at maxPerDay=1 →
   exactly one reply posts.

Do not break:
- The existing lease-based claimReply / finalizeReply / releaseReply state machine and idempotency.
- The "replied is only set on confirmed success" invariant.

Definition of Done: see "Standard workflow".
```

---

## Goal 5 — Worker pooled DB driver (performance)

```
/goal Goal 5 — Give the long-running worker a pooled Postgres connection

Covers: M3
Branch: claude/fix-goal-5-worker-db-pool
Run order: 5 of 10 — touches core db/; start after Goals 1–4 are merged so backend logic is settled.

Context:
db/index.ts uses Neon's HTTP driver (neon-http) for BOTH the Vercel app and the always-on BullMQ worker.
HTTP is ideal for serverless but issues one HTTPS round-trip per query; the worker runs many sequential
queries per job (e.g. comment-poll: watermark + ingest + update per comment), so latency compounds. A
pooled TCP/WebSocket driver (Pool + drizzle-orm/neon-serverless) would materially cut per-job latency.

Tasks:
1. Introduce a worker-oriented pooled client WITHOUT changing the app's behavior. Recommended: keep the
   exported `db` (neon-http) as-is for the app, and add a pooled variant used only by the worker entry
   (worker/index.ts) — e.g. db/pool.ts exporting a drizzle client over Pool from @neondatabase/serverless,
   selected via an env flag (DB_DRIVER=pool) or by the worker importing the pooled client directly.
2. Ensure the same drizzle schema and repo functions work unchanged against the pooled client (repos
   import `db` — consider a small indirection so the worker process binds repos to the pooled client,
   or make repos accept an injected db; keep the change minimal and type-safe).
3. Add graceful pool shutdown to the worker's existing SIGTERM/SIGINT handler (close the pool alongside
   the BullMQ workers).
4. Verify drizzle batch()/transaction semantics used by createPostWithTargets still hold on the pooled
   driver.

Do not break:
- The Vercel app must keep using the stateless HTTP driver (no long-lived sockets on serverless).
- All existing repo function signatures/behavior. db.batch atomicity for createPostWithTargets.

Definition of Done: see "Standard workflow".
```

---

## Goal 6 — Backend test coverage

```
/goal Goal 6 — Add tests for the highest-risk backend logic

Covers: M4
Branch: claude/fix-goal-6-backend-tests
Run order: 6 of 10 — run after backend Goals 1–5 are merged so tests encode final behavior.

Context:
Only 4 test files exist (pure utils) for 168 source files. The riskiest logic is untested.

Tasks (add unit tests under the existing tsx --test harness; wire new files into the package.json "test"
script):
1. Crypto round-trip (lib/utils/crypto.ts): encrypt→decrypt identity; tampered tag/iv/ciphertext throws;
   version mismatch throws; encryptNullable handles null/undefined.
2. Webhook signature + extraction (app/api/webhooks/comments): valid sig passes, tampered fails, missing
   header fails; extractComments parses a representative FB `feed` and IG `comments` payload.
3. Usage atomicity (lib/repos/usage.ts consumeUsage): conditional increment respects the limit (mock/in-
   memory or a thin db seam). At minimum test the periodFor() boundary math in entitlements.ts.
4. Queue job-id determinism + rollback (lib/queue/jobs.ts): publishJobId is stable per target;
   enqueuePublish rolls back the schedule ledger when the queue add throws (inject a failing queue).
5. Post status rollup (recomputePostStatus/derivePostStatus in lib/repos/posts.ts): all/partial/failed/
   publishing transitions.
6. Reply rate-limit guard from Goal 4 (if not already added there).

Do not break:
- Keep CI fast and hermetic (no real Redis/DB/network in unit tests — use seams/mocks). Update the
  "test" npm script to include every new file so CI actually runs them.

Definition of Done: see "Standard workflow".
```

---

## Goal 7 — SEO/metadata + typography + docs

```
/goal Goal 7 — Fix marketing typography, social metadata, and stale docs

Covers: H2, H3, L3, L4
Branch: claude/fix-goal-7-seo-typography
Run order: 7 of 10 — low logic risk; start after Goal 6 is merged.

Context:
- H2: Legal pages use `prose dark:prose-invert` but @tailwindcss/typography is not installed/imported,
  so the classes are no-ops — real legal copy will render unstyled.
- H3: app/layout.tsx sets only title/description — no metadataBase, openGraph, twitter, or OG image.
- L3: README.md is default create-next-app boilerplate.
- L4: docs/PLAN.md claims generate "streams" but /api/generate returns JSON (generate-panel uses fetch).

Tasks:
1. Install @tailwindcss/typography and enable it for Tailwind v4 (add `@plugin "@tailwindcss/typography";`
   in app/globals.css). Verify the legal pages render styled prose in light and dark.
2. In app/layout.tsx, add metadataBase (from NEXT_PUBLIC_APP_URL), openGraph and twitter metadata, and
   add a default OG image + icons (app/opengraph-image, app/icon / apple-icon). Confirm a marketing page
   produces a valid preview.
3. Rewrite README.md to describe SocialFlow: what it is, the app/worker split, required env vars (link
   .env.example), local dev (app + worker + migrations), and a pointer to docs/PLAN.md and docs/ROADMAP.md.
4. Fix the docs/PLAN.md streaming claim to match reality (generate returns JSON), OR file it as a future
   enhancement — just remove the inaccuracy.

Do not break:
- Existing global styles/tokens in globals.css. The static-rendering of marketing pages (HeaderAuth split).

Definition of Done: see "Standard workflow".
```

---

## Goal 8 — Accessibility pass

```
/goal Goal 8 — Close accessibility gaps across the app shell and forms

Covers: H4, M9, M10, L7, L8
Branch: claude/fix-goal-8-a11y
Run order: 8 of 10 — start after Goal 7 is merged.

Context:
- H4: Mobile nav Sheet (components/shared/topbar.tsx) has no SheetDescription/aria-describedby (Radix
  a11y warning + no SR description).
- M9: Composer "Publish to" checkboxes lack group semantics (no fieldset/legend or role=group +
  aria-labelledby) — components/composer/composer.tsx.
- M10: No skip-to-content link; <main> not focusable/labeled — app/(dashboard)/layout.tsx and
  app/(marketing)/layout.tsx.
- L7: components/composer/media-uploader.tsx uses raw <img> with generic alt for ImageKit thumbnails.
- L8: research-form.tsx, discord-connect-form.tsx, rule-form.tsx are non-<form> divs with hand-wired
  Enter handling, inconsistent with the correct <form action> in account-card.tsx.

Tasks:
1. Add a SheetDescription (visually-hidden if needed) to the Topbar mobile nav Sheet.
2. Wrap the composer platform checkboxes in a fieldset/legend (or role="group" + aria-labelledby tied to
   the "Publish to" label).
3. Add a "Skip to main content" link in both layouts and give <main> id="main-content" + tabIndex={-1}.
4. Convert media-uploader thumbnails to next/image with meaningful per-item alt text (or document the
   deliberate <img> choice and at least improve alt). Ensure remote ImageKit host is allowed in
   next.config if next/image is used.
5. Convert research-form, discord-connect-form, and rule-form to real <form onSubmit>/<form action>
   elements so Enter and SR semantics work natively; remove the manual onKeyDown shims.

Do not break:
- Existing submit handlers / server actions wiring. Keyboard Enter must still submit each converted form.

Definition of Done: see "Standard workflow".
```

---

## Goal 9 — Calendar mobile + reschedule accessibility

```
/goal Goal 9 — Make the calendar usable on mobile and reschedule accessible

Covers: M6, M7
Branch: claude/fix-goal-9-calendar
Run order: 9 of 10 — feature work; start after Goal 8 is merged (reuse its skip-link/focus patterns).

Context:
- M6: components/calendar/calendar-grid.tsx is always grid-cols-7 with min-h-24; on phones each cell is
  ~50px so chips are fully truncated — the core feature is near-unusable on mobile.
- M7: Reschedule (components/calendar/post-chip.tsx + calendar-grid.tsx) is HTML5 drag-only: no keyboard
  path and no touch support; keyboard/mobile users can only reschedule via post-detail (not discoverable).

Tasks:
1. Add a responsive layout for small screens: below `sm`, render an agenda/week list (or horizontally
   scrollable grid) instead of the 7-col month grid; keep the desktop month grid unchanged.
2. Add an accessible reschedule path that doesn't rely on native DnD: e.g. a per-chip action (button/menu)
   that opens a date/time picker to move the post, wired to the same reschedule server action used by
   post-detail. Ensure it's keyboard-operable and works on touch.
3. Keep the existing drag-and-drop for mouse users, but ensure the new path is the documented/primary
   one for keyboard/touch. Add aria labels to chips describing the post + scheduled time.
4. Reuse the future-time validation helper from Goal 3 for calendar reschedules.

Do not break:
- Existing desktop drag-to-reschedule. The reschedule server action contract (no double-publish, jobId
  reschedule via cancelPublish + enqueuePublish).

Definition of Done: see "Standard workflow".
```

---

## Goal 10 — Cleanup nits

```
/goal Goal 10 — Resolve remaining low-severity nits in one pass

Covers: L2, L5, L6, L9, L10, L11
Branch: claude/fix-goal-10-cleanup
Run order: 10 of 10 — last; bundle these low-risk items into a single PR.

Context & tasks (each independent; keep them in one PR):
1. L2 — CLERK_WEBHOOK_SIGNING_SECRET is declared (lib/env.ts, .env.example) but unused (no Clerk webhook
   handler). Either implement a /api/webhooks/clerk handler (verify via svix) for user/org sync, OR remove
   the unused env var and its .env.example/PLAN references. Pick one and document it.
2. L5 — lib/queue/jobs.ts enqueuePublish uses removeOnFail: false (unbounded Redis growth). Change to an
   age-capped retention (e.g. { age: 7 * 24 * 3600 }) consistent with other queues, preserving the
   dead-letter/"needs attention" behavior.
3. L6 — Rename the LangGraph node "analyze" to "digest" in lib/agent/graph.ts to match state.ts/PLAN, or
   align the docs — make the naming consistent either way.
4. L9 — components/composer/variant-editor.tsx stores a stale `active` tab masked by effectiveActive.
   Reconcile state (e.g. effect to reset active when platforms change, or derive entirely) so no stale id
   is held.
5. L10 — components/research/topic-list.tsx polls router.refresh() every 4s with no cap; add a max-attempts
   or backoff and stop polling for terminal statuses.
6. L11 — app/(dashboard)/dashboard/page.tsx "Need attention" merges failedTargets + unhealthy into one
   number; show a small breakdown or relabel so the headline matches the detail list.

Do not break:
- Any of the touched flows. These are cosmetic/robustness changes; verify build + the existing tests pass.

Definition of Done: see "Standard workflow".
```

---

## Quick reference — branches in run order

1. `claude/fix-goal-1-webhooks`
2. `claude/fix-goal-2-quota-integrity`
3. `claude/fix-goal-3-schedule-validation`
4. `claude/fix-goal-4-reply-race`
5. `claude/fix-goal-5-worker-db-pool`
6. `claude/fix-goal-6-backend-tests`
7. `claude/fix-goal-7-seo-typography`
8. `claude/fix-goal-8-a11y`
9. `claude/fix-goal-9-calendar`
10. `claude/fix-goal-10-cleanup`

Each: branch off the latest `main` → implement tasks → CI green → push → PR → CodeRabbit → apply fixes → merge to `main` → proceed to the next.
