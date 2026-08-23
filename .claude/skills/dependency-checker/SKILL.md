---
name: dependency-checker
description: >-
  Audits npm, tsconfig-path, vendored, and runtime dependencies across
  DevDigest packages (server, client, reviewer-core, e2e, mcp, evals).
  Collects declared specs and installed sizes, draws Mermaid maps, classifies
  each dependency by type, and ends with a P0/P1/P2 backlog plus concrete
  advice. Use when the user asks for a dependency check, dependency audit,
  npm/pnpm graph, package weight/size, bundle or node_modules bloat, version
  drift, duplicate lockfiles, or which packages depend on what — including
  Ukrainian/Russian phrasing (залежності, залежності репозиторію, checker
  залежностей, аудит зависимостей, сколько весит пакет). Does NOT review
  Onion import direction (onion-architecture), write Fastify/Drizzle code
  (those skills), or run a security pentest (security) — CVE/advisory notes
  stay high-level unless the user asked for an audit.
---

# Dependency checker

Fact-first audit of **this repo's dependency surface**: standalone packages
(no pnpm workspace), tsconfig path aliases, vendored copies, and runtime
binaries/images. The deliverable is a structured developer report, not a
chat essay.

Do not invent sizes, versions, or edges. If a number is missing, write `n/a`
and say why (e.g. `node_modules` not installed). Shape examples:
[examples.md](examples.md).

## Scope

| Default | Also include | Exclude unless asked |
|---|---|---|
| Every first-party `package.json` one level under the repo root | tsconfig `paths`, `src/vendor/*`, `docker-compose.yml` images, known binaries in [references/inventory.md](references/inventory.md) | `node_modules` contents as a dump, fixture `package.json` under `**/test/fixtures/**`, `.claude/`, lockfile *contents* beyond name/version drift |

This repo is **not** a monorepo workspace. Do not recommend "enable pnpm
workspaces" as a P0 fix — that fights the course layout. Treat version drift
and duplicated installs as **costs of that choice**, then advise how to live
with it (pin ranges, drop stale lockfiles, don't add a sixth copy of `zod`).

## Workflow

Copy and track:

```
Dependency checker:
- [ ] 1. Scope
- [ ] 2. Collect (script, or user-pasted snapshot)
- [ ] 3. Classify + inventory
- [ ] 4. Diagrams
- [ ] 5. Weight
- [ ] 6. Findings + priority + advice
- [ ] 7. Report
```

### 1. Scope

- **Full repo** (default): all discovered packages.
- **One package**: only if the user named it (`server`, `@devdigest/api`, …).
  Still draw the **internal** graph so aliases/runtime stay visible.
- Read [references/inventory.md](references/inventory.md) before interpreting
  aliases — `@devdigest/shared` is a path, not an npm package.

**This run vs inventory:** `inventory.md` explains aliases and runtime extras.
It is **not** a package list to copy into the report. §1 Snapshot lists only
packages present in the collect JSON — or in data the user already pasted.
Do not add `mcp/` / `evals/` (or any other dir) just because inventory
mentions them. Pasted sizes/imports **are** the collect output: do not ask
for tools and do not fill gaps from inventory.

**Kinds of edge — never collapse into one list:**

| Kind | Looks like | Report as |
|---|---|---|
| Path alias / vendor | `@devdigest/shared`, `@shared/review-types` → `src/vendor/…` | **internal** (`type: internal`) — not npm |
| Public package entry | `@devdigest/reviewer-core` via tsconfig `paths` | **internal**, allowed |
| Relative leak | `reviewer-core/src/pipeline.js` or `../other-pkg/src/…` | **boundary leak** — P0 |
| npm | `zod`, `fastify`, `moment` | **external** — `dependencies` / `devDependencies` |

Say explicitly that first-party packages are **standalone** (own lockfile,
no `workspace:*`, no pnpm workspace). Do not describe them as linked via
workspaces.

### 2. Collect (do not hand-parse lockfiles)

If the user already pasted collect JSON, package lists, sizes, or grep
results, **skip the script** — that paste is this run's source of truth.
Do not merge extra packages from inventory.md.

Otherwise, from the repo root:

```bash
node .claude/skills/dependency-checker/scripts/collect-deps.mjs
# one package:
node .claude/skills/dependency-checker/scripts/collect-deps.mjs --package server
# skip du (faster; sizes become n/a):
node .claude/skills/dependency-checker/scripts/collect-deps.mjs --no-sizes
```

Treat stdout JSON as the source of truth. If the script fails, fix the
invocation (path / cwd) and rerun — do not silently switch to guessing from
`package.json` alone unless the script is genuinely unusable; then say so in
§8 Method.

Optional enrichment (only when the user cares about **published** weight and
local `node_modules` is missing or they asked):

```bash
npm view <name> dist.unpackedSize version --json
```

Cap at the **15 heaviest or most-duplicated** names. Never `npm install` as
part of this skill.

### 3. Classify + inventory

Map each declared dependency with [references/classification.md](references/classification.md).
Keep `kind` (`dependencies` / `devDependencies` / `peer` / `optional`)
separate from `type` (framework, sdk, data, …).

Cross-check JSON against inventory:

- Path aliases vs real folders
- Canonical `@devdigest/shared` vs the client vendor copy
- Runtime extras that never appear in `package.json` (Postgres image,
  `agent-browser`)

### 4. Diagrams

Mermaid in the report, following `mermaid-diagram` (≤ ~20 nodes per chart;
split rather than spaghetti).

Required:

1. **Internal map** — first-party packages, path aliases, vendor copies,
   runtime (Postgres). Dashed = alias/vendor, solid = HTTP/process/runtime.
2. **Shared npm surface** — a name used by ≥2 packages (node = package name,
   edge label = count of consumers). If >20 names, show top 20 by
   `(consumerCount * weight)` and note the truncation.

Optional (single-package scope): one flowchart of that package's **direct**
deps grouped in subgraphs by `type`. Collapse leftover names into
`other (N)`.

No unlabeled arrows. No `node_modules` trees as diagrams.

### 5. Weight

Prefer **installed** bytes from the script (`nodeModulesBytes`, per-dep
`localBytes`). Rank:

- Heaviest package trees (`node_modules`)
- Heaviest direct deps (followed symlink size when pnpm)
- Same name installed in several trees (`openai`, `zod`, `typescript`, …)

If sizes are `null`, rank by duplication + declared kind (prod > dev) and
say the install is missing.

Per-dep `localBytes` is the followed package directory (pnpm symlink into
`.pnpm`). Do **not** sum those rows and expect them to equal
`nodeModulesBytes` — the tree includes the store and transitives.

### 6. Findings + priority + advice

Score with [references/prioritization.md](references/prioritization.md).
Every finding needs: evidence in the JSON or a file path, severity, effort
(S/M/L), and **one** next action.

Advice is a short ordered list — what to do this week, not a lecture on
supply-chain theory.

### 7. Report

Follow [references/report-template.md](references/report-template.md)
**section-for-section**. Do not add extra top-level headings. Omit a table
row only when the cell would be empty for every package (then state that in
§8).

**Language:** section headings stay in **English** (stable, grep-able).
Prose, notes, and advice follow the user (Ukrainian / Russian / English).

Default destination: the chat. Write a markdown file only if the user asked
(`docs/…` or a named path). Do not commit unless they asked.

## Related skills

- Import-direction / ports & adapters → `onion-architecture`
- Auth, injection, secrets → `security` (link out; don't duplicate OWASP)
- Diagram syntax details → `mermaid-diagram`
