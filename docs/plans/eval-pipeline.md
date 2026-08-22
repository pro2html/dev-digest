# Implementation Plan: Eval Pipeline

## Spec source
- Path: `docs/specs/2026-08-22-eval-pipeline.md`
- Spec ID: SPEC-04

## Execution mode
multi-agent

## Success criteria
- [ ] AC-01
- [ ] AC-02
- [ ] AC-03
- [ ] AC-04
- [ ] AC-05
- [ ] AC-06
- [ ] AC-07
- [ ] AC-08
- [ ] AC-09
- [ ] AC-10
- [ ] AC-11
- [ ] AC-12
- [ ] AC-13
- [ ] AC-14
- [ ] AC-15
- [ ] AC-16
- [ ] AC-17
- [ ] AC-18
- [ ] AC-19
- [ ] AC-20
- [ ] AC-21
- [ ] AC-22
- [ ] AC-23
- [ ] AC-24
- [ ] AC-25
- [ ] AC-26
- [ ] AC-27
- [ ] AC-28
- [ ] AC-29
- [ ] AC-30
- [ ] AC-31
- [ ] AC-32
- [ ] AC-33
- [ ] AC-34
- [ ] AC-35
- [ ] AC-36
- [ ] AC-37
- [ ] AC-38
- [ ] AC-39
- [ ] AC-40
- [ ] AC-41
- [ ] AC-42
- [ ] AC-43
- [ ] AC-44
- [ ] AC-45
- [ ] AC-46
- [ ] AC-47
- [ ] AC-48
- [ ] AC-49
- [ ] AC-50
- [ ] AC-51
- [ ] AC-52
- [ ] AC-53
- [ ] AC-54
- [ ] AC-55

## AC coverage

| AC | Plan task(s) | Notes |
| --- | --- | --- |
| AC-01 | Phase 3 — one-click create (accepted → `must_find`) | server derives owner/input/expectation |
| AC-02 | Phase 3 — one-click create (dismissed → `must_not_flag`) | |
| AC-03 | Phase 3 — `finding_not_decided` guard; Phase 6 — action-row error state | |
| AC-04 | Phase 3 — no-body route returns created case; Phase 6 — confirm + "open case" link | |
| AC-05 | Phase 1 — `source_finding_id` + unique index; Phase 3 — `eval_case_exists` conflict carrying the existing case id; Phase 6 — "open existing" | |
| AC-06 | Phase 3 — case CRUD; Phase 6 — case editor (Diff / PR meta tabs) | owner comes from the tab, not the client payload |
| AC-07 | Phase 3 — `invalid_expected_output` on unparsable JSON; Phase 6 — valid/invalid badge blocking save+run | client-side gate **and** server refusal |
| AC-08 | Phase 3 — envelope validator naming the missing field | covers `[]` on a `must_find` case |
| AC-09 | Phase 4 — single-case run; Phase 6 — "Run on save" wiring + result/duration/cost | |
| AC-10 | Phase 3 — delete case (cascade) + owner metric recompute | |
| AC-11 | Phase 4 — replay frozen `input_diff`/`input_files`/`input_meta`; no diff-loader, no GitHub adapter | |
| AC-12 | Phase 1 — `eval_cases.input_revision` + `eval_runs.case_input_revision`; Phase 3 — bump on input/expected edit | |
| AC-13 | Phase 5 — revision on history/compare payloads; Phase 7 — "crosses a case edit" warning | |
| AC-14 | Phase 1 — `eval_set_runs` identity table; Phase 4 — whole-set orchestrator | |
| AC-15 | Phase 1 — `owner_version` + `system_prompt` columns; Phase 4 — snapshot at run start, attribute every per-case row | |
| AC-16 | Phase 4 — no set-size cap in the orchestrator; Phase 5 — unpaginated case list; Phase 6 — render the full set | ≥ 8 cases |
| AC-17 | Phase 4 — `cases_finished`/`cases_total` + cancel endpoint; Phase 6 — progress on the Run-all control | |
| AC-18 | Phase 4 — cancel: stop starting cases, persist `cancelled` with partial results | |
| AC-19 | Phase 4 — per-case error isolation → `partial` | |
| AC-20 | Phase 4 — all-errored → `failed`, no metrics published | |
| AC-21 | Phase 4 — `no_cases` refusal; Phase 6 — empty-set state | |
| AC-22 | Phase 4 — one-in-flight-per-owner guard (`run_in_progress`) | transaction-level check |
| AC-23 | Phase 2 — pure scorer module, zero I/O | |
| AC-24 | Phase 2 — match = normalized file equal + line ranges overlap; full-file kinds match on file | reuse `FULL_FILE_KINDS` semantics |
| AC-25 | Phase 2 — `normalizeEvalPath` | strips `a/`/`b/`/`./`, POSIX slashes, case-sensitive, rejects escapes |
| AC-26 | Phase 2 — `recall` | |
| AC-27 | Phase 2 — `precision` | |
| AC-28 | Phase 2 — `citation_accuracy` from the grounding gate's kept/dropped counts | never re-implement grounding |
| AC-29 | Phase 2 — zero-denominator → `1` + `not_applicable` flag; Phase 6/7 — "n/a" label | |
| AC-30 | Phase 2 — per-case pass rule | |
| AC-31 | Phase 2 — `must_not_flag` strictness (any grounded finding is noise) | |
| AC-32 | Phase 2 — one-to-one greedy matching | |
| AC-33 | Phase 2 — empty output is a legitimate score, not an error | |
| AC-34 | Phase 1 — metric columns on `eval_set_runs` + `eval_runs`; Phase 4 — persist once at completion | history never recomputes |
| AC-35 | Phase 5 — case-list read model with expectation + last result; Phase 6 — Evals tab controls | |
| AC-36 | Phase 6 — "scoring is mechanical" note from the `eval` namespace | |
| AC-37 | Phase 5 — history read model (newest first, owner_version, metrics, passed, cost); Phase 7 — history table | |
| AC-38 | Phase 5 — compare endpoint (deltas + both prompts); Phase 7 — compare modal | |
| AC-39 | Phase 7 — Compare disabled unless exactly two selected | |
| AC-40 | Phase 5 — each run returns its own stored metrics | no re-run, no recompute |
| AC-41 | Phase 5 — workspace dashboard aggregate; Phase 7 — Eval Dashboard page + nav entry | |
| AC-42 | Phase 5 — owner dashboard (`EvalDashboard`); Phase 7 — metric cards + trend + history | one trend point per whole-set run |
| AC-43 | Phase 5 — alert derived from the last two complete runs; Phase 7 — alert banner | |
| AC-44 | Phase 5 — run-all-agents endpoint (started + skipped); Phase 7 — button | |
| AC-45 | Phase 7 — agent card title uses the primary foreground token | design defect fix |
| AC-46 | Phase 5 — nullable `current` when no complete run; Phase 7 — empty history state, no placeholder metrics | |
| AC-47 | Phase 5 — headline reads the latest **complete** run; Phase 7 — `partial`/`cancelled` badges | |
| AC-48 | Phase 3 — `assertOwnerInWorkspace` on every eval route (read and write) | owner is not FK-enforced |
| AC-49 | Phase 4 — pass case diff/files/PR meta through the engine's untrusted wrapping | |
| AC-50 | Phase 8 — `verify:l06` with a deterministic reviewer stub | ≥ 8 cases, both expectation types |
| AC-51 | Phase 4 — skill-owned runs use the fixed baseline reviewer config with only that skill | |
| AC-52 | Phase 4 — record the skill version as `owner_version`; Phase 7 — version column in skill history | |
| AC-53 | Phase 6 — Skill Evals tab offers no agent selector; Phase 4 — server ignores/rejects agent selection for skill owners | |
| AC-54 | Phase 4 — skill run does not depend on any agent link | |
| AC-55 | Phase 5 — `runs_not_comparable` guard; Phase 7 — Compare stays unavailable + message | |

