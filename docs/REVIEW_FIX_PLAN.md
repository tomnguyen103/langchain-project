# Review Fix Plan (from the 2026-06-22 multi-axis review)

Prioritized remediation of the code-quality / security / performance / design findings. Batched into PRs of ≥3 fixes; each batch: local gates green → non-draft PR → CodeRabbit → fix → merge.

## PR-A — Critical (P0)
- **F-A1 — A2A endpoint hardening** (`app/api/a2a/route.ts`). Bind the A2A token to ONE configured tenant via `A2A_TENANT_ID` (ignore body-supplied `clerkUserId` → kills the impersonation vector, C-SEC-1); timing-safe bearer compare (I-SEC-2); scope `tasks/get` to the bound tenant (I-SEC-3).
- **F-A2 — Meta Graph pagination** (`lib/platforms/_meta-graph.ts:80`). Follow `paging.next` / advance on `cursors.after` alone so comments past a page boundary aren't dropped (C-CODE-1).
- **F-A3 — Comment-poll N+1 + index** (`worker/processors/comment-poll.ts`, `lib/repos/replies.ts`, `db/schema/comment-events.ts`). Batch comment inserts + bulk status update (C-PERF-1); add `(social_account_id, external_post_id)` index (C-PERF-2, migration).

## PR-B — Important: security + worker reliability (P1)
- **F-B1 — Media-URL SSRF** (`app/(dashboard)/create/actions.ts`, `lib/platforms/youtube.ts`). Validate media URL host against the ImageKit allowlist + `https` scheme in `saveUploadedMedia`; `redirect:"manual"` on the YouTube fetch (I-SEC-1).
- **F-B2 — ENCRYPTION_KEY** (`lib/utils/crypto.ts`). Validate key length unconditionally before deriving, independent of `SKIP_ENV_VALIDATION` (I-SEC-4).
- **F-B3 — Comment length cap** (`lib/auto-reply/match.ts` or ingestion). Cap comment text before non-regex matching (I-SEC-5).
- **F-B4 — Token-refresh** (`worker/processors/token-refresh.ts`). Only expire on a definitive auth failure (not transient errors); set a synthetic future expiry when a refresh returns none (I-CODE-2, I-CODE-3).
- **F-B5 — Publish account status** (`worker/processors/publish.ts`). Fail fast if `account.status !== "active"` before publishing (I-CODE-4).

## PR-C — Important: quota/correctness + indexes + reads (P1) — ✅ shipped
- **F-C2 — releaseReplySlot** (`lib/repos/replies.ts`). ✅ Decrement by `ruleId` only (floored at 0), NOT scoped to a recomputed `now` day key — a release that crosses UTC midnight from its grant now still refunds the slot (I-CODE-5). Caller `worker/processors/reply.ts` updated to drop the now-unused `now` arg.
- **F-C3 — Comment timestamp** (`lib/platforms/instagram.ts`, `facebook.ts`). ✅ Epoch sentinel `new Date(0)` instead of `new Date()` when a comment has no timestamp, so a timestamp-less comment can't push the poll watermark (`max(commentedAt)`) to the present (I-CODE-6).
- **F-C4 — Indexes** (`db/schema/social-accounts.ts`, `generated-content.ts`, migration `0020`). ✅ `social_accounts(status, tokenExpiresAt)`; `generated_content(clerkUserId, reviewStatus)` + `(agentRunId)` (I-PERF-1, I-PERF-2).
- **F-C5 — Bound list reads** (`lib/repos/content-reviews.ts`, `generated-content.ts`, `research.ts`). ✅ `limit = 100` default on `listPendingReviews`/`listGeneratedContent`/`listIdeas`/`listResearchTopics` (I-PERF-3).

### F-C1 — shipped in PR-F; F-C6 test added in PR-H
- **F-C1 — Quota refund on cancel** (I-CODE-1). ✅ SHIPPED in PR-F (its own coherent change, as planned). Two columns on `posts` make refunds idempotent and over-refund-proof: `scheduleQuotaPeriod` (the daily window the unit was consumed for; null = unmetered, e.g. agent-scheduled posts) and `scheduleQuotaHeld` (held vs refunded). `cancelTarget` refunds the exact period the moment a cancel fully retracts the post (`hasLiveTarget` false — nothing queued/publishing/published) via an atomic held→false claim (no double-refund). `reschedulePost`/`retryTarget` re-consume a previously-refunded post before re-activating it, closing the cancel→reschedule-for-free loophole. Agent posts (unmetered, `scheduleQuotaPeriod` null) are never touched.
- **F-C6 — Concurrency tests** (I-CODE-7). ✅ TEST WRITTEN (PR-H). `tests/integration/quota-concurrency.test.ts` exercises the atomic `onConflictDoUpdate … setWhere` race under genuine concurrency: N concurrent `consumeUsage`/`takeRateLimit` against a real Postgres must let through exactly the cap, and `releaseUsage` floors at 0. It is NOT a pure-logic stub — it needs a live DB, so it's excluded from `npm test` and run via `npm run test:integration` with a `DATABASE_URL`; with none set the suite SKIPS (CI stays green, no false failure). Authored + typechecked + verified to skip cleanly; the DB-connected assertions run when a throwaway Postgres is supplied (not executed in this environment, which has no live DB).

