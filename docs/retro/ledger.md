# Workflow retro ledger

Append-only log of **manual** [`workflow-retro`](../../.claude/skills/workflow-retro/SKILL.md)
runs. English in this file; the chat report is Russian.

Do **not** paste full Task prompts, secrets, `.env` contents, or transcript
dumps. Token figures are `chars/4` estimates, not Cursor billed usage.

## Entry template

Copy, fill, append. Do not rewrite older entries.

```markdown
## YYYY-MM-DD — <short title>

**Session:** `<uuid>`
**Agents:** N launches (types: …)
**Cost (est.):** ~N tokens (parent ~A + children ~B)
**Order:** agent-a → agent-b ∥ agent-c

### Insights

1. **Insight:** …
   **Action:** `path/to/agent-or-skill` — what to change next time.
```

Dedup: skip a semantic duplicate of an Action already recorded. Refine with
a new dated entry that points at the old one. Contradict with a correction;
never delete.

## 2026-08-14 — SPEC-01 Project Context (spec-creator, no subagents)

**Session:** `edf8a05d-4fa8-4a50-8a66-8c1dcc222acc`
**Agents:** 0 launches
**Cost (est.):** ~15651 tokens (parent ~15651 + children ~0)
**Order:** parent-only (spec-creator in-process)

### Insights

1. **Insight:** For a docs-only SDD spec the parent still `Read` on-demand stack skills (onion-architecture, frontend-ui-architecture, security, zod, drizzle, fastify, postgresql-table-design). None of those reads changed AC or contracts beyond “no SQL / no impl recipe,” which spec-creator already forbids.
   **Why it matters:** All ~15.6k estimated tokens sat in the parent transcript; there was no child isolation. The stack-skill preload is paid even when the spec must not contain recipes.
   **Evidence:** `summarize-transcript.mjs` `launches.length=0`, `tokenEstimate.parent=15651`, `children=0`; transcript tool calls include those skill `Read`s before `Write` of `docs/specs/2026-08-14-project-context.md`.
   **Action:** `.claude/agents/spec-creator.md` Skills (on-demand) — add an explicit skip: do not load stack skills when the deliverable is a behaviour spec with invented HTTP names and no schema/SQL/route recipes.

## 2026-08-14 — SPEC-01 Project Context (implementation-planner)

**Session:** `30da6da0-c1c0-4615-9090-cc5442339f47`
**Agents:** 1 launch (types: planner)
**Cost (est.):** ~16204 tokens (parent ~3904 + children ~12300)
**Order:** planner (seq)

Vs previous ledger entry (same SPEC-01 spec-creator, ~15651 parent-only): similar total, but ~76% of tokens sat in the child instead of the parent.

### Insights

1. **Insight:** The parent spawned `planner` with a 3206-char Task prompt that restated `implementation-planner.md` (10 numbered “Do this” steps: Read spec, survey modules/INSIGHTS/skills, AC coverage rules, CI-runner out of scope) instead of spec path + Execution mode + plan slug. The spec itself was not pasted.
   **Why it matters:** `dumpSuspect=true` (threshold 2000). The child still `Read` the agent file, the spec, and `docs/plans/README.md` — the same three paths the parent had already `Read` (`duplicateReads`). Isolation worked (no resume, no parent takeover, only `docs/plans/project-context.md` written), but the briefing was paid twice.
   **Evidence:** `summarize-transcript.mjs` `launches[0].promptChars=3206`, `dumpSuspect=true`, `resumeCount=0`, `parentTakeover=false`; `duplicateReads` = spec + `implementation-planner.md` + `docs/plans/README.md`. Artifact-size table in `.claude/agents/README.md` has spec-creator→planner and planner→implementer rows, but no parent→planner prompt cap.
   **Action:** `.claude/agents/README.md` § Artifact size limits — add `parent → implementation-planner`: spec path + Execution mode + `docs/plans/<slug>.md` only; do not restate the agent’s Before you plan / format checklist (child Reads `.claude/agents/implementation-planner.md`).

