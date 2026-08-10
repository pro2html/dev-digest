# Development Plan: DevDigest local MCP server (L04)

## Goal

- Add a **local-only** MCP server (`stdio` transport) that exposes **exactly five**
  intent-shaped tools unique to DevDigest, so Cursor (or any MCP host) can list
  agents, run a review and wait for findings, read a completed run, read repo
  conventions, and call a honest blast-radius **stub**.
- Package name / course label: **`devdigest-mcp`** (README L04). npm name:
  `@devdigest/mcp`.
- Tools must follow Course 4 principles: **Result not Operation**, **Flat
  Arguments**, **Concise Structured Response**, **Error Leads Forward** — plus
  token-efficiency / annotation / secrets practices from prior research.

## Success criteria

- [ ] New top-level package `mcp/` (`@devdigest/mcp`) with its own
      `package.json` / lockfile / vitest / typecheck — **no** monorepo workspace
- [ ] Stdio MCP server boots via `tsx` (or built `node`) and registers tools in
      **deterministic order**: `list_agents` → `run_agent_on_pr` →
      `get_findings` → `get_conventions` → `get_blast_radius`
- [ ] All five tools implemented with flat args, tight descriptions, thin
      `inputSchema`, MCP annotations, and concise JSON results (no raw API dumps)
- [ ] `run_agent_on_pr` is the **only** write/side-effect tool: create review →
      wait until terminal → return compact verdict + findings (LLM must not
      orchestrate those steps)
- [ ] `get_blast_radius` returns explicit `not_implemented` (never fake success)
- [ ] Project-scoped `.cursor/mcp.json` wires stdio; secrets/API URL only via
      env (never keys in `mcp.json`)
- [ ] Package unit tests (mocked HTTP) + typecheck pass; README/`AGENTS.md` for
      the package document run/env/tools
- [ ] Thin `GET /runs/:id/summary` on server (workspace-scoped) for
      `get_findings({ run_id })`; server tests + typecheck pass; **no**
      `vendor/shared` edits
- [ ] Root `AGENTS.md` + `README.md` include a one-line `mcp/` package row
- [ ] Token-cost note for tools/list definitions measured once and recorded in
      package README or `INSIGHTS.md` after implementer run
- [ ] **No** CI workflow for `mcp/` in this MVP (deferred)
- [ ] **No** edits to `server/src/vendor/shared` / `client/src/vendor/shared`

## Affected modules

| Module | Why | Notes from AGENTS.md / INSIGHTS.md |
|--------|-----|-------------------------------------|
| **`mcp/` (new)** | Entire MCP server package | Follows root convention: standalone package, own install/scripts; course L04 `devdigest-mcp` |
| `server/` | Consumed over HTTP; **one thin MVP addition**: `GET /runs/:id/summary` for `get_findings(run_id)` | Auth = `LocalNoAuthProvider` (no Bearer). Review is fire-and-forget + poll (`POST /pulls/:id/review`, `GET /pulls/:id/runs`, `GET /pulls/:id/reviews`). Conventions = `GET /repos/:id/conventions`. Agents = `GET /agents`. Existing `/runs/:id/trace` & `/events` pattern — summary joins run + review projection without touching vendor/shared. |
| `client/` | Untouched | — |
| `reviewer-core/` | Untouched | Review engine stays behind the API |
| `e2e/` | Out of MVP | Browser e2e does not cover MCP stdio |
| Root `.cursor/mcp.json` | Cursor project wiring | Create; gitignore secrets only if any appear (should not) |

### Facts verified in repo (research brief)

