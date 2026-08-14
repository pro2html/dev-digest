---
name: workflow-retro
description: >-
  Parses Cursor agent transcripts after a multi-agent run and writes a
  cost/order/quality retro to chat plus docs/retro/ledger.md. Manual only —
  use when the user explicitly asks for workflow-retro, a workflow retro,
  agent-cost review, or to evaluate how subagents ran. Does not auto-run
  after sdd-implement or Task. Does not write package INSIGHTS.md (that is
  engineering-insights).
disable-model-invocation: true
---

# workflow-retro

Retrospective of **how a multi-agent session ran** (tokens, launch order,
hand-off waste, what agents missed). See [examples.md](examples.md) for
good/bad insight pairs.

**Manual only.** Do not load or run this skill unless the user explicitly
asked (`workflow-retro`, «оціни workflow», «ретро агентів», «скільки токенів
пішло на агентів»). Do not offer it after `sdd-implement`, after `Task`, or
on wrap-up. Do not auto-invoke from ambient context.

This is **not** [engineering-insights](../engineering-insights/SKILL.md).
Product/code lessons stay in package `INSIGHTS.md`. Process lessons stay
here (chat + `docs/retro/ledger.md`). Never write orchestration notes into
`client|server|reviewer-core|e2e|mcp/INSIGHTS.md`.

## Steps

Copy and track:

```
workflow-retro:
- [ ] 1. Resolve session
- [ ] 2. Run summarize-transcript.mjs
- [ ] 3. Qualitative pass (easy / hard / duplicated / missed)
- [ ] 4. Dedup against ledger
- [ ] 5. Chat report (Russian)
- [ ] 6. Append ledger (English)
```

### 1. Resolve session

Default: **this conversation**. If the user named a session id or a past
chat, use that.

Transcripts live outside the repo (do not commit them):

```
~/.cursor/projects/<slug>/agent-transcripts/<id>/<id>.jsonl
~/.cursor/projects/<slug>/agent-transcripts/<id>/subagents/<sub-id>.jsonl
```

`<slug>` for this repo is `Users-anton-Documents-Neoversity-dev-digest`.
If unsure, glob `~/.cursor/projects/*/agent-transcripts/`.

If the user did not name an id: pass `--latest` **only when they asked to
retro the most recent multi-agent run**, not as a silent default for an
unrelated chat.

### 2. Script (mandatory — do not re-parse JSONL by hand)

```bash
node .claude/skills/workflow-retro/scripts/summarize-transcript.mjs <session-id-or-jsonl-path>
# or
node .claude/skills/workflow-retro/scripts/summarize-transcript.mjs --latest
```

Treat the JSON as facts. Fields:

| Field | Use |
|---|---|
| `tokenEstimate` (`chars/4`) | Cost table. Label **estimate**, not billed usage. Use `parent`/`children`/`total` — do not sum `launches[].tokenEstimate` when a resume reused the same `subagentId` |
| `launches[]` | Count, order, resume vs fresh, prompt chars, `dumpSuspect` |
| `parallelGroups` | `∥` in the order list |
| `parentTakeover` | Parent `Write`/`StrReplace` after spawning Task |
| `fileOverlap` | Same path mutated by two agents |
| `duplicateReads` | Same path `Read` by parent and a child |
| `wallClock` | First→last `<timestamp>` |

If `launches.length === 0`: status `no-subagents`. Short report, no fake
insights, no ledger entry unless the user still wants one.

### 3. Qualitative pass

From script stats **plus** chat reports (Implementation Report, verifier
verdicts) — do not re-read full transcripts unless a signal is unclear.

Must cover:

- **Easy** — what finished without resume / takeover / rework
- **Hard** — empty return, resume, parent takeover, `blocked` / `FAIL`
- **Duplicated** — plan/spec pasted into Task (`dumpSuspect`), parent and
  child reading the same files, overlapping writes
- **Missed** — verifier findings the implementer should have caught; skipped
  stop-conditions; work the parent did that the agent owned

Also check [token-efficient hand-off](../../agents/README.md): Task prompt
should be **path + short overrides**, not the English plan/spec.

Quality bar (same test as engineering-insights): if it is obvious from
reading the orchestrator skill, skip it. An insight must name a **concrete
Action** (which agent file or skill to change). Never «агент добре
попрацював».

### 4. Dedup

Read [`docs/retro/ledger.md`](../../../docs/retro/ledger.md). Skip exact or
semantic duplicates of an existing Action. If this run **refines** an old
entry, append a dated note that references it. If it **contradicts**, append
a correction — do not delete the old row.

Optional: one sentence comparing ~tokens / agent count to the previous
ledger entry. Do not build a dashboard.

### 5. Chat report (Russian)

```markdown
# Workflow retro: <title / plan>

## Status
done | partial | no-subagents

## Cost (estimate)
| Who | ~tokens | wall-clock | notes |
| parent | … | … | |
| implementer #1 | … | … | resume / takeover |

Total ~N tokens. Method: chars/4 over transcripts. Not billed usage.

## Launch order
1. implementer (seq)
2. architecture-reviewer ∥ test-writer
…

## What was easy / hard / duplicated / missed
- …

## Proposed agent/skill tweaks (do not apply)
- `implementer.md`: …
```

### 6. Ledger append (English)

Append-only to `docs/retro/ledger.md`. Template is in that file. No full
Task prompts, no secrets, no `.env`, no transcript dumps.

Then `git add` the ledger (and only files this run changed). Do **not**
commit unless the user asked.

## Do not

- Auto-run, suggest, or mention this skill unless the user named it
- Edit `.claude/agents/*` or other skills — **propose** only
- Write package `INSIGHTS.md` (send the user to `engineering-insights` if
  a *code* lesson appeared, and only if they asked for that skill)
- Invent billed token counts
- Commit `agent-transcripts/`

## Additional resources

- Insight quality examples: [examples.md](examples.md)
- Ledger rules: [docs/retro/README.md](../../../docs/retro/README.md)
- Hand-off protocol: [agents/README.md](../../agents/README.md)