## PR-D — Backend perf + suggestions (P1/P2) — ✅ shipped
- **F-D1 — Publish parallelism** (`worker/processors/publish.ts`). ✅ The account + media reads run concurrently via `Promise.all` (independent, side-effect-free), shaving a round-trip off the publish hot path (I-PERF-4).
- **F-D3 — Suggestions** (all ✅):
  - **S-CODE-1** seeding test now asserts the configured `comment` is forwarded to every `interactWithPost` call (`lib/platforms/seeding.test.ts`).
  - **S-CODE-2** `releaseQuota` reports its own refund failures via `reportError` (`lib/billing/entitlements.ts`); the two callers (`api/generate`, `api/agents/run`) drop their now-redundant `.catch` — including the silent `.catch(() => {})` that hid the agents/run path.
  - **S-SEC-1** webhook GET verifies `hub.verify_token` with a constant-time `timingSafeEqual` (length-guarded), matching the A2A/health pattern (`app/api/webhooks/comments/[provider]/route.ts`).
  - **S-PERF-1** comment-poll enqueues replies with one `addBulk` round-trip via `enqueueCommentReplies` instead of a serial `add` per comment (`lib/queue/jobs.ts`, `worker/processors/comment-poll.ts`).
  - **S-PERF-2** the Topics list polls a narrow `listResearchTopicStatuses` (id + status only) via the `pollResearchStatuses` action and only triggers a full page refresh when a tracked run settles — instead of refreshing the whole RSC every 4 s (`lib/repos/research.ts`, `app/(dashboard)/research/actions.ts`, `components/research/topic-list.tsx`).

## PR-E — Landing-page design polish (P1/P2) — ✅ shipped
- **F-D2 — Landing hero** (`app/(marketing)/page.tsx`, `components/ui/button.tsx`). ✅ Replaced the div-based fake "product preview" (invented times/statuses) with an honest illustrative **agent pipeline** — the four stages a post moves through (research → draft → schedule → publish & reply), a labeled conceptual diagram rather than a faked screenshot (I-DES-1). ✅ Tightened the hero subtext from four sentences to two (S-DES-1). ✅ Dropped the literal "Step N" labels in *How it works* — the ordered grid already conveys sequence (S-DES-3). ✅ Added `active:scale-[0.98]` tactile feedback to every button (S-DES-5). Split out from PR-D so the design change gets its own focused review (code vs. design separation).

## PR-G — Remaining Suggestion-level findings (P2) — ✅ shipped
The lower-priority Suggestions the earlier batches scoped out. All that meet the "don't ignore taste when it affects a11y / security / perf / maintainability" bar are now done:
- **S-DES-4 — muted-foreground contrast** (`app/globals.css`). ✅ Darkened light-mode `--muted-foreground` `oklch(0.556→0.53)` so muted text clears WCAG AA 4.5:1 on `--muted`/`--secondary`/`--accent` surfaces (it dipped to ~4.34:1). Dark mode already passed.
- **S-SEC-2 — nesting-aware ReDoS guard** (`lib/auto-reply/regex-guard.ts`). ✅ Replaced the single-paren-level regexes with a stack-based scan that catches catastrophic shapes at any depth (`((a+))+`, `((a|b)+)+`) and fails closed on malformed patterns — without over-rejecting bounded reps like `(\d{3})+`. Tests added.
- **S-SEC-3 — PKCE key separation** (`lib/utils/crypto.ts`, `lib/oauth/providers/x.ts`). ✅ New `deriveSubKey` (HKDF) gives the X OAuth PKCE HMAC its own key instead of reusing the raw `ENCRYPTION_KEY`; token-encryption salt untouched (would break stored data).
- **S-CODE-3 — ledger reconciliation sweep** (`worker/processors/reconcile.ts` + queue/jobs/repo wiring). ✅ A periodic job fails `pending` ledger rows whose BullMQ job is missing (orphaned by a `record()`→`enqueue()` crash) and marks the stuck publish target failed so it surfaces in the retry UI.
- **S-PERF-3 — single-query post load** (`lib/repos/posts.ts`). ✅ `getPostWithTargets` collapsed two sequential reads into one `LEFT JOIN`.
- **S-CODE-4 — rate-limit guard** (`lib/repos/rate-limits.ts`). ✅ `takeRateLimit` bails on `limit <= 0`, mirroring `consumeUsage`.
- **S-DES-2 — platform brand logos** (`app/(marketing)/page.tsx`). ✅ Replaced the text wordmark pills with monochrome brand glyphs (`react-icons/fa6`; simple-icons had dropped LinkedIn et al.).

Already satisfied / deferred:
- **S-DES-6 — dark-mode toggle**: already present in the product chrome (`components/shared/topbar.tsx` renders `ThemeToggle`). No change.
- **F-C6 — atomic quota/slot concurrency test** (I-CODE-7): ✅ test written in PR-H (`tests/integration/`, run via `npm run test:integration` against a real DB; skips in CI).

*Acceptance per fix: local gates (lint · typecheck · drizzle-kit check · test · build) green; a regression test where the finding is testable; behavior unchanged for unaffected paths. Migrations generated, not applied (no live DB).*
