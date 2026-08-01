# Skill routing (path → lenses)

Match each in-scope path. A skill is loaded only if ≥1 path matches it.
Multiple skills may apply to one file. Order within a package does not matter.

## Path table

| Path pattern | Skills |
|---|---|
| `client/src/app/**` | `next-best-practices`, `frontend-ui-architecture` |
| `client/src/components/**` | `react-best-practices`, `frontend-ui-architecture` |
| `client/src/lib/hooks/**` | `react-best-practices`, `frontend-ui-architecture` |
| `client/src/lib/**` (non-hooks) | `react-best-practices`, `next-best-practices` when Next-specific |
| `client/src/**/*.test.{ts,tsx}` | `react-testing-library` |
| `server/src/modules/**` | `fastify-best-practices`, `security` |
| `server/src/app.ts`, `server/src/server.ts`, `server/src/platform/**` | `fastify-best-practices` |
| `server/src/adapters/**` | `fastify-best-practices` (ports/adapters), `security` if secrets/auth |
| `server/src/db/schema/**`, `server/src/db/migrations/**` | `drizzle-orm-patterns`, `postgresql-table-design` |
| `**/contracts/**`, or files defining `z.object` / Zod schemas | `zod` |
| `server/src/vendor/shared/**` | `zod`, `typescript-expert`, **and** treat as do-not-touch (see severity) |
| `client/src/vendor/shared/**` | same as shared vendor |
| `reviewer-core/src/**` | `typescript-expert`, `zod` |
| `e2e/**` | no catalog skill — use `e2e/AGENTS.md` + `e2e/INSIGHTS.md` only |
| any `*.{ts,tsx}` | `typescript-expert` (baseline, low priority — load only if no stronger lens already covers the file, or when types/generics are the issue) |

## Force rules (override globs)

| Signal in diff | Action |
|---|---|
| Auth, sessions, JWTs, ownership checks | always include `security` |
| `.env*`, secrets, API keys, tokens in source | always include `security`; likely CRITICAL |
| File uploads, raw `req.body` / query without parse | always include `security` |
| Cross-layer import in `server/src/modules/**` or `server/src/adapters/**` (e.g. domain/application code importing Drizzle, Fastify, or an SDK directly) | also read `onion-architecture` if present under `.claude/skills/` |
| Only `*.md` / `.github/**` / docs | fast-path: no skill lenses |

## Skills never auto-routed here

| Skill | Why |
|---|---|
| `mermaid-diagram` | Authoring diagrams, not reviewing diffs |
| `engineering-insights` | Capture lessons after work; run separately if appropriate |

## How to apply a lens

1. Read `.claude/skills/<name>/SKILL.md`.
2. Open only the referenced rule files needed for issues you see in **this**
   diff slice — do not dump entire skill trees into context.
3. Tag each finding with `skill: <name>`.
