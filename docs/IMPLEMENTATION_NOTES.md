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
