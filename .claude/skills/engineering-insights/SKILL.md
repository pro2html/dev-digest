---
name: engineering-insights
description: "Extracts non-obvious, verified engineering knowledge (gotchas, decisions, recurring fixes, library/tool limits) discovered during a work session and appends it to the right module's INSIGHTS.md (client/, server/, reviewer-core/, e2e/). Also reads those files before new work starts so past lessons aren't rediscovered. Use when the user asks to wrap up, capture insights, run engineering-insights, or after finishing a non-trivial task that surfaced a real gotcha, architectural decision, or confirmed fix — not after trivial edits."
---

# engineering-insights

Captures durable, non-obvious engineering knowledge into per-module
`INSIGHTS.md` files, and reads those files back before new work so the same
ground isn't re-covered. See `examples.md` for full good/bad entry pairs.

This repo has **no monorepo workspace** — four standalone packages, each with
its own `INSIGHTS.md`. Never write to one shared/global insights file.

## Routing table (real paths — verified against the repo, not assumed)

| Module | Package dir | `INSIGHTS.md` | Scope signals |
|---|---|---|---|
| client | `client/` | `client/INSIGHTS.md` | Next.js App Router pages/components, `src/lib/hooks/*`, `src/lib/api.ts`, TanStack Query, `next-intl`, vendored UI (`src/vendor/ui`), jsdom/vitest frontend tests |
| server | `server/` | `server/INSIGHTS.md` | Fastify routes/plugins (`src/modules/*`), Drizzle schema/migrations (`src/db/`), DI adapters (`src/adapters/*`, `src/platform/container.ts`), secrets/config, Postgres/pgvector |
| reviewer-core | `reviewer-core/` | `reviewer-core/INSIGHTS.md` | diff→prompt→LLM→findings pipeline (`src/review/*`), `src/llm/*` structured output, grounding/scoring, injected `LLMProvider` |
| e2e | `e2e/` | `e2e/INSIGHTS.md` | `agent-browser` CLI flows, `specs/*.flow.json`, `lib/run.ts`, cross-system/browser scenarios, seeded-DB assumptions |

Route by **where the insight lives and what it affects**, not by which file
happened to be open last. A fix to a Fastify route handler is `server`, even
if you were staring at a client hook when you noticed the bug. If a genuine
insight spans two modules (e.g., a client/server contract mismatch), write
one **adapted** entry to each relevant file — never a verbatim copy-paste.

If you cannot tell which module an insight belongs to with confidence,
**do not write it anywhere**. List it as an unresolved candidate in the final
report instead.

## Before starting new work (read step)

1. From the user's request, determine which module(s) are affected.
2. Read only those modules' `INSIGHTS.md` files. Read all four only when the
   task is genuinely cross-module.
3. Surface the handful of entries most relevant to the task at hand — don't
   dump the whole file back at the user.
4. Treat entries as high-confidence guidance, but verify against current code
   if an entry looks stale, contradicts what you're seeing, or references
   something that may have since changed.
5. Don't re-derive knowledge that's already recorded — build on it instead.

## Two trigger modes

**1. Explicit wrap-up** — user asks to capture insights / run
`engineering-insights` / wrap up after a task:
1. Review the session: diff, test results, errors and their fixes, dead ends.
2. Extract only candidates that pass the quality bar below.
3. Verify each against actual code/tests/docs — don't record a guess.
4. Route each to its module(s) via the table above.
5. Check for duplicates/contradictions in the target file (see Dedup rules).
6. Append entries (or skip, per the dedup/conflict rules).
7. Print the final report (format below).

**2. Capture-candidate during work** — mid-task, you notice something that
looks like a real, non-obvious lesson:
1. Note it as a candidate, but do **not** write it yet.
2. Only promote it to a written entry once it's corroborated — a test passes
   because of it, the code confirms it, or the same failure repeats. A
   single unverified hunch stays a candidate (or becomes an `Open Question`),
   never a `Pattern`/`Mistake`/`Decision`/`Recurring Error & Fix` entry.

## Quality bar — what counts as an insight

Use this test: **if any developer would see this immediately from a normal
read of the relevant code, it's not worth recording.**

Record:
- Non-obvious codebase patterns
- Architectural decisions and their reasons
- Library/API/tool limitations
- Recurring errors with a confirmed fix
- Approaches that were tried and didn't work
- Non-obvious cross-part dependencies
- Unusual build/test/local-run commands
- Environment/config/test-data quirks
- Anything that would save the next session a re-investigation or a wrong turn

Never record:
- A recap of the task or chat history
- A list of changed files
- Anything obvious from reading the code
- Generic advice ("handle errors", "be careful with async")
- Unverified guesses
- Details relevant only to this one task
- Secrets, tokens, credentials, `.env` contents, or other sensitive data
- Duplicates of an existing entry

If nothing in the session clears this bar, output exactly:

```
No new engineering insights worth recording.
```

and make no file changes.

## Categories

Use only the categories that actually apply — never pad with an unused one:

- **Pattern** — a confirmed approach that works
- **Mistake** — an approach/assumption that caused a problem, with the safe alternative
- **Decision** — an architectural/technical choice, with the reason
- **Context** — a non-obvious fact about the project, module, library, or environment
- **Recurring Error & Fix** — a repeatable error and its confirmed fix
- **Open Question** — an important question not yet confirmed, with what still needs checking

## Entry format

Check the target file first — if it already has an established format for
real entries, match it. Otherwise (all four files currently start from the
placeholder "_Nothing recorded yet._" template, so this is the format for
first real entries) use:

```markdown
## YYYY-MM-DD — Category

**Insight:** Concrete, specific, self-contained statement.

**Why it matters:** What mistake, re-investigation, or wrong decision this prevents.

**Evidence:** `relative/path/to/file.ext:line` — brief description of what confirms it.

**Action:** What to do or avoid in future work.
```

Rules:
- Understandable without this session's chat history.
- Concise, declarative, actionable.
- Real relative paths and line numbers when grounded in code — never invent a line number.
- If evidence isn't in code, name the command/test/observation that confirmed it instead of a path.
- `Decision` entries must state the reason.
- `Mistake` entries must state the safe/working alternative.
- `Open Question` entries must state what still needs verification.

## Dedup and append-only rules

1. **Append-only.** Never silently rewrite an existing entry, never
   reformat/rewrite the whole file, keep the diff minimal.
2. Before adding, check the target file for:
   - an **exact duplicate**,
   - a **semantic duplicate** (same lesson, different words),
   - an **older entry that contradicts** the new finding.
3. If the new insight **refines** an old one: append a new dated entry and
   reference the old one (e.g. "Refines the 2026-03-01 entry above:").
4. If the new insight **contradicts** an old one: do not delete the old
   entry. Append a dated correction that explicitly states the old entry no
   longer applies and why.
5. Skip anything that's an exact or semantic duplicate of what's already there.

## Safety

- No evidence, no write.
- Never present a hypothesis as a confirmed fact.
- Never include secrets, tokens, credentials, or `.env` contents.
- Never run destructive commands, force-push, or rewrite git history as part of this skill.
- Never commit changes unless the user separately asks for a commit.

## Final report format

After a wrap-up run, report:

1. **Recorded** — per file: category + one-line summary of each entry written.
2. **Skipped / unresolved** — candidates that didn't clear the quality bar, were duplicates, or couldn't be routed to a module with confidence (with the reason).
3. **Modules touched** — which `INSIGHTS.md` files were modified, if any.

If nothing qualified, just print the no-op sentence above — no per-file breakdown needed.
