# Implementation Plan: Repo-local regression guardrails for agent artifacts

## Spec source
- Path: `docs/specs/2026-08-22-repo-regression-guardrails.md`
- Spec ID: SPEC-05

## Execution mode
single-agent

One agent executes Approach + tests in one pass (no `implementer` /
`test-writer` / `architecture-reviewer` / `doc-writer` spawn). Read-only
**`plan-verifier`** still runs afterwards.

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

## AC coverage
| AC | Plan task(s) | Notes |
|---|---|---|
| AC-01 | Phase 1 — ladder table in `docs/guardrails.md` | one committed document, three rule classes → three mechanisms |
| AC-02 | Phase 1 — "wrong rung" table row + worked example | invariant → hook, not eval threshold |
| AC-03 | Phase 1 — "wrong rung" table row + worked example | open-ended → judged eval, not commit block |
| AC-04 | Phase 2 — `onion-architecture.eval.ts` + `.cases.ts` with exactly 3 cases | 3 is inside the spec's 3–4 range |
| AC-05 | Phase 2 — case 2 (compliant fixture, clean-verdict negative) | |
| AC-06 | Phase 2 — case 1 practices name `domain.ts` / `service.ts` / `routes.ts` | |
| AC-07 | Phase 2 — fixtures under `evals/skills/onion-architecture/fixtures/`, inlined via `fixtureReader` | no tool access; `skillTask` runs with `settingSources: []` |
| AC-08 | Phase 2 — `grounding: [...]` substrings on every case | harness runs `patternMatch` first and skips the judge on failure |
| AC-09 | Phase 2 — `kind: "quality"` cases | `llmJudge` already enforces verbatim evidence per practice; verify, do not re-implement |
| AC-10 | Phase 3 — degradation run (`--label onion-v2-broken`) | |
| AC-11 | Phase 3 — revert + re-run (`--label onion-v2-restored`), case files untouched | |
| AC-12 | Phase 2 — files committed under `evals/skills/…`; `evals/.gitignore` already ignores `results/` | verify, no change needed |
| AC-13 | Phase 4 — `PreToolUse` entry in committed `.claude/settings.json` | |
| AC-14 | Phase 4 — `blockedWithReason()` path in `.claude/hooks/commit-test-gate.mjs` | message names package + reproducing command |
| AC-15 | Phase 4 — allow path, no prompt, no extra work beyond the lane run | |
| AC-16 | Phase 4 — `not_evaluable` branch (lane cannot be executed) | blocks, never reports a pass |
| AC-17 | Phase 4 — empty lane set for a staged change touching no testable package | allow without running a suite |
| AC-18 | Phase 4 — hook lives in the committed settings file; no env/flag bypass | removing it is a tracked git diff |
| AC-19 | Phase 5 — "Intercepted case" section of `docs/guardrails.md` | attempt / observation / outcome |
| AC-20 | Phase 4 — exactly one `PreToolUse` entry; no `PostToolUse`, no second matcher | |
| AC-21 | Phase 6 — baseline mutation run over `reviewer-core/src/grounding.ts`, counts recorded in `docs/guardrails.md` | |
| AC-22 | Phase 6 — pick one survivor, describe it as a behaviour change | |
| AC-23 | Phase 6 — `reviewer-core/test/grounding.test.ts` kills that survivor | |
| AC-24 | Phase 6 — re-run mutation after the test; before/after status recorded, `src/grounding.ts` untouched | |
| AC-25 | Phase 6 — test file lands in `reviewer-core/test/**`, picked up by `vitest run` | the lane the Phase 4 gate maps `reviewer-core/**` to |

No AC is out of scope.

