# Development plans

Working Development Plans produced by the **planner** agent (**English**).

- Path: `docs/plans/<kebab-name>.md` (or `YYYY-MM-DD-<kebab-name>.md` when asked)
- Canonical contract for implementation: **implementer**, **plan-verifier**,
  **test-writer**, **architecture-reviewer**, and **doc-writer** Read these
  files (they already have `Read` / `Glob`). Chat summaries are Russian only;
  do not treat chat as a second plan.
- Orchestrators should pass the **file path** into Task prompts — do not paste
  the full plan. See [.claude/agents/README.md](../../.claude/agents/README.md)
  § Token-efficient hand-off.
- Not feature specs — those live in `docs/specs/` via **doc-writer** after
  implementation
