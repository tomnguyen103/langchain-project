# SocialFlow — Fix Plan Implementation Notes

Running log of decisions, deviations, and tradeoffs while executing
[`docs/FIX_PLAN.md`](./FIX_PLAN.md). Newest entries at the bottom of each goal.

> Audience: the project owner. This captures things that were **not** spelled out
> in the spec — judgment calls, changes I had to make, and anything worth knowing
> for review or future work.

## Conventions / ground rules I'm following

- **Workflow per goal** (from the plan + project memory): branch off latest `main`
  → implement → local gates green (`lint`, `typecheck`, `test`, `build`) → push →
  open **non-draft** PR → drive CodeRabbit + CI to clean/green → **merge to main**
  (end-of-goal merges are authorized for this project) → rebase next goal on main.
- **CI uses `npm install`, not `npm ci`** (Windows-authored lockfile can't record
  Linux esbuild optional binaries — npm/cli#4828).
- **CI/local build** runs with placeholder secrets; every new required env var gets
  a CI placeholder in `.github/workflows/ci.yml` and an entry in `.env.example`.
- New unit-test files must be added to the `test` script in `package.json` so CI
  actually runs them (the script names files explicitly, no glob).
- Keep each PR scoped to its goal; no opportunistic unrelated fixes.

## Starting state

- Goals **1 and 2 already merged** (PRs #13, #14) before this session.
- Baseline on `main`: gates green (verified at session start).
- Executing Goals **3 → 10** in order.

---

<!-- Per-goal entries appended below as work proceeds. -->

## Goal 3 — Schedule future-time validation (M8)

**Branch:** `claude/fix-goal-3-schedule-validation`

**What I built**
- New shared helper `lib/utils/schedule.ts`:
  - `assertFutureDate(value, now?)` — server guard, throws a user-facing Error
    ("Choose a valid date and time." / "Choose a time in the future."), returns
    the parsed `Date`.
  - `isFutureDate(value, now?)` — client, non-throwing boolean for pre-submit checks.
  - `toDatetimeLocalValue(date)` — formats a `Date` to the `YYYY-MM-DDTHH:mm`
    string a `datetime-local` input needs.
  - `SCHEDULE_GRACE_MS = 60_000` — the clock-skew grace window.
- Server guards: `createPost` (create/actions.ts) and `reschedulePost`
  (posts/actions.ts) now call `assertFutureDate`. Both reschedule entry points
  (post-detail input **and** calendar drag-drop) flow through `reschedulePost`,
  so one server change covers both.
- Client: `min` attribute + pre-submit `isFutureDate` toast in the composer
  (`schedule-picker.tsx` + `composer.tsx`), post-detail reschedule, and a
  client guard in the calendar drag handler.
- Unit test `lib/utils/schedule.test.ts` (wired into the `test` npm script).

**Decisions / deviations not spelled out in the spec**
- **`min` via render + `suppressHydrationWarning`, not `useEffect`+`setState`.**
  My first pass set `min` after mount with an effect to avoid an SSR/CSR
  hydration mismatch (server clock vs client clock produce different minute
  strings). The repo's React 19 ESLint config rejects that with
  `react-hooks/set-state-in-effect`. Switched to computing `min` during render
  and adding `suppressHydrationWarning` to the input — the mismatch is expected
  and harmless (it's a UX floor only; the server is the real guard). This keeps
  it effect-free and lint-clean, and `min` stays fresh on every render.
- **Consolidated duplicated formatters.** The composer's `defaultScheduleLocal`
  and post-detail's `toLocalInput` each hand-rolled the same datetime-local
  formatting; both now delegate to `toDatetimeLocalValue`. Not strictly required
  by M8, but directly serves its "single shared helper to avoid drift" intent.
- **Added a client guard to the calendar drag-drop too.** The spec only requires
  the server guard there (and it's present via `reschedulePost`), but a cheap
  `isFutureDate(next)` check before the call avoids a pointless round-trip when
  someone drags a chip to a past day.
- **Added a test now (Goal 3), not deferred to Goal 6.** It only covers the new
  helper, so it's in-scope for this PR and locks the grace-window behavior.

**Tradeoffs**
- `min` is a minute-granularity hint and can momentarily go stale between renders;
  the authoritative checks are `isFutureDate` at submit and `assertFutureDate`
  on the server, so this is acceptable.

**Gates:** lint ✓ · typecheck ✓ · test ✓ (34) · build ✓
**Merged:** PR #16 (squash, `601e83b`).

## Goal 4 — Reply rate-limit race hardening (M2)

**Branch:** `claude/fix-goal-4-reply-race`

**The race:** `reply.ts` read cooldown/cap counts, *then* claimed + posted. With
Reply-worker concurrency 5, two jobs for different comments matching the same
rule could both pass the check (neither had set `replied` yet) and both post,
exceeding `maxPerDay` / violating cooldown.

**What I built (plan option a — atomic DB counter)**
- New table `auto_reply_slots` (one row per rule): `periodStart` (UTC day),
  `usedCount`, `lastReplyAt`. Migration `0008_natural_morph.sql`.
- `grantReplySlot(ruleId, limits, now)` in `lib/repos/replies.ts`: a single
  `INSERT … ON CONFLICT (rule_id) DO UPDATE … setWhere(cap AND cooldown)`
  upsert. Because all of a rule's grants target the **same row**, the Postgres
  row lock serializes concurrent jobs — only one can take the last slot. Mirrors
  the existing `consumeUsage` idiom exactly.
- `releaseReplySlot(...)`: decrements (floored at 0) to roll back a slot when the
  reply isn't posted (claim lost / empty / post failed).
- `worker/processors/reply.ts` rewired: grant-first (before compose & claim);
  every non-posting path calls `releaseSlot()`.
- Removed the now-dead raceable primitives `countRepliesForRuleSince` and
  `lastReplyAtForRule`.
- Pure policy module `lib/auto-reply/slot.ts` (`evaluateReplySlot`,
  `isUnlimited`, `utcDayStart`) + `lib/auto-reply/slot.test.ts` (wired into the
  test script), including the "two concurrent at maxPerDay=1 → exactly one"
  scenario modeled as the DB's serialized application.

**Decisions / deviations not in the spec**
- **Why option (a), not a `SELECT … FOR UPDATE` lock or a Redis lock.** The
  worker is still on the **neon-http driver** (no interactive transactions until
  Goal 5), so a read-then-conditional-write lock isn't available. A single-row
  conditional upsert is atomic on neon-http *and* cross-instance safe (the
  row lock works regardless of how many worker processes run). This is strictly
  more robust than an in-process mutex, which would only cover one worker process.
- **Cap semantics changed from rolling-24h → UTC calendar day.** The old code
  counted `replied` rows in a rolling `now-24h` window; a counter needs a fixed
  period. UTC-day matches the billing `usage` table's period model. Documented
  as a deliberate change. Cooldown is unaffected (it uses `lastReplyAt`, which is
  period-independent, so it's still correct across midnight).
- **Counter is decoupled from `comment_events`.** The cap now counts *granted
  slots*, not posted replies. Trade-off: if the worker crashes between grant and
  post, that slot leaks until the next UTC day (bounded). This biases toward
  *under*-replying on crash — the safe direction (the original bug was
  *over*-replying).
- **`releaseReplySlot` does not restore `lastReplyAt`.** We can't recover the
  prior value, and leaving it only means a failed attempt may delay that rule's
  next reply by up to `cooldownSec` (conservative; the retry is not dropped).
- **Dual encoding (pure fn + SQL).** The atomic guarantee lives in Postgres and
  can't be unit-tested without a real DB, so `evaluateReplySlot` is a pure
  reference implementation the tests exercise; it must stay in lockstep with the
  upsert (cross-referenced in comments). Accepted to keep CI hermetic (Goal 6's
  remit).

**Do not break — preserved:** `claimReply`/`finalizeReply`/`releaseReply` lease
state machine + idempotency; "`replied` only set on confirmed success".

**Gates:** lint ✓ · typecheck ✓ · test ✓ (46) · build ✓
**Merged:** PR #18 (squash, `6d7cd9e`). CodeRabbit: rate-limited (no review) — see note above.

## Goal 5 — Worker pooled DB driver (M3)

**Branch:** `claude/fix-goal-5-worker-db-pool`

**Goal:** the always-on worker issues many sequential queries per job; the
neon-http driver pays an HTTPS round-trip per query. Give the worker a pooled
WebSocket connection while the serverless app keeps the stateless HTTP driver.

**What I built**
- `db/index.ts` selects the driver from `DB_DRIVER`: `pool` ⇒
  `drizzle-orm/neon-serverless` over a `Pool`; otherwise `neon-http` (default).
  One shared `db` type (`NeonHttpDatabase`) so all repos stay driver-agnostic.
- `closeDbPool()` — closed in the worker's SIGTERM/SIGINT handler after workers stop.
- `worker/load-env.ts` sets `neonConfig.webSocketConstructor = ws` and defaults
  `DB_DRIVER=pool` (host can override) before `db` is constructed.
- `DB_DRIVER` added to `lib/env.ts` + `.env.example`. Added `ws`/`@types/ws` deps.

**The hard part — `db.batch()` vs `.transaction()` (the thing the spec told me to verify)**
- The two drivers are **mutually exclusive**: `neon-http` has `.batch()` but no
  interactive transactions; `neon-serverless` has `.transaction()` but no
  `.batch()`. The worker's research processor calls `replaceIdeasForTopic`,
  which used `db.batch()` — so a naive driver swap would break it at runtime.
- Both batch sites (`createPostWithTargets`, `replaceIdeasForTopic`) use
  **independent** statements (ids are pre-generated), so I unified them behind a
  new **`runAtomicWrite(build)`** helper in `db/index.ts`: `.batch()` on HTTP,
  an interactive `.transaction()` on the pool. `build` receives the executor so
  the pooled path binds statements to the `tx` (not the auto-commit connection).

**Decisions / deviations not in the spec**
- **Process-env driver flag, not repo dependency-injection.** The plan offered
  "env flag" or "inject db into repos." The env flag (selected once in
  `db/index.ts`) needs **zero** repo changes — every repo importing `db` gets the
  right driver per process. Far smaller blast radius than threading a `db` arg
  through every repo function.
- **`ws` is imported worker-only** (`worker/load-env.ts`), not in `db/index.ts`,
  so the Next app bundle never pulls it in. `neonConfig` is global, so setting
  the constructor there still configures the pool built later in `db/index.ts`.
- **One `db` type via a cast.** The pooled client is cast to `NeonHttpDatabase`
  so `db` has a single type. Safe: the worker only uses the shared query builder
  + `runAtomicWrite` (which uses `.transaction()` on the pool, never `.batch()`),
  so `.batch()` is never called on the pooled instance at runtime.
- **Worker defaults to `pool`.** Delivers the perf win out of the box; the host
  can set `DB_DRIVER=http` to fall back. App is unaffected (driver unset ⇒ http).

**Do not break — preserved:** app keeps the stateless HTTP driver; all repo
signatures unchanged; `createPostWithTargets` atomicity holds on both drivers
(batch on HTTP, transaction on pool).

**Runtime note:** the pooled path is code-verified only (lint/typecheck/test/
build). Live worker verification (WebSocket pool against real Neon) is deferred
with the rest of go-live, per this project's norm.

**Gates:** lint ✓ · typecheck ✓ · test ✓ (46) · build ✓

> ⚠️ **CodeRabbit rate limit (heads-up for you).** By PR #18, CodeRabbit hit its
> per-developer review rate limit (today's burst across PRs #13–#18 tripped the
> adaptive limiter; resets ~35 min). Its green "CodeRabbit" status check can pass
> *without an actual review* in this state. PR #18 (Goal 4) was therefore merged
> on **CI-green + my own full self-review** (full diff read, 46 tests, all 4
> gates) per this project's merge-on-green norm. For the remaining goals I'm
> pacing the work so the limit resets between PRs and CodeRabbit can review them;
> I note each goal's actual review status below.
>
> Status: Goals 4 (#18) and 5 (#19) merged CI-green; CodeRabbit was rate-limited
> for both, so neither got a bot review — both had a full manual self-review.

## Goal 6 — Backend test coverage (M4)

**Branch:** `claude/fix-goal-6-backend-tests` · **23 → 83 tests** (+60).

**New tests**
- `lib/utils/crypto.test.ts` — AES-GCM round-trip, fresh-IV, tampered tag/iv/
  ciphertext, version mismatch, malformed payload, `encryptNullable`.
- `lib/webhooks/comments.test.ts` — FB `feed` + IG `comments` extraction,
  ignored non-comment events, author/post-id fallbacks, multi-entry.
- `lib/billing/period.test.ts` — daily/monthly UTC period keys, padding,
  day/year boundaries.
- `lib/queue/job-ids.test.ts` — id determinism, per-queue prefixes, uniqueness.
- `lib/queue/with-ledger.test.ts` — success path + **rollback on enqueue
  failure** + original error preserved when rollback also throws.
- `lib/posts/status.test.ts` — all rollup transitions (draft/published/failed/
  partially_published/publishing/scheduled).
- Reply rate-limit guard: already covered by `lib/auto-reply/slot.test.ts` (Goal 4).

**Decisions / deviations not in the spec**
- **Small pure-extraction seams (touches a few source files, not "tests only").**
  Most target functions were private and coupled to db/Clerk/Redis, so importing
  them in a hermetic test was impossible. The plan explicitly anticipated this
  ("thin db seam", "inject a failing queue"), so I extracted **behavior-preserving
  pure modules**: `lib/webhooks/comments.ts`, `lib/billing/period.ts`,
  `lib/queue/job-ids.ts`, `lib/queue/with-ledger.ts`, `lib/posts/status.ts`. The
  original call sites import from them; runtime behavior is unchanged (build +
  existing flows verify).
- **`enqueueWithLedger` helper.** Rather than mock Redis, I extracted the
  record→enqueue→rollback orchestration shared by `enqueuePublish`/
  `enqueueResearch` into a pure helper and tested rollback by injecting a
  throwing `enqueue`. Bonus: DRYs two call sites.
- **`consumeUsage` atomicity — tested via `periodStartFor` (the plan's "at
  minimum").** The atomic conditional upsert is enforced by Postgres and can't be
  unit-tested without a DB; the Goal 4 slot logic already demonstrates that
  conditional-upsert pattern's decision semantics hermetically.
- **crypto test env via a side-effect setup module.** `crypto.ts` derives its key
  from env at import; tsx compiles tests to **CJS** (no top-level await), so
  `lib/utils/crypto-test-setup.ts` sets env and is imported *before* `./crypto`.
- **Observation (not fixed here):** `crypto.ts`'s docstring says a 3-part format
  but the payload is 4-part (`v1:iv:tag:ciphertext`). Out of scope for a test PR.

**Do not break — preserved:** CI stays fast + hermetic (no real Redis/DB/network);
every new test file is wired into the `test` npm script.

**Gates:** lint ✓ · typecheck ✓ · test ✓ (83) · build ✓
