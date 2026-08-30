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

## 2026-08-30 — SPEC-06 Multi-Agent Review (sdd-implement, constrained)

**Session:** `1c51b395-c48c-40fd-a779-8cfe9ae17633`
**Agents:** 5 launches (types: implementer, architecture-reviewer ×3, plan-verifier)
**Cost (est.):** ~24244 tokens (parent ~9451 + children ~14793)
**Order:** implementer → architecture-reviewer (fail) → architecture-reviewer (fail) → architecture-reviewer → plan-verifier

Vs previous ledger entry (SPEC-01 planner, ~16204, 1 launch): ~1.5× tokens; parent share ~39% (takeover) vs ~24% on that planner run.

### Insights

1. **Insight:** The single implementer Task was interrupted after ~37 min. The child jsonl only has the first 3 Reads (~430 tokens) and no Implementation Report, but Phases 1–6 were already on disk. The parent did not `resume` that `subagentId`; it audited the tree, fixed `service.ts`, ran implementer-owned typecheck/vitest, and later wrote `server/INSIGHTS.md`.
   **Why it matters:** `sdd-implement` only defines implementer outcomes as `blocked` / `partial` / `done`. There is no interrupt path. The plan’s open question already allowed continuing the **same** implementer — the parent instead re-read the whole Changed-paths set (`duplicateReads` includes plan, spec, and almost every new module file) and took over writes (`parentTakeover` on `service.ts` + `INSIGHTS.md`).
   **Evidence:** `summarize-transcript.mjs` `launches[0].subagentId=c32b0e76-…`, `tokenEstimate=430`, `mutatePaths=[]`, `resumeCount=0`, `parentTakeover=true`, `parentWritesAfterTask` = `multi-agent/service.ts` + `server/INSIGHTS.md`.
   **Action:** `.claude/skills/sdd-implement/SKILL.md` §3 implementer — if the Task is interrupted or returns without a report while files exist, `resume` the same `subagentId` (verification + Implementation Report). Do not start a parent completeness Read of the allowlist.

2. **Insight:** `architecture-reviewer.md` (and `plan-verifier.md`) pin `model: sonnet`. Two Task launches failed immediately with “Other Models usage limit”; `model: inherit` still failed (frontmatter wins). The third launch with explicit `cursor-grok-4.6-high-fast` ran (~6044 tokens, PASS_WITH_WARNINGS). Two unmatched child jsonls are 36-token error stubs.
   **Why it matters:** Constrained mode already skipped test-writer; the retry tax was three identical 801-char prompts and a matching bug (successful grok transcript attributed to launch[1]). Reviewers cannot start until the parent guesses an override.
   **Evidence:** `launches[1–3]` same `promptPrefix`, `launches[2].model=inherit` + `subagentId=null`; unmatched `6819bf90-…` / `fb610a8a-…`; agent frontmatter `model: sonnet` in `.claude/agents/architecture-reviewer.md` and `plan-verifier.md`.
   **Action:** `.claude/agents/architecture-reviewer.md` + `plan-verifier.md` — default `model: grok` (same as implementer), or document that the parent must pass an explicit grok/fast slug when Other Models is exhausted; `inherit` does not override YAML `model: sonnet`.

3. **Insight:** The plan’s Execution mode was `constrained-multi-agent`, which is not in the sdd-implement table (only `multi-agent` | `single-agent`). The parent followed the plan’s 3-step spawn list correctly (skip test-writer / pr-self-review / doc-writer).
   **Why it matters:** The skill says “do not default silently — ask if unset” but does not name this third mode. A later orchestrator may spawn the full chain (or refuse) and ignore the plan’s token cap.
   **Evidence:** `docs/plans/multi-agent-review.md` Execution mode `constrained-multi-agent`; `.claude/skills/sdd-implement/SKILL.md` Execution mode table has two rows only; this session `parallelGroups=[]`, no test-writer launch.
   **Action:** `.claude/skills/sdd-implement/SKILL.md` Execution mode table — add `constrained-multi-agent`: honor the plan’s spawn list and skips; do not expand to the default full chain.

