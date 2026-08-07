# Skills A/B experiment

Both scenarios are run as before/after by toggling `agent_skills.enabled` only —
do **not** edit agent system prompts between runs. After each run, open the run
drawer → Trace → Prompt assembly and compare the Skills block and `tokens_in`.

**Signal that skills fired:** finding titles use the canary prefixes below.
A run without skills should not emit those prefixes (or should emit far fewer).

| Skill | Canary title prefix |
|---|---|
| `api-contract-breaking-change` | `[API-CONTRACT]` |
| `deprecation-policy` | `[DEPRECATION]` |
| `breaking-change` | `[BREAKING]` |
| `response-schema` | `[RESPONSE-SCHEMA]` |
| `server-discipline` | `[SEMVER]` |
| `test-coverage-nudge` | `[COVERAGE]` |
| `test-corner-cases` | `[CORNER]` |
| `pr-quality-rubric` | `[PR-QUALITY]` |

Bodies live in `docs/sample-skills/` (re-import or paste into Skills Lab after
edits). Seed Test Quality bodies are in `server/src/db/seed-prompts.ts` — if
skills were already seeded, update bodies in the UI (seed does not overwrite).

---

## Setup

1. `pnpm db:seed` in `server/` (creates Test Quality Reviewer + three linked skills).
2. For API Contract: import **one** skill —
   `docs/sample-skills/api-contract-breaking-change.md` — vet, enable, link to
   **General Reviewer**. Do **not** stack breaking-change / response-schema /
   server-discipline / deprecation-policy for the first A/B (they overlap the
   base prompt and blur the signal). Optional second skill: `deprecation-policy`.
3. Pick (or create) a PR for each scenario below.

---

## Scenario A — Test Quality

**Agent:** Test Quality Reviewer  
**PR:** a change whose tests cover only the happy path (add an untested error /
empty / boundary branch in production code, with a test that only asserts the
success path). Example branch: `lab02-tests` (`parsePageLimit`).

| Run | Skills linked & enabled | Expected |
|---|---|---|
| A1 | all three seed skills **disabled** on the agent | Soft review — likely miss the uncovered branch / corner case; **no** `[COVERAGE]` / `[CORNER]` titles; Prompt assembly has **no** Skills block; live log has no `skills.loaded`. |
| A2 | `test-coverage-nudge`, `test-corner-cases`, `pr-quality-rubric` **enabled** | Findings with `[COVERAGE]` / `[CORNER]` (and maybe `[PR-QUALITY]`); Skills block present; `skills.loaded`; higher `tokens_in`. |

**Expected findings (A2, illustrative):**

- WARNING/CRITICAL: `[COVERAGE] …` happy-path-only leaves a new branch untested.
- WARNING: `[CORNER] …` empty / invalid / max-boundary case not asserted.

---

## Scenario B — API Contract

**Agent:** General Reviewer  
**PR:** a route/DTO signature change that breaks callers (renamed/removed field,
changed status code, or narrowed type on a public contract). Example branch:
`lab-02-api-contract` (`Agent.enabled` → `is_enabled`, POST `201` → `200`).

| Run | Skills | Expected |
|---|---|---|
| B1 | `api-contract-breaking-change` **not linked** or link **disabled** | May still mention a rename (base prompt), but **no** `[API-CONTRACT]` titles and no Skills block. |
| B2 | skill linked, globally enabled, link **enabled** | At least one CRITICAL titled `[API-CONTRACT] …`; ideally also cross-package drift if only the server vendor copy changed; Skills block + `skills.loaded`; higher `tokens_in`. |

**Expected finding (B2, illustrative):**

- CRITICAL: `[API-CONTRACT] Agent.enabled → is_enabled breaks existing clients`
- CRITICAL: `[API-CONTRACT] Cross-package drift: Agent.enabled server vs client`
  (when client vendor still has `enabled`)

---

## Trace checklist (both scenarios)

For the **enabled** run:

1. Live log contains `skills.loaded` with `{ count, names }` matching the enabled set.
2. Trace → Prompt assembly → Skills block is present and readable per skill.
3. Each PromptBlock shows `~N tokens` (`ceil(text.length / 4)`).
4. `stats.tokens_in` is higher than the disabled run by approximately the Skills
   block token estimate.
5. Finding titles include the canary prefix for that skill.

For the **disabled** run:

1. No Skills block in Prompt assembly (slot `null`).
2. No `skills.loaded` event with those skill names.
3. No (or near-zero) canary-prefixed titles.
