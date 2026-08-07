# client/ — CLAUDE.md

`@devdigest/web`: Next.js 15 App Router UI — import repos, browse PRs, run/read
AI reviews, author agents. Data via TanStack Query hooks over the Fastify API.

- **Stack:** Next.js 15 (App Router), React 19, TanStack Query 5,
  `next-intl` (messages in `messages/<locale>/*.json`), `recharts`, `mermaid`,
  `react-markdown`, Tailwind 4. Zod 3 for shared contracts.
- **Run:** `pnpm dev` (`:3000`). **Test:** `pnpm test` (vitest + jsdom, fetch
  mocked — no API needed). **Typecheck:** `pnpm typecheck`.
- **Map:** `src/app/**/page.tsx` are thin route pages; feature logic sits in
  colocated components; every data hook lives in `src/lib/hooks/*` and calls
  `src/lib/api.ts`. UI primitives are vendored under `src/vendor/ui`
  (`@devdigest/ui`); shared Zod contracts under `src/vendor/shared`.

## Non-default conventions

- `NEXT_PUBLIC_API_BASE` (default `http://localhost:3001`) is the only API
  entry point — never fetch directly from a component, go through
  `src/lib/hooks/*`.
- UI primitives in `src/vendor/ui` and contracts in `src/vendor/shared` are
  **vendored copies**, not local components — check the vendor source/course
  lesson before "fixing" something there that looks like a bug.

## Gotchas

- Fetch is mocked in tests (jsdom), not hitting a real API — a passing test
  doesn't guarantee the live API contract still matches; check
  `../server/CLAUDE.md` when touching a route both sides depend on.

## Read when

- UI route map / API surface diagram → [`README.md`](README.md)
- Architecture decisions → [`docs/`](docs/README.md)
- Feature/behavior specs → [`specs/`](specs/README.md)
- Past gotchas/lessons learned → [`INSIGHTS.md`](INSIGHTS.md)
