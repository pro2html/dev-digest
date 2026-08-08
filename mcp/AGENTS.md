# mcp/ — AGENTS.md

`@devdigest/mcp`: local **stdio** MCP server (course L04 `devdigest-mcp`).
Exposes five intent-shaped tools that talk to `@devdigest/api` over HTTP —
never embeds Fastify/Drizzle.

- **Stack:** Node ≥ 22 (`type: module`), TypeScript, `@modelcontextprotocol/sdk`,
  Zod 3, Vitest, `tsx`.
- **Run:** `pnpm start` / `pnpm dev` (stdio — normally spawned by Cursor via
  `.cursor/mcp.json`). **Test:** `pnpm test`. **Typecheck:** `pnpm typecheck`.
- **Map:** `src/index.ts` boots stdio; `src/server.ts` builds `McpServer`;
  `src/tools/` registers tools in fixed order; `src/api/` is the thin HTTP
  client + resolve/wait helpers; `src/schemas/` holds flat arg + result Zod.

## Non-default conventions

- Process boundary is HTTP only (`DEVDIGEST_API_BASE`, default
  `http://localhost:3001`). Do not import `server/src/modules/*`.
- Secrets stay with the API (`~/.devdigest/secrets.json`). MCP never reads LLM
  or GitHub keys; do not put them in `.cursor/mcp.json`.
- Tool order is locked: `list_agents` → `run_agent_on_pr` → `get_findings` →
  `get_conventions` → `get_blast_radius`.
- `get_blast_radius` calls `GET /pulls/:id/blast` after resolving `repo` + `pr`
  (HTTP only — never import `server/src/modules/*`).

## Gotchas

- Cursor spawns a separate stdio child; the API must already be running
  (`cd server && pnpm dev` or `./scripts/dev.sh`).
- Long `run_agent_on_pr` waits poll `GET /pulls/:id/runs`; on timeout the
  result includes `run_id` so the host can call `get_findings` later.

## Read when

- Tool contracts / env → [`README.md`](README.md)
- Past gotchas → [`INSIGHTS.md`](INSIGHTS.md) (if present)
