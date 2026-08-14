# workflow-retro — quality examples

Illustrative only. Never copy these into `docs/retro/ledger.md`; each real
entry must be grounded in a specific session's script output.

## Bad vs good

**Bad** (generic, no action):

```markdown
The implementer worked well. Tokens were high.
```

**Good** (specific, actionable):

```markdown
**Insight:** The parent pasted the full Phase 1 brief (~12k chars) into the
implementer Task prompt instead of `docs/plans/blast-radius.md` + a short
scope line.

**Why it matters:** The child re-read the same plan from disk, so the dump
was paid for twice; the first spawn returned empty and needed a resume.

**Evidence:** `summarize-transcript.mjs` launch[0].promptChars=12104,
`dumpSuspect=true`; resume of the same subagent id 3 minutes later;
parent then wrote `server/src/modules/blast/*` itself (`parentTakeover`).

**Action:** `sdd-implement/prompts.md` implementer template — keep path +
Changed paths only; add a hard cap note (~800 chars) in the orchestrator
skill.
```

---

**Bad** (recap of the chat):

```markdown
We ran implementer, then the client agent, then MCP was done by the parent.
```

**Good** (missed ownership):

```markdown
**Insight:** No `implementer` Task was spawned for `mcp/`; the parent wrote
`get-blast-radius.ts` after server+client returned.

**Why it matters:** MCP conventions (`AGENTS.md`, stub tests, HTTP-only
boundary) live in the child prompt, not in the parent context — easy to
drift from `mcp/INSIGHTS.md`.

**Evidence:** `launches` has implementer ×2 (server, resume) and implementer
×1 (client); zero launches with mcp paths; parent `Write` on
`mcp/src/tools/get-blast-radius.ts`.

**Action:** `.claude/agents/implementer.md` or the orchestrator prompt —
when the plan has a dedicated MCP phase, spawn a scoped implementer (or
wait for the server route) instead of parent takeover.
```

## Applying the bar

- "Two agents ran in parallel" → not an insight (visible from launch order).
- "Client and server implementers both edited `vendor/shared/contracts/brief.ts`"
  → insight (`fileOverlap`), Action: Phase 0 stays on the parent / one owner.
- "Tests passed" → not an insight.
- "plan-verifier FAIL on AC-04 that implementer marked done" → insight
  (missed self-check), Action: implementer's verification table.