| Concern | Fact | Path / evidence |
|---------|------|-----------------|
| No existing MCP product code | Zero `*mcp*` product files; only Next.js debug MCP skill docs | Grep / Glob |
| Course lesson | L04 = `` `devdigest-mcp` server · Blast Radius `` | `README.md` |
| Agents list | `GET /agents` → `Agent[]` (id, name, description, provider, model, enabled, …) | `modules/agents/routes.ts` |
| Start review | `POST /pulls/:id/review` body `{ agentId }` → `{ runs, reviews: [] }` immediately; work is background | `reviews/service.ts` `runReview` |
| Wait / status | `GET /pulls/:id/runs` (`status`: running/done/failed/cancelled); active = `…/runs/active`; SSE optional | `run.repo.ts`, client polls 4s |
| Findings | `GET /pulls/:id/reviews` → `ReviewDto` with `verdict`, `score`, `findings[]`, `run_id` | `reviews/helpers.ts` |
| Conventions | `GET /repos/:id/conventions?status=` → `{ candidates, last_scan, index_state }` | `conventions/routes.ts` + L02 spec |
| Repo resolve | `GET /repos` → `full_name`; PR list `GET /repos/:id/pulls` includes `number` | `repos/`, `pulls/routes.ts` |
| Auth local | No login; `getContext` → default workspace | `adapters/auth/local.ts` |
| Secrets | `~/.devdigest/secrets.json` + env via API — never DB/git | `server/AGENTS.md` |
| Blast later | `RepoIntel.getBlastRadius` already exists on facade; **MCP must still stub** for homework | `repo-intel/types.ts`, `service.ts` |
| Package layout | Four packages today; **no** workspace | root `AGENTS.md` |

## Constraints & risks

- **No monorepo workspace** — `cd mcp && pnpm install`; do not add pnpm-workspace /
  turbo / root package scripts that install everything.
- **Do not embed Fastify / Drizzle in the MCP process.** Cursor spawns a separate
  stdio child; the API already owns runs, `runBus`, LLM keys, and DB. Embedding
  would duplicate DI, fight the live API's in-memory bus, and pull secrets into
  a second process incorrectly.
- **One allowed server addition:** `GET /runs/:id/summary` so MCP `get_findings`
  can take flat `run_id` only. Everything else reuses existing routes.
- **Reuse via HTTP client** against the running `@devdigest/api`
  (`DEVDIGEST_API_BASE`, default `http://localhost:3001`). Map tools → existing
  routes; do not wrap REST 1:1 as five shallow clones of every endpoint.
- **Do not touch `@devdigest/shared` vendor copies** for MVP. Define MCP result
  Zod schemas **inside** `mcp/` (projection layer). High-risk ripple if shared
  is edited (INSIGHTS: two byte-identical copies).
- **Secrets:** never put API keys / GitHub tokens in `.cursor/mcp.json`. MCP only
  needs `DEVDIGEST_API_BASE` (optional). LLM/GitHub secrets stay with the API
  (`LocalSecretsProvider`).
