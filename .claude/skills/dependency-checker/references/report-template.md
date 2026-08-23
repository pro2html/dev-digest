# Report template

Copy this markdown. Replace `<…>` placeholders. Keep heading text exact.
Prose under headings follows the user's language.

If a section has no rows, write `None.` — do not delete the heading.

Inner Mermaid blocks use standard `mermaid` fences. Do not add extra
top-level headings.

---

# Dependencies report — `<full repo | package dir>` — `<YYYY-MM-DD>`

## 1. Snapshot

| Metric | Value |
|---|---|
| Packages scanned | `<n>` — `<dir list from this run only; do not pad from inventory.md>` |
| Declared deps (prod / dev / other) | `<n> / <n> / <n>` |
| Unique npm names | `<n>` |
| Names in ≥2 packages | `<n>` |
| Spec drift (same name, different range) | `<n>` |
| Mixed lockfile dirs | `<n>` — `<dirs or None>` |
| Lockfile families | pnpm-only / npm-only / mixed / none — from `lockfileSummary` |
| Combined `node_modules` | `<human or n/a>` |

**One-paragraph read:** who depends on whom internally (aliases / vendor
copies vs npm), and the single heaviest or riskiest fact. No bullet dump.
State that first-party packages are standalone (no `workspace:*`).

## 2. Map

### 2.1 Internal (packages, aliases, runtime)

Use a `mermaid` `flowchart LR`. Dashed edges = path alias or vendor copy;
solid = HTTP / process / Docker. One-line legend under the chart.

### 2.2 Shared npm surface (names used by ≥2 packages)

Use a `mermaid` `flowchart LR`. Node = npm name; edge = consumer package.
Truncate to ~20 nodes and say so.

## 3. Per-package inventory

Repeat one block per scanned package.

### `<dir>/` — `<npm name>`

| | |
|---|---|
| Role | `<one line>` |
| Lockfile | `<pnpm-lock.yaml / package-lock.json / both / none>` |
| `node_modules` | `<human or n/a>` (direct declared: `<n>` prod / `<n>` dev) |
| Aliases | `<list or None>` |

**Dependencies** (direct only; sort prod then dev; then by size desc, then name):

| Name | Kind | Spec | Type | Size | Notes |
|---|---|---|---|---|---|
| `zod` | dependencies | `^3.24.1` | validation | `1.2 MB` or `n/a` | also in client, mcp |

Add a **Runtime extras** mini-table if inventory.md lists binaries/images
for this package.

## 4. Weight

### 4.1 Heaviest trees

| Package dir | `node_modules` | Notes |
|---|---|---|
| `server/` | `…` | |

### 4.2 Heaviest direct packages

Top 15 by `localBytes` (then registry unpacked size if you fetched it).

| Name | Where | Size | Type | Why it is that heavy (one clause) |
|---|---|---|---|---|

### 4.3 Duplicated cost

| Name | Consumers | Specs | Approx. install copies |
|---|---|---|---|

If `node_modules` is missing everywhere: skip byte columns, rank by
duplication and prod-vs-dev, and say so here.

## 5. Findings

| ID | Sev | Effort | Where | Finding | Evidence |
|---|---|---|---|---|---|
| F1 | P1 | S | `server/` | both lockfiles present | `server/pnpm-lock.yaml`, `server/package-lock.json` |

IDs `F1…Fn`. Evidence = path, JSON field, or command — not a vibe.

## 6. Priority backlog

Grouped **P0**, then **P1**, then **P2**. Each item: ID + one-line action.
Empty group: `None.`

## 7. Advice

Numbered 1…N. Each line:

`N. [P#] [effort] — action — why (evidence) — how to verify`

Max 8 items. First item is the next command or file to touch.

## 8. Method

- Script: `collect-deps.mjs` args and whether sizes were measured — or `user-pasted snapshot` if no script ran
- Registry `npm view`: yes/no, which names
- Unused-dep grep: yes/no
- Not in scope this run: (e.g. full `pnpm audit`, licenses, bundle analyzer)

---

## Chat wrapper (before the template)

Two sentences max:

1. Verdict: healthy / drift / bloat — with the headline number.
2. Pointer: "full report below" or path if written to disk.

Do not duplicate the tables in a second informal list.
