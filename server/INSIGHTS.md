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