- **Local-only assumption:** MCP talks to localhost; no remote auth story in MVP
  (`LocalNoAuth`). If API is down → actionable error ("start API via
  `./scripts/dev.sh` or `cd server && pnpm dev`").
- **Token budget:** tool results must cap findings/conventions; never return full
  `system_prompt`, full evidence snippets by default, or entire review traces.
- **`run_agent_on_pr` duration:** reviews can take tens of seconds; need timeout +
  poll interval; long MCP tool calls may hit host limits — document and fail
  forward with `run_id` so caller can `get_findings` later.
- **Identifier UX:** HTTP APIs use UUIDs; MCP flat args use human `repo`
  (`owner/name`) + `pr` (number) + `agent` (uuid from `list_agents`). Resolution
  is internal (Result not Operation).
- **Blast stub honesty:** existing `getBlastRadius` on repo-intel must **not** be
  called from the MCP stub; homework will wire the real tool later.
- **Security (implementer must follow `security` skill):** validate/coerce inputs
  with Zod; treat API error bodies as untrusted text when forwarding; do not log
  secrets; bind only to configured base URL (no user-controlled host SSRF —
  `repo`/`pr`/`agent` are not URLs).

## Approach

### Decision: package location

**Create top-level `mcp/`** (not `server/src/modules/mcp`).

| Option | Verdict | Why |
|--------|---------|-----|
| Top-level `mcp/` | **Chosen** | Matches "standalone packages, no workspace"; separate Node process for stdio; own deps (`@modelcontextprotocol/sdk`); course name `devdigest-mcp`; keeps Fastify free of MCP lifecycle |
| Inside `server/` | Rejected | MCP is not an HTTP plugin; Cursor spawn ≠ API boot; would mix transports and deps |
| Inside `reviewer-core/` | Rejected | Engine is pure diff→LLM; no I/O / HTTP / MCP |

Folder: `mcp/` · Package: `@devdigest/mcp` · Binary entry: `mcp/src/index.ts`
(stdio). Optional bin name `devdigest-mcp` in `package.json`.

### Decision: tech stack

| Choice | Recommendation |
|--------|----------------|
| SDK | **`@modelcontextprotocol/sdk`** (official TypeScript SDK) +
  `StdioServerTransport` |
| Not FastMCP | FastMCP is primarily Python / different ecosystem; repo is TS end-to-end |
| Runtime | Node ≥ 22, `"type": "module"`, **`tsx`** for dev (same as `server`/`e2e`) |
| Validation | **Zod 3** for tool args + result projections (align with repo; optional
  zod-to-json-schema for `inputSchema` if SDK needs JSON Schema) |
| HTTP | Native `fetch` (Node 22) thin `ApiClient` — no axios |
| Tests | **Vitest** hermetic unit tests with mocked `fetch` |

Rationale for stdio + official SDK: Cursor project MCP expects a local command
(`command` + `args` + `env`); stdio is the local default; official SDK gives
stable tool registration, annotations, and list ordering control.

### Architecture (MCP ↔ API)

```text
Cursor  --stdio-->  @devdigest/mcp  --HTTP-->  @devdigest/api :3001  --> Postgres / LLM
                         |                           |
                    tool handlers              existing modules
                    (intent-shaped)            agents / reviews /
                                               conventions / repos / pulls
```

- **Adapter:** `mcp/src/api/client.ts` — GET/POST helpers, map `ApiErrorBody` →
  MCP errors with forward-looking messages.
- **Resolve helpers:** `resolveRepo(fullName)`, `resolvePull(repoId, number)` —
  list + find; cache nothing across process lifetime beyond optional short memo
  inside one tool call.
- **Wait helper:** poll `GET /pulls/:prId/runs` for the started `run_id` until
  `status ∈ {done, failed, cancelled}` or timeout. Prefer **polling over SSE**
  for simplicity/testability (client already polls every 4s).
- **Project findings:** map `ReviewDto` → compact MCP finding rows (drop
  `accepted_at`/`dismissed_at`/`evidence`/`trifecta` unless needed; truncate
  rationale/suggestion).

Do **not** import `server/src/modules/*` via tsconfig path aliases in MVP —
process boundary + HTTP is the contract. (Future optional in-process adapter is
out of scope.)

### Exact tool contracts

Register in this **fixed order** (deterministic `tools/list`).

#### Shared conventions for every tool

- Description template (tight): **what** · **when to call** · **returns** ·
  **disambiguation** (e.g. vs sibling tools). No marketing fluff.
- Flat `inputSchema` properties only (no nested objects). Short `description` on
  each field. Enums where closed sets exist. Numeric bounds on limits.
- Errors: always include next step, e.g.
  `Agent not found for id=…. Call list_agents and pass a returned id.`
- Results: JSON object (MCP text content = `JSON.stringify` of compact object, or
  structuredContent if SDK version supports it — prefer one consistent approach).

---

##### 1. `list_agents`

| | |
|--|--|
| **Intent** | Discover which reviewer agents exist and which `id` to pass to `run_agent_on_pr`. |
| **Args** | none — keep flat / empty object |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **API** | `GET /agents` |
| **Response (concise)** | `{ agents: [{ id, name, description, provider, model, enabled }] }` — **return all agents** (enabled and disabled); model chooses via `enabled` + description. **omit** `system_prompt`, `output_schema` |
| **Errors** | API down → "Cannot reach DevDigest API at {base}. Start it (`cd server && pnpm dev`), then retry." |

---

##### 2. `run_agent_on_pr` — **only write tool**

| | |
|--|--|
| **Intent** | One-shot: start review for one agent on one PR, **wait** until finished, return ready findings. |
| **Args (flat)** | `repo` (string, `owner/name`), `pr` (integer ≥ 1), `agent` (uuid string), optional `timeout_ms` (int, default e.g. 300000, max e.g. 600000), optional `max_findings` (int, default 20, max 50) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false` (creates run/findings, does not delete), `idempotentHint: false`, `openWorldHint: false` |
| **Internal steps** (hidden from LLM) | 1) resolve repo → 2) resolve PR number → 3) `POST /pulls/:prId/review` `{ agentId: agent }` → 4) poll runs until terminal → 5) load reviews for PR, pick matching `run_id` → 6) project concise result |
| **Response (concise)** | `{ run_id, agent_id, agent_name, status, verdict, score, summary, findings: [{ id, severity, category, title, file, start_line, end_line, rationale?, suggestion? }], error? }` — truncate long text fields (e.g. rationale ≤ 400 chars); cap `findings` to `max_findings` with `findings_truncated: true` when needed |
| **Errors that lead forward** | Unknown repo → "Repo 'x' not found. Import it in the studio or check owner/name from GET /repos." · Unknown PR → "PR #N not imported for repo. Open the repo in the studio and import PRs." · Unknown agent → "… call list_agents …" · Failed run → return `status: failed` + `error` + `run_id` (still a result, not opaque 500) · Timeout while `running` → "Review still running after {ms}ms. Call get_findings with run_id={id} later." |

---

##### 3. `get_findings`

| | |
|--|--|
| **Intent** | Concise verdict for an **already completed** run (no new review). |
| **Args (flat)** | `run_id` (uuid) **required**; optional `max_findings` (same bounds as above). **No** `repo` / `pr` — natural follow-up after `run_agent_on_pr` returns `run_id`. |
| **Annotations** | `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false` |
| **API** | **Decided:** thin server route `GET /runs/:id/summary` (workspace-scoped). Returns compact run + linked review projection (status, verdict, score, summary, findings). Fits existing `/runs/:id/trace` and `/runs/:id/events` surface. **Do not** edit `vendor/shared` — local route DTO / Zod in `server` module is enough; MCP projects further if needed. |
| **Why not repo+pr+run_id** | Redundant for the LLM (Error Leads Forward on timeout already says “call get_findings with run_id”); violates Result-not-Operation by forcing the model to carry identifiers it already got from the write tool. |
| **Response** | Same projection as `run_agent_on_pr` success payload (no side effects). If still `running` → error: "Run is still in progress. Wait and retry get_findings, or call run_agent_on_pr to start a new review." |
| **Errors** | Run not found → "No run with id=…. Call list_agents then run_agent_on_pr, or check the run id from a previous run_agent_on_pr result." |

**Locked decision:** `get_findings({ run_id, max_findings? })` + `GET /runs/:id/summary` on `@devdigest/api`.

---

##### 4. `get_conventions`

| | |
|--|--|
| **Intent** | Repo conventions (same data as L02 Conventions Extractor list) — for grounding agent context, not to re-extract. |
| **Args (flat)** | `repo` (`owner/name`), optional `status` enum `pending \| accepted \| rejected \| all` (default `accepted`), optional `limit` (default 30, max 100) |
| **Annotations** | `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false` |
| **API** | resolve repo → `GET /repos/:id/conventions` (+ query status if not `all`) |
| **Response (concise)** | `{ repo, index_state, conventions: [{ id, category, rule, status, confidence, applies_to? }], truncated? }` — **omit** long `evidence_snippet` by default (optional later flag `include_evidence` — only if needed; default off for tokens) |
| **Errors** | Repo missing → forward to import/studio · Empty → `{ conventions: [], hint: "No conventions yet. Extract them in the studio Conventions page (L02)." }` |

---

##### 5. `get_blast_radius` — **STUB**

| | |
|--|--|
| **Intent** | Placeholder for PR impact map (homework). Must not pretend to work. |
| **Args (flat)** | `repo` (string), `pr` (integer) — same shape as future real tool |
| **Annotations** | `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false` |
| **Behavior** | **Do not** call `RepoIntel.getBlastRadius` or invent callers/endpoints. |
| **Response** | `{ status: "not_implemented", tool: "get_blast_radius", message: "Blast radius is not implemented yet (L04 homework). Use get_findings / run_agent_on_pr for review results; do not retry this tool expecting data.", repo, pr }` |
| **Description** | Explicitly say: "STUB — always returns not_implemented. Do not call unless checking stub behavior." |

---

### Cursor wiring

Create **project-scoped** [`.cursor/mcp.json`](../../.cursor/mcp.json):

```json
{
  "mcpServers": {
    "devdigest": {
      "command": "pnpm",
      "args": ["exec", "tsx", "src/index.ts"],
      "cwd": "mcp",
      "env": {
        "DEVDIGEST_API_BASE": "http://localhost:3001"
      }
    }
  }
}
```

Notes for implementer:

- Adjust to whatever Cursor schema the installed Cursor version expects
  (`mcpServers` vs newer keys) — verify against current Cursor docs when wiring.
- **No API keys** in this file.
- Document that the **API must already be running**; MCP does not start Docker/API.
- Optional: `mcp/README.md` shows Claude Desktop / other hosts stdio config.

### Env / secrets

| Var | Where | Default | Purpose |
|-----|-------|---------|---------|
| `DEVDIGEST_API_BASE` | MCP process env / `.cursor/mcp.json` `env` | `http://localhost:3001` | API base URL |
| `DEVDIGEST_MCP_POLL_MS` | MCP env only | `2000` | Poll interval for wait |
| `DEVDIGEST_MCP_TIMEOUT_MS` | MCP env only | `300000` | Default wait timeout |
| LLM / GitHub secrets | **API only** (`~/.devdigest/secrets.json` / `server/.env`) | — | Never read by MCP |

Do not add MCP-specific secrets storage.

### Package file layout (concrete)

```text
mcp/
  package.json                 # @devdigest/mcp, scripts: dev, start, test, typecheck
  tsconfig.json
  vitest.config.ts
  AGENTS.md                    # short map + gotchas
  README.md                    # tools, env, Cursor wiring, token-cost note
  src/
    index.ts                   # stdio main: createServer, register tools, connect
    server.ts                  # McpServer factory (testable without stdio)
    tools/
      index.ts                 # registerAll(server) — fixed order
      list-agents.ts
      run-agent-on-pr.ts
      get-findings.ts
      get-conventions.ts
      get-blast-radius.ts
    api/
      client.ts                # fetch wrapper + error mapping
      resolve.ts               # repo / PR resolution
      wait-run.ts              # poll until terminal
    schemas/
      args.ts                  # Zod flat arg schemas
      results.ts               # Zod concise result schemas + projectors
    errors.ts                  # McpToolError with forward-looking messages
  test/
    tools.test.ts              # mocked fetch per tool
    projectors.test.ts         # truncation / caps
    blast-stub.test.ts         # asserts not_implemented shape
```

Root: add `.cursor/mcp.json`. Optionally mention `mcp/` in root `AGENTS.md` /
`README.md` package table (small doc touch — allowed as part of L04 discoverability;
full feature spec deferred to `doc-writer`).

### Phased implementation steps

#### Phase 0 — Scaffold package

1. Create `mcp/package.json` (`@devdigest/mcp`), tsconfig (NodeNext / ES2022),
   vitest, deps: `@modelcontextprotocol/sdk`, `zod`, `tsx`, `typescript`,
   `vitest`, `@types/node`.
2. Stub `src/index.ts` that starts stdio server with zero tools; verify Cursor /
   `pnpm exec tsx src/index.ts` handshake locally.
3. Add `mcp/AGENTS.md` + README skeleton.

#### Phase 1 — API client + resolve + wait + run summary route

1. On **server**: add `GET /runs/:id/summary` (workspace-scoped) joining run
   status + review findings projection; unit/route tests in `server/`. Do **not**
   change `vendor/shared`.
2. In **mcp**: implement `ApiClient` against `DEVDIGEST_API_BASE`.
3. Implement `resolveRepo` / `resolvePull` with Error Leads Forward messages.
4. Implement `waitForRun(prId, runId, { timeoutMs, pollMs })`.
5. Unit tests with mocked `fetch` (mcp) + server tests for summary route.

#### Phase 2 — Read-only tools

1. `list_agents` → compact list of **all** agents (include `enabled`).
2. `get_conventions` → compact conventions (+ status filter / limit).
3. `get_findings` → `GET /runs/:id/summary` → compact verdict (`run_id` only).
4. `get_blast_radius` stub — locked tests for `not_implemented`.

#### Phase 3 — Write tool `run_agent_on_pr`

1. Orchestrate create → wait → project findings.
2. Handle failed/cancelled/timeout paths with forward-looking errors / partial
   payloads including `run_id` (timeout → call `get_findings` with that id).
3. Enforce `max_findings` + string truncation.

#### Phase 4 — Cursor + docs + token measurement

1. Add `.cursor/mcp.json`.
2. Measure approximate tools/list JSON token cost (simple script or manual
   count); record in README ("definitions ~N tokens").
3. Document prerequisite: API + Postgres up; seeded demo
   (`acme/payments-api`, PR 482) for manual smoke.
4. **Required:** add a one-line `mcp/` row to root `AGENTS.md` + `README.md`
   package tables.
5. Run `engineering-insights` if non-obvious gotchas appear (e.g. Cursor cwd,
   stdio buffering).
6. **CI for `mcp/`:** deferred (later / `test-writer`); do not add a workflow in
   this MVP.

#### Phase 5 — (Deferred homework, not this MVP)

- Replace stub with real blast using `repo-intel.getBlastRadius` / future
  `modules/blast` HTTP — keep same flat args `repo`, `pr`.

### Mapping table (tool → HTTP)

| MCP tool | HTTP sequence | Side effect? |
|----------|---------------|--------------|
| `list_agents` | `GET /agents` (all agents) | no |
| `run_agent_on_pr` | `GET /repos` → `GET /repos/:id/pulls` → `POST /pulls/:prId/review` → poll `GET /pulls/:prId/runs` → `GET /pulls/:prId/reviews` (or summary) | **yes** (creates run + findings) |
| `get_findings` | `GET /runs/:id/summary` | no |
| `get_conventions` | resolve + `GET /repos/:id/conventions` | no |
| `get_blast_radius` | none (stub) | no |

## Skill routing (for implementer)

| Skill | When / which paths | Required? |
|-------|--------------------|-----------|
| `typescript-expert` | `mcp/**` package setup, ESM, tsx, Zod↔JSON Schema | yes |
| `zod` | `mcp/src/schemas/*`, tool arg validation | yes |
| `security` | env handling, error forwarding, no secrets in mcp.json, no SSRF via base URL | yes |
| `engineering-insights` | after non-trivial MCP gotchas (Cursor wiring, wait/timeout) | yes (if lessons found) |
| `onion-architecture` | only if later embedding into `server/` (not MVP) | no |
| `fastify-best-practices` | `GET /runs/:id/summary` on server | **yes** (thin route) |
| `drizzle-orm-patterns` / `postgresql-table-design` | — | no |
| `frontend-ui-architecture` / `next-best-practices` / `react-best-practices` | — | no |
| `react-testing-library` | — | no |
| tests gap-fill beyond package unit tests | — | **defer** to `test-writer` |
| plan vs code check | — | **defer** to `plan-verifier` |
| architecture / security review / pre-PR | — | **defer** to `architecture-reviewer`, security / `pr-self-review` |
| feature docs in `docs/specs/` | — | **defer** to `doc-writer` |

## Out of scope for implementer

- Architecture review (`architecture-reviewer`), plan verification
  (`plan-verifier`), test gap-fill (`test-writer`), docs (`doc-writer`)
- Security review, PR self-review, opening PRs
- Real blast-radius implementation (homework after stub)
- Changing review engine / grounding / conventions extractor behavior
- Editing `server/src/vendor/shared` or `client/src/vendor/shared`
- Remote/cloud MCP, OAuth, multi-tenant auth for MCP
- E2E browser coverage of MCP
- Wrapping every REST endpoint as an MCP tool
- Starting Docker/API from inside the MCP process

## Verification plan (implementer-owned)

| Package | Command | Scope |
|---------|---------|-------|
| `mcp` | `pnpm test` | Unit tests with mocked fetch (all 5 tools + projectors + stub) |
| `mcp` | `pnpm typecheck` | Always when package touched |
| Manual smoke | API up + Cursor tools/list | `list_agents`; stub blast; optional `run_agent_on_pr` on seeded PR #482 if keys present |
| `server` | `pnpm test` / `pnpm typecheck` | Required for new `GET /runs/:id/summary` |
| `client` | — | Untouched |

Do **not** require Docker for `mcp` unit tests. Integration against live API is
manual/optional, not CI-blocking for MVP. **CI workflow for `mcp/` is deferred**
(later / `test-writer` / course CI patterns in `TESTING.md`).

## Decisions locked (user 2026-08-08)

1. **`get_findings`:** `run_id`-only + new `GET /runs/:id/summary` on the API
   (more correct than forcing redundant `repo`/`pr`).
2. **`list_agents`:** return **all** agents (include `enabled` flag).
3. **Root docs:** **yes** — add `mcp/` row to root `AGENTS.md` + `README.md`.
4. **CI for `mcp/`:** **later** — not in this MVP.
5. **Cursor `mcp.json` schema:** implementer verifies against installed Cursor
   at wire time (still a small verify step, not a product decision).