No AC is out of scope.

## Affected modules

| Module | Why | Notes from AGENTS.md / INSIGHTS.md |
| --- | --- | --- |
| `server/src/db/schema/eval.ts` + `migrations/` | Whole-set run identity, input revision, one-click provenance | Stub tables are the norm here — the existing 8-column `eval_cases` / `eval_runs` are placeholders, so a real migration is required (INSIGHTS 2026-08-03). Never drop/repurpose existing columns. Latest migration is `0015_*`; generate the next one with `pnpm db:generate`, never hand-write SQL. Drizzle cannot express expression-based indexes (INSIGHTS 2026-08-03) |
| `server/src/modules/evals/` (new plugin) | Case CRUD, one-click creation, orchestration, scoring, read models | `src/modules/<name>/` is a self-contained Fastify plugin (routes + service); one Zod schema drives both request validation and response serialization — extra keys are silently stripped at the wire (INSIGHTS 2026-08-14) |
| `server/src/vendor/shared/contracts/eval-ci.ts` | Whole-set run + case-list + compare shapes | **High risk.** Byte-identical twin at `client/src/vendor/shared/...` with no sync script (INSIGHTS 2026-07-31). Additive only, applied to both copies in the same change, then `tsc --noEmit` in both packages |
| `server/src/modules/reviews/` (read-only) | Finding lookup for one-click creation; `pr_files.patch` for the frozen fragment | Do **not** change accept/dismiss or the review record. Do not import `reviews`' repository into evals in a way that creates a peer cycle — mirror the Intent lesson (`reviews → intent → db`, INSIGHTS 2026-08-07) |
| `reviewer-core/` (read-only) | `reviewPullRequest` + `groundFindings` are reused unchanged | Stays DB-free and fs-free; consumed as TS source via a path alias, no build step |
| `client/src/app/agents/[id]/…/AgentEditor` | Evals tab | Tabs are declared in `AgentEditor/constants.ts` (`TABS` + `VALID_TABS`); tab state lives in `?tab=` |
| `client/src/app/skills/[id]/…` | Evals tab replaces the disabled "Run on evals" button | Button currently `disabled` in `skills/[id]/page.tsx` |
| `client/src/app/eval/**` (new route) | Eval Dashboard + per-agent view | `activeKeyFor()` already returns `eval` for `/eval*`; the nav entry itself is missing |
| `client/src/vendor/ui/nav.ts` | Sidebar entry under SKILLS LAB after Conventions | Vendored file — smallest possible additive edit (one `NAV` item + one `SHORTCUTS` row); do not restyle or refactor around it |
| `client/src/lib/hooks/evals.ts` + `lib/api.ts` | Data access | Components never fetch directly; every hook lives in `src/lib/hooks/*` |
| `client/src/…/FindingCard` | "Turn into eval case" action | Add only this action — Learn and Reply stay out of scope |

