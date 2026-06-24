# Build Plan — Recommended Top 3 (Triage · Aletheia · Atrium+Praetor)

> Execution plan for the three "Recommended Top 3" features from
> [AGENT_FEATURE_IDEAS_V2.md](AGENT_FEATURE_IDEAS_V2.md). Living document — slices may be
> re-scoped during implementation. Each slice ("goal") is driven to local green before push.

## Workflow (per project CLAUDE.md)

- **One branch + one PR per feature.** Each PR bundles its goal-slices (≥3 per PR).
- **Local gates mirror CI** (`.github/workflows/ci.yml`): `lint · typecheck · drizzle-kit check · test · build`,
  run with the same placeholder env + `SKIP_ENV_VALIDATION=true`. **Verify green BEFORE pushing.**
- **Schema changes ship migrations** — `npm run db:generate` then commit the SQL + snapshot, or `drizzle-kit check` (CI) fails.
- **Non-draft PRs** so CodeRabbit auto-reviews on open. After findings: fix → push once → `@coderabbitai review` → poll until clean.
- **Merge to main at the end**, once CI is green AND CodeRabbit findings are resolved per PR.
- Read `node_modules/next/dist/docs/` for any Next.js API touched (App Router conventions differ — see AGENTS.md).

## Execution order

| # | Feature | Why this order | Blast radius |
|---|---|---|---|
| 1 | **Triage** (Agent Inbox) | Proves the full CI/CodeRabbit/merge loop on the most self-contained change | Review UI + actions + orchestrator resume + 1 small migration |
| 2 | **Aletheia** (Provenance & Disclosure) | P0, deadline-driven (EU Art.50, 2 Aug 2026) | New table + connector capability + publish path + 2 pages |
| 3 | **Atrium + Praetor** (Workspaces + Roles) | Largest migration; build last on a proven loop | New tables + `brandId`/role scoping across many repos |

---

## PR 1 — `feat/triage-agent-inbox`

Replace whole-run approve/reject with per-item **Accept / Edit / Respond / Ignore** (LangChain Agent Inbox model).

- **G1.1 — Schema.** Add per-item review fields to `generated_content` (e.g. `reviewerNote text`, reuse `reviewStatus`/`accepted`). `npm run db:generate` + commit migration.
- **G1.2 — Repo.** Per-item ops in `lib/repos/generated-content.ts` / `content-reviews.ts`: approve-one, edit-body, reject-one, respond (mark for re-draft).
- **G1.3 — Orchestrator.** Per-item resume in `lib/agents/orchestrator.ts`: accept-subset → Atlas with only accepted ids; respond → single-item Lyra refine that re-enters review; reuse idempotent `(runId, agent)` guard. Run completes only when no item is still `held`.
- **G1.4 — Server actions.** `app/(dashboard)/review/actions.ts`: `acceptDraftAction`, `editDraftAction`, `respondDraftAction`, `ignoreDraftAction` (+ keep a bulk path). Revalidate `/review`.
- **G1.5 — UI.** `review-queue.tsx`: per-draft action row (Accept/Edit/Respond/Ignore + Reject), inline edit, respond box, run-level bulk Accept all / Reject all, optimistic state.
- **G1.6 — Tests.** Unit tests for repo + orchestrator per-item resume (no duplicate steps; only accepted publish).
- **Acceptance:** 5 held drafts → edit 1, respond-redraft 1, accept 2, reject 1 → exactly the accepted publish; redrafted re-enters review; `agent_steps` shows no dup hops; gates green.

## PR 2 — `feat/aletheia-provenance-disclosure`

MVP = text disclosure injection + per-platform AI-label flag + disclosure ledger. (Cryptographic C2PA manifest signing deferred to a follow-up — keeps the PR green and dep-light.)

- **G2.1 — Schema.** `disclosure_ledger` (postTargetId, platformLabelApplied, disclosureText, jurisdiction, policyVersion); add `disclosurePolicy jsonb` to `brand_profiles`. Migration.
- **G2.2 — Capability.** `PlatformCapabilities.supportsAiLabel?`; thread an `aiLabel`/`disclosure` option through `publishNow` (adapters that support it set the flag; others no-op).
- **G2.3 — Engine.** `lib/compliance/disclosure.ts`: policy → optional disclosure text appended within `maxBodyLength`; write a ledger row at publish in `worker/processors/publish.ts`.
- **G2.4 — UI.** Disclosure policy controls in `/settings`; read-only ledger in new `/compliance` page.
- **G2.5 — Tests.** Disclosure injection respects length limits; ledger written per published target.
- **Acceptance:** publish path applies label/disclosure per brand policy and writes a complete ledger entry; gates green.

## PR 3 — `feat/atrium-praetor-workspaces-roles`

MVP = brands within an org + brand switcher + roles (owner/manager/creator/approver/viewer) + approver-only approve.

- **G3.1 — Schema.** `brands` (orgId, name…), `memberships` (orgId, userId, role); add nullable `brandId` to posts/social_accounts/agent_runs/generated_content/reports/brand_profiles with a default-brand backfill. Migration.
- **G3.2 — Repos + guard.** Brand-scope the relevant repo reads; `lib/clerk.ts` role guard (`requireRole`).
- **G3.3 — UI.** Brand switcher in `components/shared/topbar.tsx`; `/team` page (members + roles); gate the approve action (PR-1) to `approver`/`manager`/`owner`.
- **G3.4 — Tests.** Two brands never cross-leak in scoped reads; creator cannot approve, approver can.
- **Acceptance:** brand isolation holds; role enforcement holds; gates green.

---

## Definition of Done (whole effort)

- All three PRs: CI green (`Lint · Typecheck · Build` + migration check + tests) **and** CodeRabbit findings resolved/justified.
- Merged to `main`. No secrets committed. Existing 197 tests still pass + new tests added per PR.
