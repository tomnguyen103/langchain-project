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

### Deferred from PR-C (each its own coherent change — not shippable as a one-liner)
- **F-C1 — Quota refund on cancel** (I-CODE-1). DEFERRED. `createPost` consumes one `posts_scheduled` **per post** (`create/actions.ts:228`), but `cancelTarget` operates **per target** and `reschedulePost` re-queues without re-consuming. A naive "refund on cancel" therefore over-refunds multi-target posts and reschedule→cancel cycles (lets a user exceed the cap — a worse bug than the one being fixed). Correct fix needs a refund-idempotency signal (a `quotaConsumed`/`quotaRefunded` flag on `posts`, set at create, cleared on the cancel that unschedules the last target, re-set on reschedule) **or** a switch to metering on publish. Both are schema + multi-call changes — tracked for its own PR.
- **F-C6 — Concurrency tests** (I-CODE-7). DEFERRED. The race-safety lives in the conditional SQL (`onConflictDoUpdate … setWhere`, atomic `consumeQuota`), not in pure logic, so a meaningful test needs two concurrent Postgres connections — there is no live DB provisioned in CI. A pure-logic test here would be theater (it wouldn't exercise the race). Tracked for when an integration-test DB is available.

## PR-D — Perf + design + suggestions (P1/P2)
- **F-D1 — Publish parallelism** (`worker/processors/publish.ts`). Parallelize the independent account/media reads (I-PERF-4).
- **F-D2 — Landing hero** (`app/(marketing)/page.tsx`). Replace the div-based fake "product preview" (I-DES-1); tighten hero subtext (S-DES-1); drop "Step N" labels (S-DES-3); add `:active` button feedback (S-DES-5).
- **F-D3 — Suggestions**: seeding-test assert (S-CODE-1); `releaseQuota` observability (S-CODE-2); webhook GET timing-safe compare (S-SEC-1); comment-poll `addBulk` (S-PERF-1); narrow research status poll (S-PERF-2).

*Acceptance per fix: local gates (lint · typecheck · drizzle-kit check · test · build) green; a regression test where the finding is testable; behavior unchanged for unaffected paths. Migrations generated, not applied (no live DB).*