## Constraints & risks

- **Additive migration only.** `eval_cases` / `eval_runs` already exist and are empty. Add a new `eval_set_runs` table plus new nullable/defaulted columns; do not drop, rename or repurpose anything. Run `pnpm db:generate` from `server/` and commit the generated SQL + snapshot.
- **Whole-set run identity is the one real schema gap** (spec Constraints, AC-14/AC-15). Per-case `eval_runs` rows cannot produce one trend point per run, which is exactly why the table is needed.
- **`@devdigest/shared` dual vendored copies are the highest-risk edit in this feature.** `server/src/vendor/shared` and `client/src/vendor/shared` are byte-identical with no build step, codegen or sync script; editing one leaves the other silently divergent until a runtime `.parse()` fails. Every contract addition must land in both copies in the same change, followed by `pnpm typecheck` in both packages. Expectation type stays inside `expected_output` (already `unknown`), so **no** change is needed for it.
- **Do not modify existing exported contract shapes.** `EvalCase`, `EvalRunRecord`, `EvalRunResult`, `EvalTrendPoint`, `EvalDashboard`, `EvalRun`, `EvalOwnerKind` stay as they are; new needs are new schemas (`.extend(...)`) pointed at by the Fastify `response`. Adding a field to a service without extending the response schema silently strips it at the wire (INSIGHTS 2026-08-14).
- **Reuse the real review path.** Each case must go through `reviewPullRequest` from `@devdigest/reviewer-core` with the owner's resolved configuration (system prompt, model, strategy, resolved skill bodies via `skills/helpers.ts`). No cheaper "eval-only" prompt assembly — that would make the metrics unrepresentative.
- **The grounding gate is the single source of `citation_accuracy`.** `reviewPullRequest` returns `outcome.review.findings` (kept) and `outcome.dropped`; `citation_accuracy = kept / (kept + dropped)`. The scorer must not re-implement overlap logic for citation purposes. Its own expectation matching (AC-24) is a separate, independent computation over kept findings only.
- **Full-file kinds.** `reviewer-core/src/grounding.ts` defines `FULL_FILE_KINDS = {secret_leak, lethal_trifecta, phantom, hook}`. The scorer's file-only match branch (AC-24) must use the same set. Prefer importing/exporting it over re-declaring a second literal set that can drift; if it is not exported today, export it additively from `reviewer-core` rather than copying it.
- **Frozen input replay.** The case stores `input_diff` as text; `reviewPullRequest` needs a parsed `UnifiedDiff`. Use `parseUnifiedDiff` from `server/src/adapters/git/diff-parser.ts` (exported via `src/adapters/index.ts`). Do **not** call `reviews/diff-loader.ts`, the GitHub adapter, or the git adapter from the eval path — AC-11 forbids any live fetch.
- **`reviewer-core` stays DB-free and fs-free.** The scorer lives on the API side (`server/src/modules/evals/scorer.ts`) as a pure module with no container, no Drizzle and no `await`.
- **Tenancy is manual.** `eval_cases.owner_id` has no FK to `agents`/`skills`, so every route must resolve `workspaceId` via `getContext` and then verify the owner (and the case, and the run) belongs to that workspace before reading or writing. Mirror the `skillsBelongToWorkspace` lesson (INSIGHTS 2026-08-01): the FK does not enforce tenancy. AC-48 requires that a cross-workspace request returns neither case input nor run data.
- **Untrusted input.** Diff, file list, PR title/body reach the model on every run; they must go through the engine's existing `wrapUntrusted` / `INJECTION_GUARD` path (i.e. via the documented `ReviewInput` slots — `diff`, `prDescription`, `specs`), never concatenated into `systemPrompt` or `task`.
- **Secrets.** Provider keys come from the existing `container.llm(provider)` chokepoint only. Never store a key on a case, a run, or in a log line.
- **`server/package.json` is `skip-worktree`** (TESTING.md § Conventions) — a local variant diverges from the committed file. Adding `verify:l06` may therefore not stage. The implementer must confirm the script is actually visible to git before reporting AC-50 as done, and flag it in the Implementation Report if it is not.
- **Cost.** Every whole-set run is N real review calls; "Run all agents" multiplies that by the agent count. Cost per run must be persisted and displayed, and the run-all response must report skipped agents so the click is understood before it is repeated.
- **`must_not_flag` strictness (AC-31)** is the spec's chosen reading and the main product risk. Implement it strictly; do not add a targeted mode (it is an Open question in the spec).
- **Skill baseline drift.** Skill-owned runs are only comparable while the fixed baseline stays fixed. It must be snapshotted on every run (AC-52) so a later baseline change is visible as a discontinuity rather than a silent metric shift.
- **No monorepo workspace.** `cd server` / `cd client` for every script; no root install or build.
- **MCP is untouched.** No new tool, no change to existing tools.
- **SPEC-05 is out of bounds.** The repo-local `evals/` package, the `.claude/` `PreToolUse` hook and mutation testing belong to `docs/plans/repo-regression-guardrails.md`. Do not create or touch either.

## Approach

### Phase 1 — Shared contracts + additive schema

