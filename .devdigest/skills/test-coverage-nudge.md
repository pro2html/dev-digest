# test-coverage-nudge

Insist on branch coverage for every control-flow change in the PR.

## Lab canary (MUST)

Every finding from this skill MUST use a title starting with:

`[COVERAGE]`

Example: `[COVERAGE] empty-string limit path untested — only happy-path parse covered`

Without the prefix the finding does not count as skill-driven.

## Rules
- For each new or changed `if` / `else` / `switch` / early `return` / catch
  in production code, require at least one test that **enters that path**.
- Happy-path-only suites are always a finding: name the uncovered branch and
  the exact input that would exercise it.
- Prefer behavioural assertions (status, returned shape, side effect) over
  spy "was called" counts alone.

## Severity
- Untested branch that can ship a production defect → CRITICAL if nothing else
  would catch it; otherwise WARNING.
- Missing assertion on an already-invoked path → SUGGESTION.

## Verdict
At least one `[COVERAGE]` WARNING/CRITICAL on a new branch ⇒ do not `approve`.
