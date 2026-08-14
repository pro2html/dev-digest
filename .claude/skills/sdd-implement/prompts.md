# Task prompts (sdd-implement)

Keep every Task prompt **short**. The subagent `Read`s the files. Do not paste
plan, spec, or prior full reports.

Replace bracketed values. Chat language for reports: **Russian**.

## implementer

```
Execute the approved Implementation Plan at `docs/plans/<kebab>.md`.
Spec: `docs/specs/YYYY-MM-DD-<feature>.md`.
Follow implementer.md: Skill routing per phase, targeted typecheck/vitest only,
Changed paths in the Implementation Report.
Overrides: <none | user bullets>
```

## implementer (scoped fix round)

```
Fix only these architecture findings on plan `docs/plans/<kebab>.md`:
<ID list>
Paths: <allowlist>
Do not expand scope. Return an Implementation Report with updated Changed paths.
```

## architecture-reviewer

```
Architecture boundary review for plan `docs/plans/<kebab>.md`.
Changed paths (start here):
- `path/one`
- `path/two`
Boundaries only (Onion / UI / packages). Not a logic-bug hunt.
```

## test-writer

```
Write tests for plan `docs/plans/<kebab>.md`.
Changed paths: <list>
Each new `it(...)` must cite `AC-NN` from the plan.
Follow TESTING.md; e2e out of scope unless the plan says otherwise.
```

## plan-verifier

```
Verify code against plan `docs/plans/<kebab>.md` (contract: every AC / phase / skill row).
Spec: `docs/specs/YYYY-MM-DD-<feature>.md`.
Changed paths: <list>
Implementation Report and Test Report already recorded command results —
trust `pass`; do not re-run full package suites unless reports are missing or failed.
```

## doc-writer

```
Document the implemented feature for plan `docs/plans/<kebab>.md`.
Changed paths: <list>
Do not create an undated `docs/specs/<kebab>.md` if a dated SDD spec already exists.
```