- [ ] Add `eval_set_runs` to `server/src/db/schema/eval.ts`: `id`, `workspace_id` (FK `workspaces`, cascade), `owner_kind` (`'skill' | 'agent'`), `owner_id`, `owner_version` (integer), `system_prompt` (text — the agent system prompt for an agent-owned run, the skill body for a skill-owned run, so Compare can diff either), `baseline_label` (text, nullable — the skill baseline identity), `status` (`queued|running|complete|partial|cancelled|failed`), `started_at`, `finished_at`, `cases_total`, `cases_finished`, `passed`, `recall`, `precision`, `citation_accuracy`, `cost_usd`, `duration_ms`. Index `(workspace_id, owner_kind, owner_id, started_at)` for history reads.  AC: AC-14, AC-15, AC-34
- [ ] Add additive columns to `eval_runs`: `set_run_id` (uuid, nullable, FK `eval_set_runs` cascade — `NULL` means a single-case run, which is recorded on the case but is never a trend point), `result` (`passed|failed|errored`, nullable), `error` (text, nullable), `case_input_revision` (integer, nullable). Keep existing `pass` / metric columns untouched.  AC: AC-12, AC-19, AC-34
- [ ] Add additive columns to `eval_cases`: `input_revision` (integer, default 1), `source_finding_id` (uuid, nullable) with a unique index on `(workspace_id, source_finding_id)`, and `created_at` for stable list ordering.  AC: AC-05, AC-12
- [ ] Generate the migration with `pnpm db:generate` from `server/` (next file is `0016_*`); commit the SQL **and** the `meta/` snapshot. Do not hand-edit generated SQL.  AC: AC-14
- [ ] Add new Zod schemas to `server/src/vendor/shared/contracts/eval-ci.ts` **and** the byte-identical `client/src/vendor/shared/contracts/eval-ci.ts`: `EvalSetRunStatus`, `EvalCaseResult` (`passed|failed|errored`), `EvalExpectation` (`must_find|must_not_flag`), `EvalExpectedOutput` (the envelope: `{ expectation, findings[] }`, tolerating a bare array as `must_find`), `EvalCaseListItem` (`EvalCase.extend({ expectation, expected_count, input_revision, last_result, last_actual_count, last_recall })`), `EvalSetRunCaseRecord` (`EvalRunRecord.extend({ case_input_revision, result, error })`), `EvalSetRun`, `EvalSetRunSummary`, `EvalRunComparison`, `EvalWorkspaceDashboard`. Export them from both `index.ts` barrels. Do not alter any existing schema.  AC: AC-15, AC-35, AC-37, AC-38, AC-41
- [ ] Run `pnpm typecheck` in `server/` and `client/` and confirm both copies agree.  AC: AC-15

### Phase 2 — Pure scorer (code only, zero I/O)

- [ ] `server/src/modules/evals/expected-output.ts`: parse and validate the expected-output envelope. Unparsable → `invalid_expected_output`; parsed but missing `file` or `start_line` on a `must_find` target (including a semantically empty `[]`) → `invalid_expected_output` naming the field. `end_line` defaults to `start_line`; `severity`/`category`/`title` are display-only and never matched. Bound the payload size; ignore unknown fields.  AC: AC-07, AC-08
- [ ] `server/src/modules/evals/paths.ts`: `normalizeEvalPath` — strip diff-side prefixes (`a/`, `b/`) and leading `./`, normalize to forward slashes, compare case-sensitively, reject any path escaping its root. Pure string work; never touch the filesystem.  AC: AC-25
- [ ] `server/src/modules/evals/scorer.ts`: `scoreCase({ expectation, targets, kept, preGateCount })` → per-case pass/fail plus counts. Match = normalized paths equal **and** line ranges overlap; full-file kinds match on equal path alone using `reviewer-core`'s `FULL_FILE_KINDS`. Greedy one-to-one mapping so a finding satisfies at most one target and a duplicate counts as noise. `must_not_flag`: every grounded finding for the case is unmatched noise, including one located elsewhere in the same file. A case passes only when all its targets matched and no grounded finding was left unmatched. Zero findings is a legitimate result, not an error. No `async`, no imports from `platform/` or `db/`.  AC: AC-23, AC-24, AC-30, AC-31, AC-32, AC-33
- [ ] `server/src/modules/evals/metrics.ts`: `aggregate(perCase[])` → `recall`, `precision`, `citation_accuracy` as fractions in `0..1`, each with a `not_applicable` flag when its denominator is zero (value reported as `1`, labelled, never presented as a measured score). `citation_accuracy` consumes the grounding gate's kept/dropped counts only.  AC: AC-26, AC-27, AC-28, AC-29
- [ ] Keep both modules free of `container`, Drizzle and network imports so scoring a 20-case set stays sub-second and offline.  AC: AC-23

### Phase 3 — Eval module: tenancy, case CRUD, one-click creation

