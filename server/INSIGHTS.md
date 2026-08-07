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

## 2026-08-01 — Context

**Insight:** `agent_skills.skill_id → skills.id` does not enforce same-workspace membership — a link can point at a skill from another tenant unless the agents service explicitly checks `skillsRepo.getById(workspaceId, skillId)` before insert. FK cascade on skill delete still works; tenancy does not.

**Why it matters:** Expanding `POST /agents/:id/skills` to return `AgentSkillLinkView` (name/type/body via prompt injection) turns a silent cross-workspace link into a real data leak into the review prompt.

**Evidence:** `server/src/modules/agents/service.ts` (`skillsBelongToWorkspace`), `server/src/db/schema/agents.ts` (`agentSkills` FK only to `skills.id`).

**Action:** Any new write path into `agent_skills` must verify each skill belongs to the agent's workspace before linking; do not rely on the FK alone.

## 2026-08-01 — Decision

**Insight:** Skill version bumps only when `body` changes (name/description/type/enabled do not); the `skill_versions` snapshot stores body only. This differs from agents, where any config field except `enabled` bumps version.

**Why it matters:** Copying the agents `isConfigChange` rule onto skills would create empty-looking version history (metadata-only snapshots with identical bodies) and confuse the Versions tab.

**Evidence:** `server/src/modules/skills/repository.ts` (`bodyChanged` gate + `snapshotVersion`), `docs/specs/skills-feature.md` §4.2.

**Action:** Keep body-only versioning for skills; do not unify with the agents bump rule without an explicit product change.

## 2026-08-01 — Decision

**Insight:** `runLog.info('skills.loaded', …)` must run **only when** at least one skill body is injected. Emitting it with `count: 0` still shows a `skills.loaded` line in the live log, which fails the acceptance rule that a disabled skill is invisible in both the Trace Skills block and the live log.

**Why it matters:** `bodiesForAgent` already filters to enabled pairs, so an empty result is the disabled/empty case — logging unconditionally made “skills off” runs look like skills were considered.

**Evidence:** Live A/B on PR #482 with Test Quality Reviewer: enabled → Skills block + `skills.loaded` + higher `tokens_in`; disabled → `prompt_assembly.skills === null` and no log line after the `if (skillBodies.length > 0)` guard in `run-executor.ts`.

**Action:** Gate `skills.loaded` on `skillBodies.length > 0` (same condition as omitting the `skills` slot to `reviewPullRequest`).

## 2026-08-01 — Context

**Insight:** Unlike seeded agents (which intentionally skip `agent_versions` until first API edit), seeded skills need a `skill_versions` v1 row written in the same seed pass — otherwise `GET /skills/:id/versions` / the Versions tab is empty while `skills.version` is already 1.

**Why it matters:** Spec §8 excuses missing `agent_versions` for seed agents; the Skills Versions tab has no such excuse and looks broken for demo data.

**Evidence:** `server/src/db/seed.ts` (insert into `skill_versions` with `onConflictDoNothing` after skill upsert); `SkillsRepository.insert` always calls `snapshotVersion` for API-created skills.

**Action:** When inserting skills outside the repository (seed/scripts), also snapshot `skill_versions` for the current version.

## 2026-08-03 — Decision

**Insight:** Convention dedup uses a stored `rule_hash` column (`md5(lower(rule))`) with a standard `uniqueIndex('conventions_repo_rule_uq').on(repoId, ruleHash)` rather than a PostgreSQL expression index `ON (repo_id, md5(lower(rule)))`.

**Why it matters:** Drizzle ORM's schema builder does not support expression-based unique indexes — only column references in `.on(...)`. Using a computed column keeps migration generation fully automatic via `drizzle-kit generate` and avoids hand-written SQL migrations that drift from the schema source of truth.

**Evidence:** `server/src/db/schema/knowledge.ts:58-61` (uniqueIndex on columns), `server/src/modules/conventions/helpers.ts:12-14` (`ruleHash()` function).

**Action:** When dedup needs a computed key in Drizzle, store the hash in a dedicated column rather than using a Postgres expression index — keeps `drizzle-kit generate` working without manual SQL patches.

## 2026-08-03 — Pattern

**Insight:** When `repoIntel.getConventionSamples()` returns `[]` (repo not indexed), the sampler falls back to `walkClone` + junk filter + size sort, sets `degraded: true`, and the API response propagates `index_state: null`. The client renders a "repo not indexed" hint in that case.

