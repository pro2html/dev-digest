# Examples

## Good report (shape)

- Headings 1–8 match [report-template.md](references/report-template.md).
- Snapshot numbers match `collect-deps.mjs` JSON (`packageCount`, `mixedLockfileDirs`).
- Snapshot `Packages scanned` lists **this run only** — not every row in inventory.md.
- Internal diagram has dashed `@devdigest/shared` / `@devdigest/reviewer-core` and solid `client → server` HTTP plus Postgres. npm names (`zod`, `fastify`) live on the **shared npm** chart, not mixed in as the same kind of edge.
- Relative `reviewer-core/src/…` import is a **P0** boundary leak, separate from alias edges.
- Explicit line: packages are standalone (no `workspace:*` / no pnpm workspace).
- `zod` is `validation` in `dependencies`, not `tooling`.
- Mixed `pnpm-lock.yaml` + `package-lock.json` is a **P1 / S** finding, not P0.
- Advice line 1 is a concrete next action (`rm server/package-lock.json` only if the team is pnpm-only — verify README first).

## Bad report (reject)

- Essay without the template headings.
- Adding `mcp/` / `evals/` to Snapshot because inventory.md lists them, when collect data only had four packages.
- Treating `@devdigest/shared` (or `@shared/review-types`) as something to `pnpm add`.
- P0: "migrate to a pnpm workspace".
- "These packages are linked via `workspace:*` / pnpm workspaces".
- Listing every transitive dep from the lockfile.
- Invented megabyte numbers when JSON has `"localBytes": null`.
- A 40-node Mermaid of `node_modules`.

## Chat wrapper

**Good:** «По репо — drift, не bloat: 6 пакетов, mixed lockfile в server/. Полный отчёт ниже.»

**Bad:** Repeating every table as bullets, then the same tables again.
