# Skills A/B experiment

Both scenarios are run as before/after by toggling `agent_skills.enabled` only —
do **not** edit agent system prompts between runs. After each run, open the run
drawer → Trace → Prompt assembly and compare the Skills block and `tokens_in`.

## Setup

1. `pnpm db:seed` in `server/` (creates Test Quality Reviewer + three linked skills).
2. In the UI, import `docs/sample-skills/api-contract-breaking-change.md`, vet it,
   enable the skill globally, and link it to **General Reviewer** (Skills tab).
3. Pick (or create) a PR for each scenario below.

---

## Scenario A — Test Quality

**Agent:** Test Quality Reviewer  
**PR:** a change whose tests cover only the happy path (add an untested error /
empty / boundary branch in production code, with a test that only asserts the
success path).

| Run | Skills linked & enabled | Expected |
|---|---|---|
| A1 | all three seed skills **disabled** on the agent | Soft review — likely miss the uncovered branch / corner case; Prompt assembly has **no** Skills block; live log has no `skills.loaded` (or `count: 0` is not emitted — slot omitted). |
| A2 | `test-coverage-nudge`, `test-corner-cases`, `pr-quality-rubric` **enabled** | Findings about the uncovered branch and the missing corner case; Prompt assembly shows a **Skills** block with `### <skill-name>` sections; live log shows `skills.loaded` with those names; `tokens_in` higher than A1 by roughly the Skills block size (`ceil(chars/4)` on the block). |

**Expected findings (A2, illustrative):**

- WARNING/CRITICAL: happy-path-only test leaves the new error/empty branch untested
  (`test-coverage-nudge`).
- WARNING: boundary / nullish / empty-collection case not asserted
  (`test-corner-cases`).

---

## Scenario B — API Contract

**Agent:** General Reviewer  
**PR:** a route/DTO signature change that breaks callers (renamed/removed field,
changed status code, or narrowed type on a public contract).

| Run | Skills | Expected |
|---|---|---|
| B1 | `api-contract-breaking-change` **not linked** or link **disabled** | General Reviewer may miss or under-rank the break; no Skills block from this skill. |
| B2 | skill linked, globally enabled, link **enabled** | Breaking change called out (typically CRITICAL); Skills block present with `### api-contract-breaking-change`; `skills.loaded` in the live log; `tokens_in` higher than B1. |

**Expected finding (B2, illustrative):**

- CRITICAL: renamed/removed response field (or status/nullability change) breaks
  existing clients — cite the route/schema line and old vs new contract.

---

## Trace checklist (both scenarios)

For the **enabled** run:

1. Live log contains `skills.loaded` with `{ count, names }` matching the enabled set.
2. Trace → Prompt assembly → Skills block is present and readable per skill.
3. Each PromptBlock shows `~N tokens` (`ceil(text.length / 4)`).
4. `stats.tokens_in` is higher than the disabled run by approximately the Skills
   block token estimate.

For the **disabled** run:

1. No Skills block in Prompt assembly (slot `null`).
2. No `skills.loaded` event with those skill names (skills were not injected).
