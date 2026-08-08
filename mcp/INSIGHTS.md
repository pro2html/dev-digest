# mcp/ — insights

Lessons learned and gotchas discovered while working in this package, that
aren't obvious from the code or the README. Append as they come up; keep each
entry short (what happened, what to do instead).

## 2026-08-08 — Context

**Insight:** Cursor docs for project `.cursor/mcp.json` list stdio fields as
`type`, `command`, `args`, `env`, `envFile` — they do **not** document `cwd`.
`pnpm --dir ${workspaceFolder}/mcp exec tsx src/index.ts` is the portable way
to set the package working directory so `node_modules` resolves correctly.

**Why it matters:** Copying a `cwd: "mcp"` snippet from the plan can silently
fail on Cursor versions that ignore unknown keys, leaving the child process in
the repo root without `@devdigest/mcp` deps.

**Evidence:** [Cursor MCP docs](https://cursor.com/docs/mcp) STDIO field table;
wiring in `.cursor/mcp.json` for L04.

**Action:** Prefer `--dir ${workspaceFolder}/mcp` (or an absolute path in
`args`) over relying on `cwd` in `mcp.json`.

## 2026-08-08 — Decision

**Insight:** `get_blast_radius` was an intentional HTTP-free stub
(`not_implemented`) for the L04 homework scaffold. The real tool now calls
`GET /pulls/:id/blast` after `resolveRepo` + `resolvePull` and projects a
compact `BlastRadiusResult` (caps on downstream/callers/endpoints).

**Why it matters:** Flat args stay `repo` + `pr`; hosts must not invent graph
edges — `status`/`reason` from the API are authoritative (`ok`|`partial`|
`degraded`).

**Evidence:** `mcp/src/tools/get-blast-radius.ts`, `projectBlastResult` in
`schemas/results.ts`, `test/blast-stub.test.ts`.

**Action:** Keep projecting through MCP schemas (do not dump raw
`PrBlastRecord`); never import `server/src/modules/*`.