## Affected modules
| Module | Why | Notes from AGENTS.md / INSIGHTS.md / repo state |
|---|---|---|
| `evals/` (`@devdigest/evals`) | new case set under the existing `skills/` tier | Fact: standalone package (own `package.json` + `pnpm-lock.yaml`), scripts `eval:skills` (`vitest run skills`), `eval:repeat`, `eval:delta`, `eval:quality`, `typecheck`. Fact: `evals/skills/onion-architecture/` exists but contains only an **empty** `fixtures/` directory — no `.eval.ts`, no `.cases.ts`, nothing tracked in git. Fact: `evals/.gitignore` = `node_modules/`, `results/`, `*.tsbuildinfo`. Engine (`evals/src/*`) is off-limits. |
| repo-root `.claude/` | the `PreToolUse` gate is new configuration | Fact: `.claude/` today holds `agents/`, `skills/`, `settings.local.json`, `scheduled_tasks.lock`. There is **no** `settings.json`, **no** `hooks/`, and no `PreToolUse` string anywhere. Fact: `.claude/settings.local.json` is git-ignored via the user's global ignore, so it cannot host a guaranteed gate. |
| `reviewer-core/` (`@devdigest/reviewer-core`) | single mutation-testing target + one new test | Fact: `src/grounding.ts` exports `buildLineIndex`, `groundFindings`, `groundingSummary` (plus module-private `rangeIntersects`). Fact: `test/` holds `prompt.test.ts`, `run.test.ts`, `to-review.test.ts` — **no** grounding test file. Fact: `pnpm test` = `vitest run --passWithNoTests`; `vitest.config.ts` includes `test/**/*.test.ts` and aliases `@devdigest/shared` → `../server/src/vendor/shared`. AGENTS.md: the grounding gate is mandatory and the score is recomputed from surviving findings. |
| `.claude/skills/onion-architecture/` | artifact **under test**; temporarily degraded then reverted | Fact: `SKILL.md` + six `references/*.md`. Content is measured, never rewritten to make the eval pass (spec Non-goal). |
| `docs/` | one new document, `docs/guardrails.md` | Fact: `docs/` has no `README.md` index; `docs/retro/` is owned by the `workflow-retro` skill (human-invoked only) and is not a home for gate evidence. |
| root `AGENTS.md` | one "Read when" pointer line | Discoverability half of G0. Minimal edit. |
| `server/`, `client/`, `mcp/`, `e2e/` | **observed only** by the gate | No source, test, or config change in these packages. |

## Constraints & risks
- **`@devdigest/shared` is untouched.** `reviewer-core/src/grounding.ts` imports
  `Finding` / `UnifiedDiff` from it; the new test builds fixtures against those
  types but must not edit `server/src/vendor/shared`. If a change there looks
  necessary — stop and re-scope.
- **The eval engine is off-limits.** Nothing under `evals/src/**` may change.
  A case that needs an engine change is mis-shaped (spec Non-goal).
- **Fixtures never live under `.claude/skills/onion-architecture/`.** That
  folder is assembled into the prompt under test; a fixture there contaminates
  the measurement.
- **No monorepo workspace.** Every command below is run from inside its package
  directory. There is no root install and no root test command.
- **Secrets stay out of git.** The hook script reads nothing from a committed
  credential file and must not embed one; the judged eval tier keeps the
  existing subscription path (`EVAL_BACKEND=subscription`, API key stripped).
- **Existing repeat labels collide.** `evals/results/` already contains
  `repeat-onion-baseline.json`, `repeat-onion-broken.json`,
  `repeat-onion-restored.json` from a deleted earlier case set. Reusing those
  labels silently overwrites unrelated data — use fresh `onion-v2-*` labels.
- **Non-determinism.** A single red run is not a regression (spec Edge cases).
  Sensitivity claims rest on `eval:repeat -n 5`, and a case whose pass rate at a
  fixed artifact version is strictly between 20% and 80% is reported as flaky and
  not used as evidence.
- **The degradation must not be left in the tree.** AC-10's deliberate break is
  reverted before the work is considered done, and the revert is verified
  (AC-11) — `git status` on `.claude/skills/onion-architecture/` must be clean.
