# Dependency classification

`kind` = where it is declared. `type` = what it is for. Never mix them in
one column.

## Kind (from package.json)

| Kind | Meaning |
|---|---|
| `dependencies` | Runtime for that package |
| `devDependencies` | Build, test, types, codegen |
| `peerDependencies` | Expected to be provided by the host |
| `optionalDependencies` | Allowed to fail install |
| `alias` | tsconfig `paths` only |
| `vendor` | files under `src/vendor/` |
| `runtime` | Docker image, CLI binary, language toolchain |

`reviewer-core` is consumed as TypeScript **source**. A dep it needs at
review-time is `dependencies` even though the package `build` script is
`tsc --noEmit`.

## Type (assign exactly one)

Pick the most specific match. Name prefixes beat keywords.

| Type | When | Examples in this repo |
|---|---|---|
| `framework` | App/HTTP/UI runtime you structure the package around | `next`, `react`, `react-dom`, `fastify` |
| `framework-plugin` | Official/adjacent plugin for a framework | `@fastify/cors`, `@fastify/helmet`, `@fastify/autoload`, `@fastify/rate-limit`, `fastify-type-provider-zod`, `fastify-sse-v2` |
| `data` | DB client, ORM, query builder | `drizzle-orm`, `postgres` |
| `validation` | Schema/parsing as a contract | `zod` |
| `sdk` | External HTTP/product SDK | `openai`, `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`, `octokit`, `@modelcontextprotocol/sdk` |
| `search-index` | Code intelligence / grep / AST | `@ast-grep/napi`, `@vscode/ripgrep`, `dependency-cruiser`, `graphology`, `graphology-metrics` |
| `ui` | Components, charts, icons, markdown, diagrams in the browser | `lucide-react`, `recharts`, `mermaid`, `react-markdown`, `remark-gfm`, `next-intl` |
| `data-fetch` | Client-side server state | `@tanstack/react-query` |
| `util` | Small helpers, queues, git, env | `p-queue`, `simple-git`, `dotenv`, `js-tiktoken`, `gray-matter` |
| `css` | Styling pipeline | `tailwindcss`, `@tailwindcss/postcss`, `postcss` |
| `test` | Test runner, browser/DOM, containers | `vitest`, `@testing-library/*`, `jsdom`, `testcontainers`, `@testcontainers/postgresql` |
| `tooling` | Compiler, runner, types, kit | `typescript`, `tsx`, `@types/*`, `drizzle-kit`, `@vitejs/plugin-react`, `pino-pretty` |
| `internal` | First-party alias or vendor tree | `@devdigest/shared`, `@devdigest/reviewer-core`, `@devdigest/ui` |
| `infra` | Process/image/binary outside npm | Postgres image, `agent-browser`, Node/pnpm |

If nothing fits: `other` + a one-word note. Do not invent extra types.

## Prod vs weight

- **Install weight:** `devDependencies` still fill `node_modules` and CI
  caches. Report them.
- **Runtime/bundle weight:** for `client/`, call out `dependencies` that
  ship to the browser (`mermaid`, `recharts`, `react-markdown`) separately
  from Node-only tooling.
- **Server** has no bundler tree-shake story like Next — installed size ≈
  deploy size for that package.

## Signals (not types — put in Notes)

| Signal | How to spot |
|---|---|
| Duplicate name | Same name in ≥2 package.json files |
| Spec drift | Same name, different version range |
| Mixed lockfile | Both `pnpm-lock.yaml` and `package-lock.json` in one dir |
| Stale lockfile | `package-lock.json` beside a pnpm workflow |
| Heavy native | `@ast-grep/napi`, `@vscode/ripgrep`, testcontainers |
| Vendor drift risk | Two trees for `@devdigest/shared` |
| Boundary leak | Relative import into another package's `src/` (e.g. `reviewer-core/src/pipeline.js`) instead of its public alias; mcp/e2e importing server source |