- [ ] Scaffold `server/src/modules/evals/` as a self-contained Fastify plugin (`routes.ts`, `service.ts`, `repository.ts`, `constants.ts`, `helpers.ts`) and register it the way the other modules are. Each route resolves `workspaceId` through `getContext` from `modules/_shared/context.ts`.  AC: AC-48
- [ ] `assertOwnerInWorkspace(workspaceId, owner_kind, owner_id)` plus workspace-scoped case and run lookups; every read and write path goes through them. A cross-workspace request returns `not_found` / `forbidden` with no case input and no run data in the body.  AC: AC-48
- [ ] Case CRUD: list by owner (unpaginated, no truncation), create, update, delete. Create/update accept `EvalCaseInput`; the owner is taken from the route context, and the expected output is validated through Phase 2 before persistence. Update returns the case with its new `input_revision`.  AC: AC-06, AC-07, AC-08, AC-16
- [ ] On an update that changes `input_diff`, `input_files`, `input_meta` or `expected_output`, bump `input_revision` and keep existing `eval_runs` rows, which stay labelled with the revision they were produced against.  AC: AC-12
- [ ] Delete a case: cascade its run rows and recompute the owner's metrics from the remaining cases (historical whole-set aggregates stay as scored).  AC: AC-10, AC-34
- [ ] `POST /findings/:id/eval-case` with no body: resolve the finding inside the caller's workspace, read its decision (`accepted_at` / `dismissed_at`), file, line range, and the diff fragment for its file from `pr_files.patch`; derive the case name and the expected-output envelope server-side. Accepted → `must_find` at that file and line range; dismissed → `must_not_flag`. Return the created case with no further prompts.  AC: AC-01, AC-02, AC-04
- [ ] Undecided finding → `finding_not_decided`, no case created. A finding that already has a case → `eval_case_exists` carrying the existing case id (backed by the Phase 1 unique index, so a race cannot create a second one).  AC: AC-03, AC-05
- [ ] Keep this path read-only with respect to findings and reviews: no change to accept/dismiss behaviour, no new review or finding row.  AC: AC-01, AC-02

### Phase 4 — Execution: single-case and whole-set runs

- [ ] `server/src/modules/evals/reviewer-config.ts`: resolve the reviewer configuration for an owner. Agent owner → the agent's own system prompt, provider, model, strategy and resolved skill bodies (via `modules/skills/helpers.ts`), at the version recorded on the run. Skill owner → the fixed baseline defined in `modules/evals/constants.ts` (provider, model, strategy, neutral base system prompt) carrying **only** that skill, never an agent's prompt or skill set; a supplied agent selection is rejected for a skill owner.  AC: AC-51, AC-53
- [ ] `server/src/modules/evals/case-executor.ts`: parse the case's stored `input_diff` with `parseUnifiedDiff`, then call `reviewPullRequest` with the resolved config, the parsed diff, the stored PR meta as `prDescription`, and `container.llm(provider)`. No diff-loader, no GitHub, no git, no filesystem, no live PR read. Case inputs enter only through the engine's untrusted-wrapped slots.  AC: AC-11, AC-49
- [ ] Score the outcome: `citation_accuracy` inputs are `outcome.review.findings.length` (kept) and `outcome.dropped.length` (pre-gate total = kept + dropped); expectation matching runs over kept findings only. Persist one `eval_runs` row with `actual_output`, `result`, metrics, `duration_ms`, `cost_usd`, `case_input_revision`.  AC: AC-28, AC-34
- [ ] Single-case run endpoint returning `EvalRunResult`, used by the per-case play button and by "Run on save"; the row records `set_run_id = NULL` so it never becomes a trend point.  AC: AC-09
- [ ] Whole-set run start: refuse when the owner has no cases (`no_cases`); refuse when a `queued`/`running` run already exists for that owner (`run_in_progress`), checked inside a transaction so two simultaneous clicks cannot both pass. Create the `eval_set_runs` identity first, snapshotting `owner_version` (agent version for an agent owner, skill version for a skill owner) and the prompt/body used, then return the identity plus initial status immediately — the set executes in the background rather than holding one long request.  AC: AC-14, AC-15, AC-21, AC-22, AC-52
- [ ] Execute every case of the set sequentially against the snapshotted configuration, updating `cases_finished` as cases land so progress is readable while `running`. Include every case with no size cap.  AC: AC-16, AC-17
- [ ] Per-case failure (provider error, timeout, invalid model output) is recorded as `errored` with its reason, the set continues, and the run finishes `partial`. Every case errored → `failed`, with no metrics published. A case deleted mid-flight is skipped and the run stays attributable.  AC: AC-19, AC-20
- [ ] Cancellation endpoint (idempotent): stop starting further cases, persist the run as `cancelled` with the results already produced, and never present it as complete.  AC: AC-17, AC-18
- [ ] On completion, aggregate once via Phase 2 and persist run-level metrics, `passed`, summed `cost_usd` and final status, so history reads never recompute.  AC: AC-34
- [ ] A skill-owned run executes regardless of whether any agent has that skill attached, and is scored normally.  AC: AC-54

### Phase 5 — Read models: history, compare, dashboards

