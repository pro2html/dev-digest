# DevDigest — repo map

Course starter: local-first AI PR review. Four standalone packages, **no
monorepo workspace** — each has its own `package.json`/lockfile; cross-package
code is shared via tsconfig path aliases, not published modules.

| Folder           | Package                    | What it is                                 | Port |
|------------------|----------------------------|---------------------------------------------|------|
| `server/`        | `@devdigest/api`           | Fastify + Drizzle/Postgres (pgvector)       | 3001 |
| `client/`        | `@devdigest/web`           | Next.js 15 web app                          | 3000 |
| `reviewer-core/` | `@devdigest/reviewer-core` | Pure review engine (diff → LLM → findings)  | —    |
| `e2e/`           | `@devdigest/e2e`           | Deterministic browser e2e (agent-browser)   | —    |

Only **Postgres** runs in Docker (`docker-compose.yml`); API and web run on the
host via `pnpm dev` inside each package.

## Non-default conventions

- No root install/build — `cd` into a package and run its own scripts.
- Cross-package imports go through tsconfig path aliases (e.g.
  `@devdigest/reviewer-core`, `@devdigest/shared`), not npm packages.
- Secrets never live in git or the DB — see `server/AGENTS.md`.

## Read when

- Full architecture diagram, review flow end to end → [`README.md`](README.md)
- Working on a specific package's conventions/gotchas → its own
  `<package>/AGENTS.md`
- Writing/using LLM reviewer agent prompts → [`docs/agent-prompts/`](docs/agent-prompts/README.md)
- Local test setup across packages → [`TESTING.md`](TESTING.md)

## Engineering insights

- Before starting work: identify the affected module(s), read their
  `INSIGHTS.md` (`client/`, `server/`, `reviewer-core/`, `e2e/`), and treat
  entries as high-confidence guidance — verify against current code if an
  entry looks stale or contradicts what you see.
- After a substantive task (not a trivial edit): run the
  `engineering-insights` skill to capture confirmed, non-obvious, reusable
  knowledge into the relevant module's `INSIGHTS.md`. Skip it for trivial
  changes.

## Do-not-touch

- `server/src/vendor/shared` (`@devdigest/shared`) is the one schema every
  package imports — changing it ripples into `client`, `server`, and
  `reviewer-core` simultaneously.
