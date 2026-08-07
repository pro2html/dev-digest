# server/ — AGENTS.md

`@devdigest/api`: Fastify 5 + Drizzle ORM over Postgres (pgvector). Adapters
(LLM, GitHub, git, ast-grep, tokenizer, secrets) sit behind a DI container
(`src/platform/container.ts`) so they can be swapped for mocks in tests.

- **Stack:** Node (`type: module`), TypeScript 5.7, Fastify 5, Drizzle ORM
  0.38, `postgres` driver, Zod 3 (route schemas via `fastify-type-provider-zod`
  — one schema drives request validation **and** response serialization).
- **Run:** `pnpm dev` (`:3001`, `tsx watch`). **Migrate/seed:**
  `pnpm db:migrate`, `pnpm db:seed`. **Test:** `pnpm test` (vitest).
  **Typecheck:** `pnpm typecheck`.
- **Map:** `src/modules/<name>/` is a self-contained Fastify plugin
  (routes + service); `src/adapters/` are the DI-swappable ports;
  `src/db/` is the Drizzle schema/migrations; `src/vendor/shared` is the
  cross-package Zod contract package (`@devdigest/shared`).

## Non-default conventions

- No keys required to boot — `loadConfig` (`src/platform/config.ts`) marks
  every secret optional; keys can be set at runtime via Settings instead.
- Secrets live in `~/.devdigest/secrets.json` (mode `0600`), never in git or
  the DB. Single read chokepoint: `LocalSecretsProvider`
  (`src/adapters/secrets/local.ts`). `GITHUB_TOKEN` is canonical,
  `GITHUB_PAT` is an accepted fallback.
- The DB schema already contains every table for the full course — unused
  ones sit empty until a later lesson's module fills them. Don't "clean up"
  empty tables/columns.

## Gotchas

- `reviewer-core` is consumed as **TypeScript source** via a tsconfig path
  alias, not a built package — don't add a build/publish step for it here.
- Route validation and response shape are the **same** Zod schema; changing
  one without checking the schema breaks both directions silently.

## Read when

- Public routes / request-DI flow diagram → [`README.md`](README.md)
- Architecture decisions → [`docs/`](docs/README.md)
- Feature/behavior specs → [`specs/`](specs/README.md)
- Past gotchas/lessons learned → [`INSIGHTS.md`](INSIGHTS.md)
