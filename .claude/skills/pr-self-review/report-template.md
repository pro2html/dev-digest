# Report template

Emit this structure in the chat response and write the same body to
`.pr-self-review/report.md`.

```markdown
# PR Self Review

**Verdict:** PASS | BLOCK
**Gate:** agent-side only (no hooks). On BLOCK, do not open a PR unless the user explicitly overrides.

## Scope

- **In scope (uncommitted):** N files (list paths, or "none")
- **Out of scope:** M commit(s) on branch not reviewed (vs `origin/main` if available; else "unknown")
- **Excluded from review content:** … (lockfiles / migration meta / …)
- **Skills loaded:** `skill-a`, `skill-b`, … (or "none — docs fast-path")

## Counts

| Severity | Count |
|----------|------:|
| CRITICAL | 0 |
| WARNING  | 0 |
| SUGGESTION | 0 |

## Findings

### CRITICAL

- **`path:line`** — title  
  Confidence: HIGH · Skill: `…`  
  Rationale: …

_(or "None")_

### WARNING

- …

_(or "None")_

### SUGGESTION

- …

_(or "None")_

## Next step

- If **BLOCK:** list the CRITICAL items to fix; refuse `gh pr create` until fixed or user overrides.
- If **PASS:** optional PR draft below.

## PR draft (PASS only)

## Summary
- …

## Test plan
- [ ] …
```

## Short-circuit cases

For a clean worktree or the docs-only fast path, skip the full template above
and print just the header + verdict + one-line scope, e.g.:

```markdown
# PR Self Review

**Verdict:** PASS
**Scope:** no uncommitted changes — nothing to review.
```
