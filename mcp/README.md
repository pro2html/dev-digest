# @devdigest/mcp — DevDigest local MCP server (L04)

Stdio MCP server that exposes **five intent-shaped tools** unique to DevDigest.
It talks to the running `@devdigest/api` over HTTP (`DEVDIGEST_API_BASE`) — it
does **not** embed Fastify, Drizzle, or LLM secrets.

## Prerequisites

1. Postgres + API up (`./scripts/dev.sh` or `cd server && pnpm db:migrate && pnpm
   dev`).
2. Optional demo data: seeded repo `acme/payments-api`, PR `#482`.
3. This package installed: `cd mcp && pnpm install`.

MCP does **not** start Docker or the API.

## Tools (tools/list order)

| Tool | Side effect? | Purpose |
|------|--------------|---------|
| `list_agents` | no | All agents with `enabled` (no prompts/schemas) |
| `run_agent_on_pr` | **yes** | Start review → wait → concise findings |
| `get_findings` | no | Verdict for an existing `run_id` |
| `get_conventions` | no | Repo convention candidates (L02 data) |
| `get_blast_radius` | no | PR impact map via `GET /pulls/:id/blast` (symbols → callers → endpoints) |

## Environment

| Var | Default | Purpose |
|-----|---------|---------|
| `DEVDIGEST_API_BASE` | `http://localhost:3001` | API base URL (no secrets) |
| `DEVDIGEST_MCP_POLL_MS` | `2000` | Poll interval while waiting on a run |
| `DEVDIGEST_MCP_TIMEOUT_MS` | `300000` | Default wait timeout for `run_agent_on_pr` |

LLM / GitHub secrets stay with the API (`~/.devdigest/secrets.json` / `server/.env`).
Never put API keys in `.cursor/mcp.json`.

## Cursor wiring

Project file [`.cursor/mcp.json`](../.cursor/mcp.json) (verified against Cursor
docs: `mcpServers` + stdio `command`/`args`/`env`; `${workspaceFolder}` for
cwd-safe launch without relying on unsupported `cwd`):

```json
{
  "mcpServers": {
    "devdigest": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["--dir", "${workspaceFolder}/mcp", "exec", "tsx", "src/index.ts"],
      "env": {
        "DEVDIGEST_API_BASE": "http://localhost:3001"
      }
    }
  }
}
```

Restart Cursor MCP after changing the file. Toggle the server under **Customize → MCPs**.

## Other hosts (stdio)

```bash
cd mcp && DEVDIGEST_API_BASE=http://localhost:3001 pnpm exec tsx src/index.ts
```

## Scripts

```bash
cd mcp
pnpm install
pnpm test        # hermetic unit tests (mocked fetch)
pnpm typecheck
pnpm start       # stdio server (for hosts)
```

## Token-cost note

Approximate cost of the five tool definitions as returned by `tools/list`
(names + descriptions + JSON Schema input properties), measured once after
registration: **~1.0k tokens** (stringified tools array ≈ 4044 chars ≈ 1011
tokens at ~4 chars/token). Keep descriptions tight; never return
`system_prompt` or full evidence snippets in tool results.

## Layout

See [`AGENTS.md`](AGENTS.md).
