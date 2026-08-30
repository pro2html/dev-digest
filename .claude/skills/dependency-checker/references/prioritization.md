# Prioritization

Findings must be tied to collected facts. Severity is about **this repo**,
not generic npm scare-mongering.

## Severity

| Sev | Use when | Typical action |
|---|---|---|
| **P0** | Breaks the course layout, splits the shared contract, or is a clear supply-chain/secret mistake in deps (install scripts you don't understand, unexpected telemetry SDK, committed `.env` as a "dep") | Do before adding more packages |
| **P1** | Measurable cost or drift: mixed lockfiles, same lib on 2+ major/minor ranges, very large unused-looking prod dep, client shipping a fat library with a thin use site | Plan this sprint |
| **P2** | Hygiene: overlapping tools, `evals` missing from the mental map, a dep that could be native, docs vs install mismatch | Backlog |

If unsure between two severities, pick the **lower** one and say what would
promote it.

## Effort

| Size | Meaning |
|---|---|
| **S** | One file / delete leftover lockfile / align a caret range |
| **M** | Touch several packages, re-install, re-test |
| **L** | Architectural (workspace, extracting a real shared package, replacing a framework) |

Do not mark course-invariants as L-fixes. "Merge all packages into one
workspace" is L and **out of default scope**.

## What to flag (in order)

1. **Shared contract split** — `@devdigest/shared` copy vs canonical; any
   extra Zod models living only on one side.
2. **Boundary violations** — mcp/e2e importing `server/src`; a package
   importing another package's `src/` by relative path instead of the public
   alias/entry (e.g. `reviewer-core/src/pipeline.js`) — **P0**; reviewer-core
   growing DB/GitHub deps (it must stay side-effect-light).
3. **Lockfile confusion** — two lockfiles in one package; npm-only
   lockfile in a pnpm-first repo (`lockfileSummary.npmOnly`); docs vs files.
4. **Version drift** on `zod`, `openai`, `typescript`, `vitest`, `tsx`.
5. **Weight** — largest `node_modules`; fattest direct deps; client prod
   deps that pull diagrams/charts if unused in routes.
6. **Duplicate SDK stacks** — both OpenAI and Anthropic SDKs are expected
   on server (providers); still note three copies of `openai` across
   server / reviewer-core / evals as install cost, not as an error.
7. **Native / Docker heavies** — `@testcontainers/*`, `@ast-grep/napi`,
   ripgrep, Postgres image: warn on *adding more*, not on deleting the
   ones the product needs.
8. **Phantom deps** — imported but not declared; declared but zero
   imports (grep `from ['"]name` / `from ['"]name/`). Confirm before
   calling a dep unused — Fastify plugins are often imported once in
   `server.ts`.

## What not to flag as P0

- Presence of both OpenAI and Anthropic clients (multi-provider is a
  product feature).
- `evals/` existing outside the AGENTS.md five-package table (P2 docs).
- "You should use a monorepo."
- Transitive dep counts without a size or drift story.
- License text dumps (mention only if a dep is clearly non-permissive
  **and** the user asked about licenses).

## Advice shape

Each advice line:

```
N. [P#] [effort] — action — why (evidence) — how to verify
```

Lead with actions that remove **bytes or confusion** this week. End with
"do not do X" only when X would fight inventory.md (workspaces, publishing
reviewer-core, editing only one vendor/shared copy).
