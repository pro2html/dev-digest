# Implementation plans

Working Implementation Plans produced by the **implementation-planner** agent
(**English**).

- Path: `docs/plans/<kebab-name>.md` (or `YYYY-MM-DD-<kebab-name>.md` when asked)
- **Precondition:** an SDD spec at `docs/specs/YYYY-MM-DD-*.md` (`SPEC-NN`,
  `AC-01`…), preferably `Status: approved`, with **no**
  `[NEEDS CLARIFICATION]` markers. Plans do not invent product requirements;
  every Approach task cites `AC: AC-NN`.
- Canonical contract for implementation: **implementer**, **plan-verifier**,
  **test-writer**, **architecture-reviewer**, and **doc-writer** Read these
  files (they already have `Read` / `Glob`). Chat summaries are Russian only;
  do not treat chat as a second plan.
- Orchestrators: load
  [sdd-implement](../../.claude/skills/sdd-implement/SKILL.md). Pass the
  **file path** into Task prompts — do not paste the full plan. Read
  **Execution mode** (`multi-agent` vs `single-agent`) before spawning
  specialists:
  - multi-agent: `implementer` → `architecture-reviewer` + `test-writer`
    (parallel) → `plan-verifier` last
  - single-agent: one pass for code+tests, then still run `plan-verifier`
  See [.claude/agents/README.md](../../.claude/agents/README.md)
  § Token-efficient hand-off.
- Not feature specs — those live in `docs/specs/` via **spec-creator** (SDD)
  before planning. `doc-writer` does not create a second undated spec after
  implementation.