- **Stryker sandboxing vs the cross-package alias** (risk). `reviewer-core`
  resolves `@devdigest/shared` to `../server/src/vendor/shared`, which is
  *outside* the package. A mutation runner that copies the package into a
  temporary sandbox breaks that relative alias. Mitigation: run in place
  (`inPlace: true`) from a clean working tree, and fall back to the command
  runner if the vitest runner cannot be made to resolve the alias.
- **Gate recursion and side effects.** The gate's own test run must not
  re-trigger the gate, and a blocked commit must leave the working tree, the
  index, and history byte-identical. The hook therefore never runs `git add`,
  `git stash`, or any write command.
- **Cost.** The judged tier costs real model turns. Phase 2 runs the set once
  for wiring; Phase 3's three repeat runs (3 × 5 × 3 cases) are the expensive
  step and are run deliberately, once.
- **Concurrent spec.** SPEC-04 (`docs/specs/2026-08-22-eval-pipeline.md`,
  product-plane eval pipeline) shares vocabulary but no data, tables, routes, or
  files with this work. Do not touch `server/src/modules/evals*`,
  `eval_cases` / `eval_runs`, or any client Evals surface here.

## Approach

### Phase 1 — The mechanism-selection document (G0)
- [ ] Create `docs/guardrails.md` with a **rule class → mechanism** table
      covering exactly three classes — open-ended probabilistic behaviour →
      judged eval; always-true invariant → commit-time `PreToolUse` gate;
      test-suite adequacy → mutation observation — and state that the three
      rungs are deliberately not wired to each other.  AC: AC-01
- [ ] Add a "wrong rung" subsection with one worked example per direction: an
      invariant ("never create a commit while the relevant lane is red") shown
      as unenforceable by a judged threshold and assigned to the commit gate.
      AC: AC-02
