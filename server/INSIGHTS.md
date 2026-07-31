# server/ — insights

Lessons learned and gotchas discovered while working in this package, that
aren't obvious from the code or the README. Append as they come up; keep each
entry short (what happened, what to do instead).

## 2026-07-31 — Pattern

**Insight:** Per-run aggregate metrics that the timeline/list needs to read cheaply (e.g. a per-severity finding breakdown) are denormalized onto `agent_runs` at run-completion time — computed once from the kept `Finding[]` in `run-executor.ts` and stored as plain columns — rather than derived by joining `findings` → `reviews` at read time.

**Why it matters:** This mirrors the existing `findingsCount`/`blockers` denormalization (`RunHistory.tsx` comment: "the timeline has no FK to the review"). Adding a new metric via a join instead would work but breaks the established convention and adds an avoidable join to the frequently-polled `GET /repos/:id/pulls` and PR-timeline endpoints.

**Evidence:** `server/src/modules/reviews/run-executor.ts` (`keptFindings.filter(f => f.severity === ...)` computed once, passed into `completeAgentRun`), `server/src/db/schema/runs.ts` (`findingsCritical`/`findingsWarning`/`findingsSuggestion` columns on `agent_runs`).

**Action:** For any new per-run aggregate number, denormalize it onto `agent_runs` at `completeAgentRun` time instead of joining `findings`/`reviews` at read time. Only fall back to a join when the feature needs full finding detail (title/file/confidence) that isn't worth denormalizing.

## 2026-07-31 — Context

**Insight:** Per-PR aggregates in `GET /repos/:id/pulls` follow two different semantics depending on the field: `score` is the LATEST review only (one per PR), while `cost` — and now the findings severity counts — are CUMULATIVE sums across every agent run ever executed for that PR, including old/superseded runs.

**Why it matters:** A new per-PR metric that assumes "latest only" (copying the `score` pattern) will silently undercount if the intended semantics are actually cumulative, or vice versa. The route already mixes both conventions side by side.

**Evidence:** `server/src/modules/pulls/routes.ts` — `latestReviewByPr` keeps only the first (newest) row per PR, while `totalCostByPr`/`findingsByPr` sum every matching `agentRuns` row per PR.

**Action:** Before aggregating a new per-PR metric in this route, explicitly decide and comment whether it should mirror `score` (latest only) or `cost`/`findings` (cumulative) — don't assume either.

## 2026-07-31 — Context

**Insight:** `server/src/vendor/shared` and `client/src/vendor/shared` are two physically separate, byte-identical copies of the same Zod contract files — there is no build step, codegen, or sync script linking them (`grep` for `vendor/shared` in both `package.json`s and any `scripts/` returns nothing).

**Why it matters:** Editing only one copy leaves the two packages' types silently out of sync — no build error surfaces until a Zod `.parse()` fails at runtime with a shape mismatch, since TypeScript compiles each package independently against its own copy.

**Evidence:** `diff server/src/vendor/shared/contracts/platform.ts client/src/vendor/shared/contracts/platform.ts` reported no differences prior to this session's edits.

**Action:** When changing any file under `vendor/shared/contracts/`, apply the identical edit to both `server/src/vendor/shared/...` and `client/src/vendor/shared/...` in the same change, then re-run `tsc --noEmit` in both packages to confirm they still agree.
