# DevDigest dependency inventory

Verified against the repo layout. Re-check paths if a `package.json` appears
or disappears; do not assume a workspace.

## First-party packages

No root `package.json`. No `pnpm-workspace.yaml`. Each folder below has its
own lockfile and `node_modules`.

| Dir | npm name | Role | Typical install |
|---|---|---|---|
| `server/` | `@devdigest/api` | Fastify API + Drizzle/Postgres | `pnpm` (`pnpm-lock.yaml` **and** leftover `package-lock.json`) |
| `client/` | `@devdigest/web` | Next.js 15 studio UI | `pnpm` |
| `reviewer-core/` | `@devdigest/reviewer-core` | Pure review engine (source, no emit) | npm lockfile only (`package-lock.json`) |
| `e2e/` | `@devdigest/e2e` | Deterministic browser e2e | npm lockfile only (`package-lock.json`) |
| `mcp/` | `@devdigest/mcp` | Local stdio MCP → HTTP API | `pnpm` |
| `evals/` | `@devdigest/evals` | Harness evals (skills/agents) | `pnpm` — **not** in root `AGENTS.md` table |

Skip: `server/test/fixtures/conventions-repo/` (fixture, not a product package).

## Path aliases (not npm)

| Alias | Resolved from | Canonical? |
|---|---|---|
| `@devdigest/shared` | `server/src/vendor/shared` (server + reviewer-core tsconfig) | **Yes** — changing it ripples to client, server, reviewer-core |
| `@devdigest/shared` | `client/src/vendor/shared` (client tsconfig) | **Copy** — keep in sync with server vendor; do not "fix" only one side |
| `@devdigest/reviewer-core` | `reviewer-core/src` via `server/tsconfig.json` | Source import — no publish/dist step |
| `@devdigest/ui` | `client/src/vendor/ui` | Vendored UI primitives, client-only |
| `@/*` | `client/src/*` | App paths, not a package |

`mcp/` has **no** tsconfig path to server modules. Boundary is HTTP
(`DEVDIGEST_API_BASE`). An import of `server/src/modules/*` from mcp is a
finding.

`e2e/` has no `@devdigest/*` paths. It drives the browser against the
running web app.

## Runtime / binaries (often absent from package.json)

| Name | Where | Kind |
|---|---|---|
| `pgvector/pgvector:pg16` | `docker-compose.yml` | Docker image — only infra in Docker |
| Node ≥ 22, pnpm ≥ 10 | root README | Toolchain |
| `agent-browser` | `e2e/` (CLI, not an npm test runner) | External binary |
| LLM providers | env / Settings, not package-declared hosts | Outbound: OpenAI / Anthropic / OpenRouter |
| GitHub | `octokit` on server | Outbound API |

## Recurring shared npm names (expect duplication)

These are **declared independently** in several trees — that is normal here,
but version spec drift is a finding:

- `zod` — server, client, reviewer-core, mcp (contracts + validation)
- `openai` — server, reviewer-core, evals
- `typescript`, `tsx`, `vitest`, `@types/node` — almost every package
- `@anthropic-ai/sdk` (server) vs `@anthropic-ai/claude-agent-sdk` (evals) —
  related orgs, **not** the same package

## Course constraint

Standalone packages are intentional. Advice should reduce drift and bloat
**without** converting the repo into a workspace unless the user explicitly
wants that architectural change.