- [ ] Case-list read model: each entry carries the stored case fields plus `expectation`, `expected_count`, `input_revision` and a last-result summary (`passed` / `failed` / `never_run`, actual count, recall). Expectation is derived by parsing `expected_output`, not stored as a column.  AC: AC-35
- [ ] Whole-set run read model: the run identity, status, `owner_version`, `system_prompt`, timestamps, `cases_total`/`cases_finished`, `passed`, the three metrics, `cost_usd`, and `per_case[]` where each entry is the per-case record plus `case_input_revision` and, when errored, its reason. Point the Fastify `response` at the extended schemas from Phase 1 so no field is stripped.  AC: AC-15, AC-37
- [ ] History endpoint: whole-set runs for an owner, newest first, each returning its own stored metrics (so a version-to-version difference is visible without re-running), with `partial` / `cancelled` distinguishable.  AC: AC-37, AC-40, AC-47
- [ ] Compare endpoint: two run ids of the same `owner_kind` + `owner_id` → deltas for recall, precision, citation accuracy and cost, plus both recorded prompts (skill bodies for a skill-owned comparison). Mismatched owner → `runs_not_comparable`. Surface whether the two runs cross a case input-revision boundary.  AC: AC-13, AC-38, AC-55
- [ ] Owner dashboard aggregate (`EvalDashboard`): `cases_total`, headline metrics from the latest **complete** run, delta against the previous complete run, one `trend` point per whole-set run, recent runs, and an alert derived from the last two complete runs naming the metric, the drop size and the owner version. No runs → empty state with no placeholder metric values.  AC: AC-42, AC-43, AC-46, AC-47
- [ ] Workspace dashboard aggregate: one entry per reviewer agent (identity, model, latest complete run's timestamp, version and three metrics, passed-of-total) plus recent whole-set runs across all agents — all workspace-scoped.  AC: AC-41, AC-48
- [ ] "Run all agents": start one whole-set run per reviewer agent that has at least one eval case, skip agents with none, and return both the started run identities and the skipped agents. Respect the review path's existing provider-concurrency limits; do not add a new concurrency mechanism.  AC: AC-44

### Phase 6 — Client: Evals tab, case editor, one-click action

- [ ] `client/src/lib/hooks/evals.ts` over `lib/api.ts` for every eval endpoint (cases, single-case run, whole-set start/read/cancel, history, compare, owner dashboard, workspace dashboard, run-all). Components never fetch directly. Follow the existing mutation-for-complex-input convention where a payload does not fit a clean query key.  AC: AC-35
- [ ] Add an `evals` tab to `AgentEditor/constants.ts` `TABS` and render an `EvalsTab`: owner metrics, the full case list with expectation badge and last result, per-case run / edit / delete controls, and the "scoring is mechanical — file match plus overlapping line ranges, no model call in the scorer" note. Empty state when there are no cases.  AC: AC-16, AC-21, AC-35, AC-36
- [ ] Add the same Evals tab to the Skill editor, replacing the currently disabled "Run on evals" button in `skills/[id]/page.tsx`. No agent selector anywhere in the skill flow; the skill's case list is its own and never borrows an agent's.  AC: AC-35, AC-53
- [ ] Eval case editor: name, input tabs **Diff** and **PR meta** (the design's Files tab is deferred; `input_files` keeps being stored and replayed, just not hand-edited), expected-output JSON with a live valid/invalid indicator that blocks both save and run while invalid, and server-side field errors surfaced by name. Reuse the existing diff viewer for the diff preview.  AC: AC-06, AC-07, AC-08
- [ ] "Run on save": when enabled, run the single case immediately after a successful save and show its result, duration and cost on the editor.  AC: AC-09
- [ ] Whole-set run control: progress on the same control that started it ("Run all evals" → "Running 4/9 · Cancel"), with cancellation, plus the refusal states for an empty set and for a run already in flight.  AC: AC-17, AC-18, AC-21, AC-22
- [ ] Add "Turn into eval case" to the finding action row (only that action — Learn and Reply stay out of scope). Success confirms with a way to open the new case; undecided finding and already-existing case render their own states, the latter pointing at the existing case.  AC: AC-03, AC-04, AC-05
- [ ] Render zero-denominator metrics as `1` with a "not applicable" label rather than a green 100%.  AC: AC-29
- [ ] Delete-case control refreshes the owner's metrics from the remaining cases.  AC: AC-10

### Phase 7 — Client: Eval Dashboard, history, compare

- [ ] Add the Eval Dashboard nav item to `client/src/vendor/ui/nav.ts` under SKILLS LAB after Conventions (`key: "eval"`, label `Eval Dashboard`, `href: "/eval"`), plus its `SHORTCUTS` row. `activeKeyFor` already maps `/eval*` → `eval`; keep it that way and add a helper test rather than loosening the match.  AC: AC-41
- [ ] `client/src/app/eval/page.tsx`: list every reviewer agent with its latest complete run's recall, precision and citation accuracy, plus recent whole-set runs across all agents, and a "Run all agents" action reporting started and skipped agents.  AC: AC-41, AC-44
- [ ] Render the agent card title in the theme's primary foreground token so it reaches at least 4.5:1 against the card surface — the design's black-on-dark title is a defect, not a preference.  AC: AC-45
- [ ] Per-agent dashboard view: metric cards with the delta against the previous complete run, a trend chart with one point per whole-set run, and the run history table. Reuse the vendored recharts wrappers already used by the skill Stats tab; override `valuePrefix` / `formatValue` for any non-currency chart.  AC: AC-42
- [ ] Alert banner naming the metric, the drop size and the agent version when the latest complete run regressed against the previous complete one.  AC: AC-43
- [ ] History table: newest first with timestamp, owner version, the three metrics, passed-case count and cost; `partial` and `cancelled` rows marked distinctly enough not to read as regressions, with the headline metrics still taken from the latest complete run. No runs → empty history state with no placeholder values.  AC: AC-37, AC-46, AC-47
- [ ] Compare selection: enabled only when exactly two runs of the same owner are selected; the modal shows metric and cost deltas above the prompt diff, and warns when the comparison crosses a case input revision. Runs of different owners keep Compare unavailable with an explanatory message.  AC: AC-13, AC-38, AC-39, AC-40, AC-55
- [ ] All copy comes from the existing `eval` namespace in `client/messages/en/eval.json`; add keys there for the states the namespace does not cover yet (in-progress run, `partial`/`cancelled` badges, revision-boundary warning, not-comparable message, undecided-finding and existing-case conflicts).  AC: AC-36

### Phase 8 — Package-level verification

- [ ] Add `"verify:l06": "vitest run test/eval-verify-l06.test.ts"` to `server/package.json` next to the existing `verify:l03`, runnable as `pnpm verify:l06` from `server/`. Confirm the change is actually visible to git given that this file is `skip-worktree`, and report it if not.  AC: AC-50
- [ ] `server/test/eval-verify-l06.test.ts`: build a set of at least eight cases covering both `must_find` and `must_not_flag`, execute the set against a deterministic reviewer stub (`MockLLMProvider` from `src/adapters/mocks.ts` — no provider key, no network), and assert the scored per-case results and run metrics equal expected fixed values, failing on any difference. Hermetic and Docker-free: no `*.it.test.ts` suffix, no testcontainers.  AC: AC-50
- [ ] Assert inside that test that scoring performs no model call — the stub's call count must match the number of executed cases exactly, with zero calls attributable to scoring.  AC: AC-23, AC-50

## Recommendations

- **Do not add an `eval` entry to `FEATURE_MODELS`** for the skill baseline. That registry is mirrored in three places — both vendored contract copies **and** `client/src/lib/feature-models.ts` (client INSIGHTS 2026-08-07) — so a new id triples the blast radius for a value the user never picks. Keep the baseline a module constant in `server/src/modules/evals/constants.ts` and snapshot it on the run.
- **Keep `expectation` out of the schema.** Deriving it from `expected_output` at read time costs nothing and avoids a column that can disagree with the envelope it summarises.
- **Reuse `EvalDashboard` for the owner view** rather than inventing a second aggregate; only the workspace-level dashboard genuinely needs a new shape.
- **Let a single-case run be a first-class row with `set_run_id = NULL`** instead of a separate table — it keeps the per-case history in one place while excluding it from the trend automatically.
- **Prefer exporting `FULL_FILE_KINDS` from `reviewer-core`** over copying the literal set into the scorer. One definition means the grounding gate and the scorer cannot drift apart.
- If a partial unique index (`one in-flight run per owner`) cannot be expressed cleanly through Drizzle's schema builder, keep the transaction-level guard and skip the index — do not hand-write SQL that `drizzle-kit generate` will then fight with (INSIGHTS 2026-08-03).

## Skill routing (for implementer)

| Skill | When / which paths | Required? |
| --- | --- | --- |
| `onion-architecture` | `server/src/modules/evals/**` — layering, keeping the scorer pure, no peer-module cycles into `reviews` | yes |
| `fastify-best-practices` | `server/src/modules/evals/routes.ts` — plugin shape, error handling, one Zod schema for validation + serialization | yes |
| `zod` | `server/src/modules/evals/expected-output.ts`, both `vendor/shared/contracts/eval-ci.ts` copies | yes — **dual vendored copies, apply identical edits and typecheck both packages** |
| `drizzle-orm-patterns` | `server/src/db/schema/eval.ts`, generated migration, `modules/evals/repository.ts` | yes |
| `postgresql-table-design` | `eval_set_runs` columns, indexes, cascade behaviour | yes |
| `security` | Tenancy checks on every eval route (AC-48), untrusted case input into the prompt (AC-49), path traversal rejection (AC-25) | yes — constraints only; full review deferred |
| `frontend-ui-architecture` | `client/src/app/eval/**`, Evals tab placement, `lib/hooks/evals.ts` | yes |
| `next-best-practices` | `client/src/app/eval/**` route pages, RSC boundaries | yes |
| `react-best-practices` | Evals tab, case editor, compare modal, dashboard components | yes |
| `typescript-expert` | Only if contract inference across the two vendored copies gets awkward | no |
| `react-testing-library` | Client tests | defer to `test-writer` |
| `engineering-insights` | After the work lands — capture confirmed gotchas into `server/INSIGHTS.md` and `client/INSIGHTS.md` | yes (post-implementation) |
| `mermaid-diagram` | Only if a diagram is added to package docs | no |
| tests gap-fill | — | **defer** to `test-writer`; each `it(...)` cites `AC-NN` |
| architecture boundaries | — | **defer** to `architecture-reviewer` (after implementer, parallel with test-writer) |
| plan vs code check | — | **defer** to `plan-verifier` (**last**, after tests) |
| logic / security / pre-PR | — | **defer** to `pr-self-review` (after plan-verifier) |
| feature docs | — | **defer** to `doc-writer` (optional; do not duplicate the SDD spec) |

## Out of scope for implementer

- Architecture review (`architecture-reviewer`) — after implementer, parallel with test-writer
- Plan verification (`plan-verifier`) — **last**, after tests
- Test gap-fill (`test-writer`) — Execution mode is multi-agent, so the implementer writes only the `verify:l06` fixture required by AC-50 plus whatever it needs to prove its own phases; broader suites belong to `test-writer`
- Docs (`doc-writer`) — do not write a second SDD spec; status promotion on `docs/specs/2026-08-22-eval-pipeline.md` is human-directed
- Logic / security / pre-PR review (`pr-self-review`, `security` full pass) — after plan-verifier
- Opening PRs or committing on the user's behalf beyond staging
- **SPEC-05 scope**: the repo-local `evals/` package, the `.claude/settings.json` `PreToolUse` hook, mutation testing, and `docs/plans/repo-regression-guardrails.md` — a different plan owns all of it
- "Promote v7" in the compare modal (spec Non-goal + Open question)
- A targeted (non-strict) mode for `must_not_flag` (spec Open question)
- The dashboard time-range filter and the single-agent selector dropdown shown in the design (non-binding UX, no contract)
- Resumable `partial` runs, scheduled/automatic runs, cost-budget estimation (spec Open questions / Non-goals)
- A Files editing tab in the case editor, cross-workspace eval set sharing/export, bulk auto-generation of cases from finding history
- Any change to the review trigger path, the grounding gate, `reviewer-core`'s pipeline behaviour, or MCP tools

## Verification plan

Split ownership. The implementer does **not** run a full package `pnpm test`.

### Implementer-owned (cheap)

| Package | Command | Scope |
| --- | --- | --- |
| server | `cd server && pnpm typecheck` | required after every phase that touches `server/` or either vendored contract copy |
| server | `cd server && pnpm exec vitest run test/eval-*.test.ts --exclude '**/*.it.test.ts'` | unit only, on files this work added/changed; no Docker, no `*.it.test.ts` |
| server | `cd server && pnpm verify:l06` | AC-50 gate — ≥ 8 cases, both expectation types, deterministic reviewer stub, metrics asserted, no model call in the scorer |
| server | `cd server && pnpm db:generate` | after schema edits; commit the generated SQL **and** `meta/` snapshot; never hand-edit generated SQL |
| client | `cd client && pnpm typecheck` | required after every phase that touches `client/` or its vendored contract copy |
| client | `cd client && pnpm exec vitest run <touched test files>` | only paths changed in that phase |
| reviewer-core | `cd reviewer-core && pnpm typecheck` | only if `FULL_FILE_KINDS` is exported from it |

Both `pnpm typecheck` runs are mandatory in the same phase as any `vendor/shared` edit — that is the only signal that the two copies still agree.

### test-writer-owned

| Package | Command | Scope |
| --- | --- | --- |
| server | `cd server && pnpm exec vitest run --exclude '**/*.it.test.ts'` | unit: scorer match/overlap/full-file kinds (AC-24), path normalization incl. traversal (AC-25), each metric formula (AC-26–AC-28), zero-denominator labelling (AC-29), per-case pass rule (AC-30), `must_not_flag` strictness (AC-31), one-to-one mapping (AC-32), empty output (AC-33), expected-output validation (AC-07, AC-08) |
| server | `cd server && pnpm exec vitest run .it.test` | integration (real Postgres, self-skips without Docker): one-click creation for accepted/dismissed/undecided/duplicate (AC-01–AC-05), input-revision bump with runs preserved (AC-12), whole-set lifecycle incl. progress, cancel, partial, failed, empty set, second-run refusal (AC-14–AC-22), persisted metrics not recomputed on read (AC-34), history/compare/dashboard reads (AC-37, AC-38, AC-40–AC-43, AC-47), skill-owned baseline and version (AC-51, AC-52, AC-54), cross-workspace rejection returning no case input or run data (AC-48) |
| client | `cd client && pnpm test` | RTL: Evals tab in both editors incl. the mechanical-scoring note and ≥ 8 cases untruncated (AC-16, AC-35, AC-36), case editor invalid-JSON blocking save and run (AC-07), Run-on-save result display (AC-09), finding action row states (AC-03–AC-05), progress/cancel control (AC-17, AC-18), Compare gating for wrong count and mismatched owner (AC-39, AC-55), revision-boundary warning (AC-13), no agent selector on the Skill tab (AC-53), dashboard cards/alert/empty state/`partial` badge (AC-41–AC-47), `activeKeyFor` helper for `/eval` |

Notes for `test-writer`: every `it(...)` cites its `AC-NN`. AC-45 cannot be measured as a contrast ratio in jsdom — assert that the card title uses the primary-foreground token (and document the token's contrast against the card surface) rather than computing colours at runtime. Client `fetch` is mocked, so a passing client test does not prove the live route contract — pair each new route with a server test.

### plan-verifier

Trust the Implementation Report and Test Report when the commands above already report `pass`. Re-run Bash only if a report is missing, `partial`/`fail`, or an AC cannot be evidenced from files. Specifically check: the migration is additive (no `DROP`/`ALTER … TYPE`/rename on `eval_cases` or `eval_runs`), the two `vendor/shared/contracts/eval-ci.ts` copies are byte-identical, `verify:l06` exists and is visible to git, and nothing under SPEC-05's scope (`evals/`, `.claude/settings.json`, `docs/plans/repo-regression-guardrails.md`) was touched.

## Open questions

- The skill baseline's provider/model source is decided here as a module constant in `server/src/modules/evals/constants.ts` (rather than a new `FEATURE_MODELS` id or a new setting) to keep the blast radius off the three-way mirrored registry. If the implementer finds an existing workspace-level "default reviewer" value that fits better, prefer it and record the choice in the Implementation Report — the behavioural requirement (fixed, shared by all skill runs, snapshotted on the run) is unchanged either way.
- Whether the one-in-flight-per-owner rule (AC-22) also gets a partial unique index in addition to the transactional guard depends on what `drizzle-kit generate` can express cleanly; the transactional guard is the requirement, the index is optional hardening.