**Why it matters:** A naive implementation would treat empty samples as "no conventions possible" and stop. The fallback walk gives usable (if lower-quality) results immediately, while the UI hint tells the user how to improve them — without requiring repo-intel indexing as a hard prerequisite.

**Evidence:** `server/src/modules/conventions/sampler.ts:85-88` (degraded path + `fallbackCodePaths`), `client/src/app/repos/[repoId]/conventions/_components/ConventionsView/ConventionsView.tsx:73,115-119` (notIndexed hint).

**Action:** Any feature depending on repo-intel data should support a degraded path (not hard-fail) and surface a user-actionable hint for improving quality.

## 2026-08-03 — Context

**Insight:** The `conventions` table in `0000_init.sql` was a bare-minimum placeholder (id, workspace_id, repo_id, rule, evidence_path, evidence_snippet, confidence, accepted). Implementing the actual feature required adding 9 new columns + 2 indexes + 1 FK via a separate migration (`0013`). The "empty tables for future lessons" convention (per `server/AGENTS.md`) means initial schemas are stubs — a working migration is always needed before the feature is functional.

**Why it matters:** Assuming the table already has the correct shape skips the migration step, causing runtime errors on `INSERT` (missing NOT NULL columns) or silent data loss (missing indexes).

**Evidence:** `server/src/db/migrations/0000_init.sql:96-105` (original 8-column stub), `server/src/db/migrations/0013_bizarre_quasar.sql` (the real migration adding `rule_hash`, `category`, `status`, etc.).

**Action:** When implementing a feature that uses a pre-existing stub table, always run `pnpm db:generate` after updating the Drizzle schema — don't assume the table is already correct.

## 2026-08-06 — Mistake

**Insight:** `runLog.info(msg, data)` accepts a structured `data` payload, but the Live Log UI and persisted `RunLogLine` only keep/render `msg`. Passing `{ count, names }` as `data` for `skills.loaded` produced a bare `skills.loaded` line with no skill names in the UI.

**Why it matters:** Spec acceptance ("live log shows which skills were pulled in") looked done on the server side while the user-visible log still hid the names. Same trap for any future run-log event that puts details only in `data`.

**Evidence:** `RunLogger.logFor` maps to `{ t, kind, msg }` only; `RunLogLine` has no `data`; `RunStatus` / `LiveLogStream` render `e.msg` / `l.m` only. Fixed by inlining count/names into the message string in `run-executor.ts`.

**Action:** Put user-visible run-log details in `msg` (same style as `Diff ready — N…` / `callers digest: N…`). Use `data` only for stdout/pino mirroring unless you also extend `RunLogLine` + LiveLogStream.

## 2026-08-07 — Pattern

**Insight:** Intent classifier sources must never embed `pr_files.patch` bodies — only `@@ … @@` hunk headers + file paths. A naive “reject any line starting with `+`/`-`” invariant on the *whole* classifier payload is wrong: PR titles/bodies routinely contain those characters and would false-fail.

**Why it matters:** Enforcing “no +/- lines” on assembled text (title+body+headers) breaks real PRs; the real invariant is “never concatenate raw patch bodies into the classifier input.”

**Evidence:** `server/src/modules/intent/sources.ts` (`extractHunkHeaders` + sections built from headers only); Intent Layer plan Phase 1.

**Action:** Keep patch bodies out of `buildIntentSources`; validate header extraction, not the entire user payload string.

## 2026-08-07 — Pattern

**Insight:** Intent derive meta (`context_quality`, `sources`, `missing`) must live in `pr_intent.meta` jsonb — not only in the POST response. `GET /pulls/:id/intent` and client `invalidateQueries(["pr-intent"])` after Run Review otherwise wipe the quality badge. Persist ownership stays in `modules/intent/repository`; `reviews` may call `IntentService` but must not own `pr_intent` CRUD (avoids reviews ↔ intent cycles via `ReviewRepository`).

**Why it matters:** Transport-only meta looks fine until the first refetch; peer-module bidirectional imports blur Onion boundaries even when there is no runtime cycle.

**Evidence:** Architecture review A1/A2 on Intent Layer; `0014_pink_thunderbird.sql` adds `meta`; `IntentRepository.upsertIntent(..., meta)`.

**Action:** Persist derive meta with the Intent row; keep dependency direction `reviews → intent → db`.
