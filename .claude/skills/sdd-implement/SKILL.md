---
name: sdd-implement
description: >
  Orchestrates the DevDigest SDD implementation chain from an approved
  Implementation Plan: implementer → architecture-reviewer + test-writer
  (parallel) → plan-verifier → pr-self-review → optional doc-writer. Use when
  the user asks to implement a plan, execute an implementation plan, run the
  implementation flow, sdd-implement, or continue after implementation-planner.
  Does NOT write specs or plans (those are spec-creator / implementation-planner).
---

# SDD implement (orchestrator)

You are the **parent orchestrator**. You do not implement product code yourself
in **multi-agent** mode. You spawn the named subagents, pass **paths not
dumps**, and stop on hard failures.

Does **not** run `spec-creator` or `implementation-planner`. If those artifacts
are missing, stop and tell the user to run them first.

Agent map: [../../agents/README.md](../../agents/README.md).
Task prompt templates: [prompts.md](prompts.md).

## When to run

- User: implement the plan / execute implementation / sdd-implement / «запусти
  имплементацию»
- After `implementation-planner` left a `docs/plans/<kebab>.md`

Do **not** use this skill to author a spec or a plan.

## Preconditions

1. Resolve the plan path (`docs/plans/<kebab>.md`). If missing — ask; do not
   invent scope.
2. `Read` only: **Spec source**, **Execution mode**, **Success criteria**,
   **AC coverage**, **Skill routing**, **Verification plan**. Do not paste the
   rest into Task prompts.
3. `Read` the spec path from Spec source. **Stop** (ask the user) if:
   - spec has `[NEEDS CLARIFICATION`
   - spec `Status:` is `draft` and the user did not override
4. Copy the pipeline checklist below and track it.

```
SDD implement:
- [ ] 1. Plan + spec gates
- [ ] 2. Execution mode
- [ ] 3. Implement (or single-agent pass)
- [ ] 4. architecture-reviewer ∥ test-writer
- [ ] 5. Fix CRITICAL architecture (≤1 round)
- [ ] 6. plan-verifier (once)
- [ ] 7. pr-self-review
- [ ] 8. doc-writer (only if asked)
- [ ] 9. Orchestration report
```

## Execution mode

From the plan. **Do not default silently** — ask if unset.

| Mode | What you spawn |
|------|----------------|
| **multi-agent** | `implementer` → `architecture-reviewer` **and** `test-writer` in parallel → `plan-verifier` last → `pr-self-review` → optional `doc-writer` |
| **single-agent** | You execute Approach + tests yourself (follow [implementer.md](../../agents/implementer.md) + [test-writer.md](../../agents/test-writer.md); load Skill routing). Spawn only **`plan-verifier`**, then run `pr-self-review`. Do not spawn implementer / test-writer / architecture-reviewer / doc-writer |

Prefer a **fresh chat** for this skill if the current thread already holds the
full spec+plan. Subagents must still `Read` the plan file.

## Token rules (mandatory)

- Task prompt = plan path + spec path + short overrides + (after impl)
  **Changed paths**. Never paste the English plan, spec, or prior reports.
- One plan-verifier run. Re-run only for finding IDs you asked to fix.
- Do not merge implementer with review. Do not skip plan-verifier.
- Verifiers start from Changed paths. `plan-verifier` trusts pass reports;
  no extra full-suite `pnpm test`.

## Multi-agent pipeline

Spawn via Task; `subagent_type` = agent `name` (`implementer`,
`architecture-reviewer`, `test-writer`, `plan-verifier`, `doc-writer`).
Use [prompts.md](prompts.md). Subagents must not spawn further agents.

### 3. implementer

Wait until it returns. Status:

- `blocked` → stop; report; do not spawn reviewers
- `partial` → ask the user whether to continue; default **stop**
- `done` → keep Changed paths + Verification table for later Tasks

### 4. Parallel: architecture-reviewer + test-writer

Same plan path + Changed paths. Architecture-reviewer = **boundaries only**
(not logic bugs). test-writer tests must cite `AC-NN`.

### 5. Architecture CRITICAL

If verdict `FAIL` (any `CRITICAL`): one scoped implementer (or you, in
single-agent) on those IDs/paths, then re-run architecture-reviewer on that
allowlist. Then continue. No second unsolicited fix round.

### 6. plan-verifier (last)

After tests are in and CRITICAL architecture is clear. Pass plan path +
Changed paths + note that Implementation/Test reports already recorded
command results.

- `FAIL` → stop; list residual gaps; no PR
- `PARTIAL` → ask; default stop
- `PASS` → continue

### 7. pr-self-review

Load [pr-self-review](../pr-self-review/SKILL.md) and run it on the uncommitted
diff. Do not open a PR on `BLOCK`.

### 8. doc-writer

Only if the user asked for docs **or** the plan requires feature docs. Never
create an undated twin of `docs/specs/YYYY-MM-DD-*.md`.

## Stop conditions

| Condition | Action |
|-----------|--------|
| No plan / no AC | Stop → `implementation-planner` / `spec-creator` |
| `[NEEDS CLARIFICATION]` or unapproved draft | Stop → `spec-creator` |
| implementer `blocked` | Stop |
| plan-verifier `FAIL` | Stop |
| pr-self-review `BLOCK` | Stop (no PR) unless user overrides |

Do not commit or open a PR unless the user asked.

## Orchestration report (Russian)

```markdown
# SDD implement: <plan title>

## Status
done | stopped | blocked

## Plan
`docs/plans/<kebab>.md`

## Execution mode
multi-agent | single-agent

## Steps
| Step | Agent / skill | Result |
| implementer | … | done / partial / blocked |
| architecture-reviewer | … | PASS / FAIL |
| test-writer | … | done / skip |
| plan-verifier | … | PASS / PARTIAL / FAIL |
| pr-self-review | … | PASS / BLOCK / skip |
| doc-writer | … | done / skip |

## Changed paths
- …

## Next
- … (fix IDs, or ready)
```
