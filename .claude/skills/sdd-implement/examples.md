# sdd-implement examples

## Good parent Task

```
Execute the approved Implementation Plan at `docs/plans/blast-radius.md`.
Spec: `docs/specs/2026-08-14-blast-radius.md`.
Follow implementer.md. Overrides: none.
```

## Bad parent Task

Pasting the full English plan, research dump, or Implementation Report into
the next Task. Subagents already `Read` the files.

## Good stop

implementer returns `blocked` (shared-contract risk not approved) → orchestrator
stops, does not spawn architecture-reviewer / test-writer.

## Bad continue

implementer `partial`, orchestrator silently runs plan-verifier and reports
PASS on uncovered AC.