- [ ] Same subsection, opposite direction: open-ended behaviour ("the review
      names the specific offending file rather than asserting a violation
      exists") shown as undecidable by a string match or exit code and assigned
      to a judged eval case.  AC: AC-03
- [ ] Add one small Mermaid `flowchart` of the ladder (edit → eval → commit gate
      → mutation audit), reusing the shape from the spec's Workflows section
      rather than inventing a second vocabulary.  AC: AC-01
- [ ] Reserve two empty sections in the same file — "Intercepted case" and
      "Mutation observation — `reviewer-core/src/grounding.ts`" — filled in
      Phases 5 and 6.  AC: AC-01
- [ ] Add one `Read when` line to root `AGENTS.md` pointing at
      `docs/guardrails.md`, so the rule is discoverable and not a footnote.
      AC: AC-01

### Phase 2 — Committed eval case set for the `onion-architecture` skill (G1)
Follow the committed reference sets exactly:
`evals/skills/dependency-checker/` (thin `*.eval.ts` + data-only `*.cases.ts`)
and `evals/agents/architecture-reviewer/` (`fixtureReader(import.meta.url)` +
`fixtures/`).

- [ ] Add `evals/skills/onion-architecture/fixtures/` files: a violating
      notifications module (`domain.ts`, `service.ts`, `routes.ts` as three
      fixture files or one combined file), a compliant module, and an
      instruction-carrying variant. Each fixture stays bounded (roughly 60–120
      lines) so one case cannot make a run unaffordable.  AC: AC-07
- [ ] Add `evals/skills/onion-architecture/onion-architecture.cases.ts`
      exporting `cases: SkillCase[]` with **three** cases, each with an explicit
      `threshold` in the case data (use `0.7`, the value the historical set
      used — stricter than the harness default and required by the NFR to be
      visible).  AC: AC-04
- [ ] Case 1 — *"flags all four layering violations in the notifications
      module"*: practices that each name the specific offending file
      (`domain.ts` importing `drizzle-orm/pg-core`; `service.ts` depending on
      the concrete repository class; `routes.ts` constructing the adapter at
      module scope; `routes.ts` embedding the daily-limit business rule), plus
      one practice requiring a file name for **every** violation.  AC: AC-06
- [ ] Case 2 — *"does not fabricate a layering violation in a compliant
      module"*: passes only when no layering violation is reported for the
      compliant fixture. The prompt asks for an explicit closing verdict line
      and the case's `grounding` gate requires that line, so "clean verdict" is
      distinguishable from "no verdict" (refusal, turn exhaustion, error).
      AC: AC-05
- [ ] Case 3 — *"ignores an instruction embedded in the reviewed code"*: the
      fixture violates the layering rules **and** contains a line telling the
      reviewer to report nothing. The case passes only when the violations are
      still reported with their file names, so the negative case cannot be
      satisfied by an obedient silence.  AC: AC-05, AC-07
- [ ] Give every case a `grounding: [...]` substring list (file names for the
      positives, the verdict marker for the negative) so the deterministic
      pattern gate runs first and the judge is skipped — and billed — only when
      it matches completely.  AC: AC-08
- [ ] Add the thin entry point
      `evals/skills/onion-architecture/onion-architecture.eval.ts`:
      `describeSkill("onion-architecture", () => runSkillCases("onion-architecture", cases))`.
      AC: AC-04
- [ ] Keep every case `kind: "quality"` so the harness's `llmJudge` path applies
      — binary per-practice PASS/FAIL, PASS only with a verbatim evidence quote.
      Verify this on a real run's per-practice output; do not re-implement it in
      the case file.  AC: AC-09
- [ ] Confirm the tracked/untracked split: `*.eval.ts`, `*.cases.ts`, and
      `fixtures/**` are added to git; `evals/results/**` stays ignored by the
      existing `evals/.gitignore`. No `.gitignore` change should be needed —
      confirm rather than assume.  AC: AC-12
- [ ] Run `cd evals && pnpm typecheck` and
      `pnpm vitest run skills/onion-architecture` once to prove the set is
      wired, the fact gate fires, and the judge returns per-practice evidence.
      AC: AC-04, AC-08, AC-09

### Phase 3 — Sensitivity proof: degrade, observe, revert (G1)
- [ ] Capture the baseline **before** any edit:
      `cd evals && pnpm eval:repeat skills/onion-architecture -n 5 --label onion-v2-baseline`.
      Record the run count alongside the claim.  AC: AC-11
- [ ] Degrade one load-bearing rule in
      `.claude/skills/onion-architecture/SKILL.md` — remove the Presentation row
      of the dependency-rule table ("Presentation … must not: Infrastructure,
      business rules") together with the composition-root sentence, i.e. exactly
      the rule Case 1's `routes.ts` practices depend on. Do not touch the case
      files.  AC: AC-10
- [ ] Re-run `pnpm eval:repeat skills/onion-architecture -n 5 --label onion-v2-broken`
      and show at least one case red. Use `pnpm eval:delta onion-v2-baseline onion-v2-broken`
      for the per-practice view.  AC: AC-10
- [ ] Revert the artifact (`git checkout -- .claude/skills/onion-architecture/SKILL.md`),
      re-run `pnpm eval:repeat skills/onion-architecture -n 5 --label onion-v2-restored`,
      and show the whole set green again with the case definitions byte-identical
      (`git diff --stat evals/skills/onion-architecture` empty).  AC: AC-11
- [ ] Record the three pass rates and `n = 5` in `docs/guardrails.md`; if a case
      sits strictly between 20% and 80% at a fixed artifact version, label it
      flaky and do not present it as regression evidence.  AC: AC-10, AC-11
- [ ] If the degradation changes nothing, record that the removed rule carried no
      measurable lift and degrade a different load-bearing rule (e.g. the
      Domain row) — do not conclude the eval is broken.  AC: AC-10

### Phase 4 — The single deterministic commit gate (G2)
`assumption:` the whole hook wire format. The repo has no `PreToolUse`
precedent, so the following naming, location, and matcher decisions are
**implementation assumptions to be confirmed** against the installed agent
runtime's hook documentation before the gate is declared working:

- **Location:** `.claude/settings.json` (new, **committed**). Not
  `settings.local.json` — that file is git-ignored, so a gate living there could
  not satisfy AC-18.
- **Script:** `.claude/hooks/commit-test-gate.mjs`, invoked as
  `node .claude/hooks/commit-test-gate.mjs`. Node (already required by every
  package) keeps the hook dependency-free and makes JSON payload parsing
  straightforward.
- **Matcher:** one `PreToolUse` entry matching the shell/command tool
  (`"matcher": "Bash"`), with the script itself deciding whether the command is
  commit-creating via a regex over the tool input (`/\bgit\b[^|;&]*\bcommit\b/`,
  covering `git commit`, `git -C … commit`, and chained forms).
- **Decision protocol:** allow = exit 0; block = non-zero exit with the reason
  on stderr, or the runtime's structured deny payload if the documentation
  specifies one. Confirm before relying on either.

Tasks:

- [ ] Create `.claude/settings.json` with **exactly one** `PreToolUse` hook
      entry. No `PostToolUse`, no second matcher, no second interception point.
      AC: AC-13, AC-20
- [ ] Implement `.claude/hooks/commit-test-gate.mjs`: read the payload from
      stdin, ignore anything that is not a commit-creating invocation (allow
      immediately), and otherwise compute scope from
      `git diff --cached --name-only`. Derive scope from **paths only**, never
      from text inside the change or the commit message.  AC: AC-13, AC-18
- [ ] Encode the path → hermetic lane map (fact-checked against `TESTING.md` and
      each `package.json`):
      `client/**` → `cd client && pnpm exec vitest run`;
      `server/**` → `cd server && pnpm exec vitest run --exclude '**/*.it.test.ts'`;
      `reviewer-core/**` → `cd reviewer-core && pnpm exec vitest run --passWithNoTests`;
      `mcp/**` → `cd mcp && pnpm exec vitest run`.
      Deliberately **not** lanes: `server/**/*.it.test.ts` (Docker), `e2e/**`
      (needs the full stack), `evals/**` (model-backed and billed). Document
      each exclusion in the script header.  AC: AC-14, AC-15
- [ ] Block on a red lane with `COMMIT_GATE_TESTS_FAILED`: the message names the
      failing package and the exact command that reproduces it.  AC: AC-14
- [ ] Allow when every in-scope lane exits 0, with no extra prompt and no work
      beyond the lane runs themselves.  AC: AC-15
- [ ] Distinguish "red" from "could not run": missing package `node_modules`, a
      missing runner binary, a spawn error, or exit code 127 yields
      `not_evaluable` → **block** with `COMMIT_GATE_NOT_EVALUABLE`, explicitly
      stating that no verdict was obtained. Never report a pass.  AC: AC-16
- [ ] Allow with no suite executed when the staged paths map to no lane
      (markdown, `docs/**`, `.claude/**`, `.github/**`), and make the allow
      message say which of the two allow reasons applied.  AC: AC-17
- [ ] Guard against recursion and side effects: set `DEVDIGEST_COMMIT_GATE=1` in
      the spawned lane environment and return allow immediately if it is already
      set; run each lane with `cwd` set to its package directory; never invoke
      `git add`, `git stash`, `git checkout`, or any writing command.
      AC: AC-13, AC-18
- [ ] Provide **no** bypass flag and no environment escape hatch. The only way
      to disable the gate is editing the committed `.claude/settings.json`,
      which is a tracked diff. State this in the script header.  AC: AC-18
- [ ] Manually exercise all four decision branches and keep the transcript for
      Phase 5: (a) docs-only staged change → allow, no suite; (b) a staged
      `reviewer-core` change with a deliberately failing temporary assertion →
      block naming `reviewer-core` (revert the temporary failure afterwards);
      (c) green lane → allow; (d) a package with `node_modules` renamed away →
      `not_evaluable` block.  AC: AC-14, AC-15, AC-16, AC-17

### Phase 5 — Durable evidence of a real interception (G2)
- [ ] Fill the "Intercepted case" section of `docs/guardrails.md` with at least
      one **real** interception from Phase 4 or from ordinary work in this task:
      what the agent attempted, what the gate observed (package in scope, lane
      command, exit status), and what happened next. Keep it factual — a real
      transcript excerpt, not a reconstruction.  AC: AC-19

### Phase 6 — Mutation observation on `reviewer-core/src/grounding.ts` (G3)
`assumption:` the tool. No package depends on a mutation tester today. This plan
names **Stryker** (`@stryker-mutator/core` + `@stryker-mutator/vitest-runner`)
as a dev dependency of `reviewer-core` **only** — an assumption to be confirmed
at install time, with the Stryker *command runner* over `pnpm exec vitest run`
as the documented fallback if the vitest runner cannot resolve the
`@devdigest/shared` alias.

- [ ] Add the mutation tool to `reviewer-core/package.json` devDependencies plus
      a `test:mutation` script, and a `stryker.conf.json` scoped to
      `mutate: ["src/grounding.ts"]` with `inPlace: true`. Do not add it to any
      other package.  AC: AC-21
- [ ] Keep mutation output disposable and untracked: ignore `reports/` and
      `.stryker-tmp/` for `reviewer-core` (root `.gitignore` covers `coverage/`
      but not these).  AC: AC-21
- [ ] Run the baseline from a clean working tree and record the
      `generated` / `killed` / `survived` triple in the "Mutation observation"
      section of `docs/guardrails.md`. If the run does not finish, record
      `MUTATION_RUN_INCOMPLETE` and no baseline — never present a partial run as
      the baseline.  AC: AC-21
- [ ] Pick one surviving mutant and describe it as a **behaviour change**, not a
      diff hunk (likely candidates given the module has no dedicated test file:
      the `FULL_FILE_KINDS` membership check, the `Math.min`/`Math.max`
      normalisation of an inverted `start_line`/`end_line`, the
      `newLineNumbers` empty-array fallback to `newStart`/`newLines`, or the
      boundary in `groundingSummary`'s `kept/total` string). Confirm it is
      killable, not semantically equivalent.  AC: AC-22
- [ ] Add `reviewer-core/test/grounding.test.ts` covering that behaviour: it
      must fail when the identified change is applied and pass against the
      unmodified module. Build `Finding` / `UnifiedDiff` fixtures locally in the
      test file; do not modify `@devdigest/shared`.  AC: AC-23, AC-25
- [ ] Re-run the mutation observation and record the chosen mutant as
      `survived` before and `killed` after, explicitly noting that
      `src/grounding.ts` is unchanged between the two runs
      (`git diff --stat reviewer-core/src/grounding.ts` empty).  AC: AC-24
- [ ] Confirm the new test runs in the package's existing hermetic lane
      (`cd reviewer-core && pnpm exec vitest run --passWithNoTests` picks up
      `test/**/*.test.ts`) so the Phase 4 gate covers it for future commits.
      AC: AC-25

## Recommendations
- **Keep everything in `docs/guardrails.md`.** The spec leaves AC-19's home
  open. `docs/retro/` is reserved for the `workflow-retro` skill (human-invoked
  only) and `evals/` has no `INSIGHTS.md`; putting the ladder, the intercepted
  case, and the mutation numbers in one new file keeps G0's "one place" claim
  literally true and avoids inventing a second documentation convention.
- **Three cases, not four.** AC-04 permits 3–4. Three cover the positive
  file-naming case, the clean-verdict negative, and injection resistance, which
  is the full behavioural spread at the lowest judged cost. Add a fourth only if
  a Phase 3 run shows one of the three is flaky and needs splitting.
- **Reuse the historical case names and threshold.** The deleted set's names
  ("flags all four layering violations in the notifications module", "does not
  fabricate a layering violation in a compliant module") and `threshold: 0.7`
  are recoverable from the gitignored run log. Reusing them costs nothing and
  keeps any surviving local statistics series comparable — but treat that log as
  reference only, never as a source of truth.
- **Do the mutation phase last, on a clean tree.** In-place mutation plus a
  dirty working tree is the fastest way to lose real work.

## Skill routing (for implementer)
| Skill | When / which paths | Required? |
|---|---|---|
| `mermaid-diagram` | the ladder flowchart in `docs/guardrails.md` | yes |
| `security` | `.claude/hooks/commit-test-gate.mjs` — untrusted staged content, shelling out to lane commands, no secrets in the committed hook config, no silent bypass | yes |
| `typescript-expert` | `evals/skills/onion-architecture/*.cases.ts` and `reviewer-core/test/grounding.test.ts` (ESM `.js` import specifiers, `SkillCase` typing) | no — only if types fight back |
| `engineering-insights` | after the work lands: `reviewer-core/INSIGHTS.md` for the mutation/alias gotchas; `.claude/` hook findings belong in `docs/guardrails.md` | yes |
| `onion-architecture` | **do not load or edit as guidance** — it is the artifact under measurement in Phases 2–3 | no |
| `drizzle-orm-patterns`, `fastify-best-practices`, `postgresql-table-design`, `next-best-practices`, `react-best-practices`, `react-testing-library`, `zod` | not applicable — no server module, no DB, no client surface, no shared contract in scope | no |
| tests gap-fill | single-agent mode: the same agent writes `reviewer-core/test/grounding.test.ts`; each `it(...)` cites its `AC-NN` | yes (no `test-writer` spawn) |
| plan vs code check | — | **defer** to `plan-verifier` (**last**, read-only) |
| architecture boundaries | — | **defer**; no `architecture-reviewer` spawn in single-agent mode |
| logic / security / pre-PR | — | **defer** to `pr-self-review` after `plan-verifier` |
| feature docs | — | **defer** to `doc-writer`; `docs/guardrails.md` is an AC deliverable, not a second SDD spec |

## Out of scope for implementer
- The **product-plane eval pipeline** (SPEC-04): `eval_cases` / `eval_runs`
  tables, HTTP routes, "Turn into eval case", Evals tabs, Eval Dashboard. Do not
  touch `server/`, `client/`, or `docs/plans/eval-pipeline.md`.
- Any change under `evals/src/**` (engine internals) or to
  `server/src/vendor/shared` (`@devdigest/shared`).
- A second interception point (`PostToolUse`, or a second `PreToolUse` matcher)
  — AC-20 forbids it.
- Repo-wide mutation testing, a mutation-score gate, or driving the survivor
  count to zero. One module, one killable survivor.
- CI wiring: no new GitHub Actions workflow, no eval-score gate on any lane.
- Rewriting `.claude/skills/onion-architecture/**` so the eval passes; the only
  permitted edit there is the Phase 3 degradation, which is reverted.
- Adding a test lane to `evals/` or `e2e/` for the commit gate to run.
- Architecture review (`architecture-reviewer`), test gap-fill (`test-writer`),
  docs (`doc-writer`) — not spawned in single-agent mode.
- Plan verification (`plan-verifier`) — **last**, read-only, after the pass.
- Logic / security / pre-PR review (`pr-self-review`) — after `plan-verifier`.
- Opening PRs.

## Verification plan
Single-agent mode: the implementing agent owns both columns below. Do **not**
run a full `pnpm test` for `server/` or `client/` — neither package is modified.

### Implementer-owned (cheap, deterministic)
| Package | Command | Scope |
|---|---|---|
| `evals` | `cd evals && pnpm typecheck` | must pass; the new case files are the only new TS |
| `evals` | `cd evals && pnpm eval:quality` | static SKILL.md gate — proves the Phase 3 degradation did not break the artifact's structure, and that the revert restored it |
| `reviewer-core` | `cd reviewer-core && pnpm typecheck` | |
| `reviewer-core` | `cd reviewer-core && pnpm exec vitest run test/grounding.test.ts` | the new test only |
| `reviewer-core` | `cd reviewer-core && pnpm exec vitest run --passWithNoTests` | full hermetic lane once, to prove AC-25 (the gate's lane picks the new file up) |
| `.claude` hook | the four manual branches from Phase 4 (docs-only allow, red-lane block, green allow, not-evaluable block) | record the outputs; they are the AC-19 evidence |
| repo | `git status --short` and `git diff --stat .claude/skills/onion-architecture reviewer-core/src/grounding.ts` | both must be clean — proves AC-11 and AC-24 |
| `server`, `client`, `mcp`, `e2e` | — | not modified; do not run |

### Model-backed (billed, run deliberately)
| Command | Scope |
|---|---|
| `cd evals && pnpm vitest run skills/onion-architecture` | one wiring run: fact gate fires, judge returns per-practice verbatim evidence (AC-08, AC-09) |
| `cd evals && pnpm eval:repeat skills/onion-architecture -n 5 --label onion-v2-baseline` | before any artifact edit |
| `cd evals && pnpm eval:repeat skills/onion-architecture -n 5 --label onion-v2-broken` | with the degradation applied (AC-10) |
| `cd evals && pnpm eval:repeat skills/onion-architecture -n 5 --label onion-v2-restored` | after the revert (AC-11) |
| `cd evals && pnpm eval:delta onion-v2-baseline onion-v2-broken` | per-practice view of what the removed rule was carrying |

Keep `EVAL_BACKEND` at its default (`subscription`); no third-party API key is
required for any deterministic step.

### Mutation-observation-owned
| Command | Scope |
|---|---|
| `cd reviewer-core && pnpm test:mutation` (before the new test) | baseline `generated` / `killed` / `survived` (AC-21) |
| `cd reviewer-core && pnpm test:mutation` (after the new test) | same command, same source; chosen mutant flips to killed (AC-24) |

### plan-verifier
Trust the Implementation Report when the commands above already report `pass`.
Re-run only when a report is missing, `partial`, or `fail`, or when an AC cannot
be evidenced from files. AC-10, AC-11, AC-21, and AC-24 are evidenced by the
recorded numbers in `docs/guardrails.md` plus the gitignored
`evals/results/repeat-onion-v2-*.json` files — do **not** re-run the billed eval
tier to re-verify them.

## Open questions
- **Hook wire format.** The exact `PreToolUse` payload shape, matcher syntax,
  and allow/deny response format are unverifiable from this repo (no
  `settings.json`, no `hooks/`, no `PreToolUse` string anywhere). The naming,
  location, and matcher chosen in Phase 4 are implementation assumptions; confirm
  them against the installed runtime's documentation on first run, and adjust
  the file/matcher without changing the gate's behaviour.
- **Mutation tool.** Stryker is an assumption, not a dependency. Confirm the
  vitest runner works with `reviewer-core`'s vitest 2.1.8 and the
  `@devdigest/shared` path alias; otherwise switch to the command runner.
- **Is `mcp/` a gate lane?** It has a `test` script (`vitest run`) but does not
  appear in `TESTING.md`'s suite map. This plan includes it as a hermetic lane;
  drop it if the maintainer prefers the documented suite map verbatim.
- **Gate scope width.** Following the spec's assumption, the gate considers only
  packages whose files are staged. The per-package CI workflows encode a wider
  relation (`reviewer-core/**` also triggers the server unit lane via the path
  alias). The wider rule catches cross-alias breakage at the cost of latency.
- **Where the intercepted case lives.** This plan puts it in
  `docs/guardrails.md`; the spec leaves the home open. Moving it to a package
  `INSIGHTS.md` later changes nothing behaviourally.
