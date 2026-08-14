# Feature specs (SDD)

Spec Driven Development specs produced by **spec-creator**
(`.claude/agents/spec-creator.md`). Alias: spec-planner.

## New specs (canonical)

- Path: `docs/specs/YYYY-MM-DD-<kebab-feature>.md` (flat — **no** subfolders)
- Spec ID `SPEC-NN` lives **in the file body**, not in the filename
- Multi-package features: still one file at this top level (`Packages:` lists
  all touched packages)
- Language: **English** prose; EARS **triggers** in acceptance criteria use
  Ukrainian (`КОЛИ`, `ПОКИ`, `ЯКЩО`/`ТОДІ`, `ДЕ`); AC body is English
  `the system shall` (see [ears-requirements](../../.claude/skills/ears-requirements/SKILL.md))
- Specs cover behaviour, workflows, service communication, and contracts
  (HTTP / MCP / events / errors) — **not** implementation recipes (those are
  `implementation-planner` plans)
- Invented names and unconfirmed SLAs go under **Assumptions**, not silent fact
- Critical unknowns use `[NEEDS CLARIFICATION: …]` (max 3) — spec-creator does
  not guess; implementation-planner does not plan while markers remain
- Status lifecycle: `draft` → `approved` → `implemented` (`spec-creator` creates
  drafts; status promotion is human-directed). Plan only after `approved`
  unless the user overrides
- Orchestrators should pass the **file path** into Task prompts — do not paste
  the full spec. See [.claude/agents/README.md](../../.claude/agents/README.md)
  § Token-efficient hand-off

## Legacy narrative specs (do not rewrite)

These predate the SDD template. Leave them alone unless a human explicitly
asks to edit a named file:

- [`skills-feature.md`](./skills-feature.md)
- [`conventions-extractor.md`](./conventions-extractor.md)

They are not dated `spec-creator` files and are **not** owned by `spec-creator`
by default.

## Not Implementation Plans

Working implementation checklists / phase plans live under
[`docs/plans/`](../plans/) via **implementation-planner**. Every plan task
must cite an `AC-NN` from the spec. `spec-creator` writes **requirements
specs** here, not `docs/plans/` files. After implementation, do **not** add an
undated twin spec — promote `Status:` on this file instead.
