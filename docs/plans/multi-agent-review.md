# Implementation Plan: Multi-Agent Review

## Spec source
- Path: `docs/specs/2026-08-30-multi-agent-review.md`
- Spec ID: SPEC-06
- Status override: spec is `draft`; the user explicitly asked to plan it anyway. No `[NEEDS CLARIFICATION]` markers.

## Execution mode
constrained-multi-agent

Spawn order (token cap — do **not** use the default sdd-implement full chain):

1. **One** `implementer` (Approach + implementer-owned tests). Do **not** split into 3–5 implementer Tasks.
2. **`architecture-reviewer`** (boundaries only, after implementer).
3. **`plan-verifier`** last, once.

Skip `test-writer`, `pr-self-review`, and `doc-writer` unless the user asks.

Rationale: the product decisions are a thin wrap of existing review + reuse of the PR finding card and run drawer. Extra implementer hand-offs cost more tokens than they save. Cap requested by the user was 3–5 implementers; the cheapest correct number is **1**.

## Success criteria
- [ ] AC-01
- [ ] AC-02
- [ ] AC-03
- [ ] AC-04
- [ ] AC-05
- [ ] AC-06
- [ ] AC-07
- [ ] AC-08
- [ ] AC-09
- [ ] AC-10
- [ ] AC-11
- [ ] AC-12
- [ ] AC-13
- [ ] AC-14
- [ ] AC-15
- [ ] AC-16
- [ ] AC-17
- [ ] AC-18
- [ ] AC-19
- [ ] AC-20
- [ ] AC-21
- [ ] AC-22
- [ ] AC-23
- [ ] AC-24
- [ ] AC-25
- [ ] AC-26
- [ ] AC-27
- [ ] AC-28
- [ ] AC-29
- [ ] AC-30
- [ ] AC-31
- [ ] AC-32
- [ ] AC-33
- [ ] AC-34
- [ ] AC-35
- [ ] AC-36
- [ ] AC-37

## AC coverage
| AC | Plan task(s) | Notes |
| AC-01 | Phase 4 — Configure run empty | No checkboxes / estimates until a pull is selected |
| AC-02 | Phase 3 — estimates query; Phase 4 — agent list | Name, description, past-run averages |
| AC-03 | Phase 3 — null estimates; Phase 4 — omit numbers | No invented seconds / dollars |
| AC-04 | Phase 4 — footer max(time) + sum(cost) | Only from selected agents that have numbers |
| AC-05 | Phase 4 — Select all / clear | Same control |
| AC-06 | Phase 4 + Phase 5 — disable start | Also reject empty body on POST (Phase 3) |
| AC-07 | Phase 3 — create parent + N children; Phase 4/5 — label (N) | N ≥ 1 |
| AC-08 | Phase 3 — dedicated POST only; Phase 5 — picker uses it | Do not call `POST /pulls/:id/review` for a parent |
| AC-09 | Phase 3 — `ReviewService.runReview` then persist child ids | Isolation is existing executor behaviour |
| AC-10 | Phase 5 — PR picker popover | Replaces one-click run-all as the multi-agent path |
| AC-11 | Phase 5 — same mutation as Configure | Same start + grouping |
| AC-12 | Phase 2 — store child ids on parent; Phase 3 — GET assemble | Never mix standalone review runs into columns |
| AC-13 | Phase 3 — `POST /review` unchanged | No parent row on single / `all: true` |
| AC-14 | Phase 3 — assemble originals; Phase 6 — render per agent | No merge/rewrite of finding bodies |
| AC-15 | Phase 3 — pure `groupConflicts` | file + start_line; flag vs miss or divergent severity |
| AC-16 | Phase 6 — disagreement block | Every selected agent that ran; **did not flag** for misses |
| AC-17 | Phase 6 — toggle off | All grouped locations |
| AC-18 | Phase 6 — toggle on | Conflict heuristic only; still show did-not-flag takes |
| AC-19 | Phase 6 — Columns default + live status | Per-child events; do not wait for siblings |
| AC-20 | Phase 6 — completed column fields | Score, duration, cost, summary, findings |
| AC-21 | Phase 6 — Tabs + FindingCard | Accept / Dismiss / Turn into eval only |
| AC-22 | Phase 6 — existing finding hooks | Same persist path as PR page |
| AC-23 | Phase 6 — mount PR run drawer | Not an in-page log toggle |
| AC-24 | Phase 4/5 — navigate to results; Configure run control | After successful start |
| AC-25 | Phase 3 + Phase 6 — failed column | Parent stays; siblings unchanged |
| AC-26 | Phase 3 — `getContext` + workspace-scoped pull | Same rejection family as other pull routes |
| AC-27 | Phase 3 — unknown agent rejects start | No parent, no children |
| AC-28 | Phase 2/3 — no secrets in new rows | Existing secrets path only |
| AC-29 | Out of scope | Do not touch `mcp/` |
| AC-30 | Phase 6 — running column empty metrics | No invented score / findings / duration / cost |
| AC-31 | Phase 4 — nav → Configure run | No invented parent |
| AC-32 | Phase 3 — GET latest; GET by id | Latest unless parent id requested |
| AC-33 | Phase 3 — POST rateLimit like `/review` | Per-pull key; existing 429 family |
| AC-34 | Phase 6 — drawer Trace / Live log defaults | Running → log; else Trace |
| AC-35 | Phase 6 — reuse drawer Trace sections | Configuration, stats, prompt assembly, tools, raw |
| AC-36 | Phase 6 — existing Copy raw output | Disabled when raw missing |
| AC-37 | Phase 6 — existing live + persisted log | Same drawer Live log mode |

## Affected modules
| Module | Why | Notes from AGENTS.md / INSIGHTS.md |
| `server/` | New Fastify plugin `modules/multi-agent/` (routes + service + repository + pure conflict helper). Additive column on existing `multi_agent_runs`. Does **not** change `POST /pulls/:id/review` or `run-executor` scheduling. | Onion plugin like `brief/`. Register in `modules/index.ts`. Instantiate `ReviewService` from the multi-agent service (same peer direction as `brief → IntentService`). Do **not** import `reviews/repository`. Secrets never in DB. GET empty = 200 envelope, not 404 (`INSIGHTS` 2026-08-14 catalog empty vs unavailable). Fastify response Zod must include envelope fields or they are stripped. Rate-limit 429 already maps to `rate_limited` (`INSIGHTS` 2026-08-14). |
| `server/src/vendor/shared` + `client/src/vendor/shared` | Additive `MultiAgentStartRequest` on existing `observability.ts`. Reuse `MultiAgentRun` / `AgentColumn` / `Conflict`. Do **not** change `RunRequest`. | **High risk:** two copies, no sync script (`INSIGHTS` 2026-08-01). Edit **both** identically; typecheck both packages. GET envelope can stay a **local** module DTO (same idea as `reviews/summary-dto.ts`, `INSIGHTS` 2026-08-14) to avoid extra shared ripple. |
| `client/` | Configure run + results under `app/repos/[repoId]/multi-agent/`; PR picker replaces the run-all menu; hooks in `lib/hooks`. Reuse PR `FindingCard` and `RunTraceDrawer`. | Colocate route UI in `_components/`. Hooks via `lib/api.ts` only. Mock `app-shell` as passthrough in list/page tests (`INSIGHTS` 2026-08-01). `vi.mock` path = SUT import path. Reuse `SEV` / `CAT` tokens (`INSIGHTS` 2026-07-31). Vendored `NAV` in `client/src/vendor/ui/nav.ts` needs a Global **Multi-Agent Review** item (href `/repos/:repoId/multi-agent`); `activeKeyFor` already maps `/multi-agent`. Do not add Memory / Agent Performance / CI Runs. |
| `reviewer-core/` | Out of scope | Grouping is a server pure helper, not an engine change. |
| `mcp/` | Out of scope (AC-29) | Verify untouched. |
| `e2e/` | Out of scope | Spec defers browser e2e. |
| `ci/` / `agent-runner/` | Out of scope | Spec hard boundary. |

### Scaffolding already in repo (do not reinvent)

| Layer | Exists | Path / evidence |
| Parent table | Yes (thin) | `multi_agent_runs` — `id`, `workspace_id`, `pr_id`, `ran_at` |
| Read DTO | Yes | `MultiAgentRun`, `AgentColumn`, `Conflict`, `ConflictTake` in `contracts/observability.ts` (both vendor copies) |
| Child execution | Yes | `ReviewService.runReview` → `ReviewRunExecutor.executeRuns` (per-agent isolation; sequential today — leave it) |
| Live events / trace | Yes | `GET /runs/:id/events`, `GET /runs/:id/trace`; client `useRunEvents`, `useRunTrace` |
| PR run drawer | Yes | `RunTraceDrawer` (Trace + Live log, configuration, stats, prompt assembly, tool calls, raw output, Copy raw output) |
| Finding actions | Yes | `FindingCard` + `POST /findings/:id/(accept\|dismiss\|undecide)` + eval-case-from-finding |
| Agents + pulls reads | Yes | `GET /agents` (`Agent.description` already), `GET /repos/:id/pulls` |
| Shell key | Yes | `activeKeyFor` includes `/multi-agent`; `NAV` has no Global item yet |

## Constraints & risks

- Worktree A only: PR page, Multi-Agent Review, `modules/multi-agent/` and its new files. Do not edit `ci/` or `agent-runner/`.
- Do not change `RunRequest` or `POST /pulls/:id/review`.
- Do not make the executor concurrent.
- Do not implement Learn / Reply.
- Do not fork `RunTraceDrawer` or build an inline log panel.
- Additive shared-contract change is **only** the start-request schema (both vendor copies).
- Additive DB change is **only** child-run attribution on `multi_agent_runs` (do not “clean up” unused course columns).
- Secrets stay in `~/.devdigest/secrets.json`.
- Path aliases, not published packages.

## Approach

### Phase 1 — Shared start request
- [ ] Add `MultiAgentStartRequest` `{ agent_ids: z.array(z.string().min(1)).min(1) }` to **both** `observability.ts` copies. Do not change `RunRequest`, `MultiAgentRun`, or finding records. Typecheck `server/` and `client/`.  AC: AC-08, AC-27

### Phase 2 — Parent attribution (additive schema)
- [ ] Add one column on `multi_agent_runs` to store the child run ids created for that parent (uuid array or jsonb list). Generate a Drizzle migration. Do **not** add a FK on `agent_runs` and do not change `createAgentRun`.  AC: AC-07, AC-12, AC-28
- [ ] Persist nothing except workspace/pr/ran_at/child ids — no provider secrets.  AC: AC-28

### Phase 3 — Multi-agent API module
- [ ] New plugin `server/src/modules/multi-agent/` (routes, service, repository, pure `groupConflicts`). Register in `modules/index.ts`. Routes call the service only (no business `if` in the handler).  AC: AC-08, AC-26
- [ ] `POST /pulls/:id/multi-agent-run`: `getContext`; reject empty / unknown / foreign-workspace agent ids (`invalid_run_request`) with **no** parent row; create parent; resolve agents; call existing `ReviewService.runReview` (do not reimplement the executor); write returned `run_id`s onto the parent; return `MultiAgentRun` with `running` columns and empty findings / conflicts. Rate-limit `{ max: 10, timeWindow: '1 minute' }` with a per-pull `keyGenerator` (same family as `POST /pulls/:id/review`).  AC: AC-06, AC-07, AC-08, AC-09, AC-27, AC-33
- [ ] Leave `POST /pulls/:id/review` and `resolveTargets` untouched so single-agent / `all: true` never write `multi_agent_runs`.  AC: AC-13
- [ ] Local GET envelope `{ pr_id, run: MultiAgentRun \| null }`: `GET /pulls/:id/multi-agent` = latest parent or `{ run: null }` (200, not 404); unknown pull = existing `not_found`. `GET /multi-agent-runs/:id` = that parent or `not_found`. Recompute `columns` + `conflicts` from the stored child ids + current `agent_runs` / reviews / findings. Cross-workspace → same rejection as other pull routes.  AC: AC-12, AC-14, AC-15, AC-26, AC-32
- [ ] Pure `groupConflicts`: key = file + `start_line`; skip findings missing file/line; conflict when ≥1 selected child flagged and ≥1 other selected child that ran did not, or flagged severities diverge. `ConflictTake.verdict` = severity or `ignored`; `note` = short derived label (e.g. `did not flag`), not a model call. Originals stay on `columns[].findings`.  AC: AC-14, AC-15, AC-16
- [ ] Estimates read (local DTO, not vendor/shared): per workspace agent, average `duration_ms` and `cost_usd` from **completed** (`status = done`) `agent_runs` only; nulls when no such row.  AC: AC-02, AC-03
- [ ] Unit tests (no Docker): start-request parse; unknown agent; `groupConflicts` (agree / miss / diverge / missing file); estimates ignore failed runs; assembling a parent does not include a sibling standalone run.  AC: AC-12, AC-13, AC-15, AC-27

### Phase 4 — Configure run + shell
- [ ] Routes: `/repos/[repoId]/multi-agent` (Configure run) and `/repos/[repoId]/multi-agent/[prId]` (results). Add a Global **Multi-Agent Review** item to `NAV` (`href: /repos/:repoId/multi-agent`). Do not add other mock Global items.  AC: AC-31
- [ ] Configure run: pull picker from existing `GET /repos/:id/pulls`. No pull → empty agents panel + copy to pick a pull; no checkboxes; no invented estimates.  AC: AC-01, AC-31
- [ ] After a pull is selected: list all workspace agents (`useAgents`) with checkbox, name, `description`, estimate (omit numeric time/cost when null). Default: all **enabled** checked; disabled listed unchecked. Select all / clear. Footer: max selected time + sum selected cost when any number exists. Start label **Run multi-agent review (N)**; disabled when N = 0.  AC: AC-02, AC-03, AC-04, AC-05, AC-06
- [ ] Start mutation → dedicated POST (never `/review`). On success, navigate to results for that pull (include parent `id` in the route or query). Keep a control back to Configure run. Hooks in `src/lib/hooks/multi-agent.ts` via `api.ts`. English copy in `messages/en/`.  AC: AC-07, AC-08, AC-24
- [ ] Smoke tests: empty state; disabled start; Select all; mock AppShell passthrough.  AC: AC-01, AC-05, AC-06

### Phase 5 — PR page picker
- [ ] Replace the PR **Run Review** menu’s one-click run-all / single-agent list with a picker popover: checkboxes, estimates, **Run multi-agent review (N)**, **Configure agents…** → `/agents`. Same start mutation as Phase 4. Keep today’s merged/closed warning. Do not use `POST /review` for this parent.  AC: AC-10, AC-11, AC-06
- [ ] If `prId` is missing, do not mount a startable picker.  AC: AC-10

### Phase 6 — Results (Columns / Tabs / disagree / drawer)
- [ ] Results page: default **Columns**; toggle **Tabs**. One column/tab per child. Live status from existing `useRunEvents` on child `run_id`s; invalidate the parent GET when a child completes. Running column: no invented score / findings / duration / cost. Failed/cancelled: column `failed`; keep parent and sibling findings.  AC: AC-19, AC-20, AC-25, AC-30
- [ ] Completed column: score, duration, cost, summary, that child’s findings (originals).  AC: AC-14, AC-20
- [ ] Tabs: agent name + score; active tab reuses `FindingCard` (confidence, suggested fix, Accept, Dismiss, Turn into eval). Wire existing finding + eval-case hooks — no new decision model.  AC: AC-21, AC-22
- [ ] **Where agents disagree**: render `conflicts` + grouped locations from the parent payload (do not regroup in the browser beyond the Show-only-conflicts filter). Toggle off = all grouped locations; on = AC-15 conflicts only; always show **did not flag** for `ignored` takes. Empty conflicts + toggle on = in-section empty.  AC: AC-16, AC-17, AC-18
- [ ] **View trace** on a column or tab opens **one** `RunTraceDrawer` for that child `run_id` (pass `running` from child status). Do not add an in-page log switch. Drawer already provides Trace / Live log defaults, configuration / stats / prompt assembly / tools / raw, Copy raw output, live SSE + persisted log. Retarget the same drawer if the user picks another agent.  AC: AC-23, AC-34, AC-35, AC-36, AC-37
- [ ] Latest parent when opening results without a parent id; specific id when present (from start navigation).  AC: AC-32
- [ ] Smoke tests: Columns default; toggle Tabs; conflict filter; View trace renders the drawer (mock drawer internals if needed).  AC: AC-19, AC-18, AC-23

## Recommendations

- **Keep it a wrap, not a fork.** Parent row + `ReviewService.runReview` + store child ids. Do not add `multi_agent_run_id` on `agent_runs` (avoids touching the hot create path and `POST /review`).
- **GET 200 + `run: null`** when the pull exists but has no parent — same empty-vs-not-found trick as brief/onboarding.
- **Estimates as a local DTO** on the multi-agent module (or a tiny `GET /agents/review-estimates`). Do not implement `GET /agents/:id/stats` / `AgentStats`.
- **Do not relocate `RunTraceDrawer`** unless the import is unworkable; a second consumer may import the existing PR-colocated module for this worktree.
- **One shared picker component** used by Configure run and the PR popover (estimates + checkboxes + start). Aggregate footer only on Configure run (popover can stay compact).
- Map `ConflictTake.verdict === 'ignored'` → **did not flag** in the UI; do not rename the shared union.
- Sequential executor is fine; footer still uses max(time) as the spec’s estimate rule.

## Skill routing (for implementer)
| Skill | When / which paths | Required? |
| onion-architecture | `server/src/modules/multi-agent/**` — plugin; multi-agent → `ReviewService` only; no reverse imports; no repo access from routes | yes |
| fastify-best-practices | `modules/multi-agent/routes.ts` — Zod response, rateLimit, errors | yes |
| drizzle-orm-patterns | additive `multi_agent_runs` column + reads | yes |
| postgresql-table-design | one additive column; no cleanup of unused course tables | yes |
| zod | dual `observability.ts` start request; local GET envelope | yes |
| security | workspace tenancy, rate-limit, no secrets in parent row, finding markdown as data | yes |
| typescript-expert | dual vendor copies | no (if types stay small) |
| frontend-ui-architecture | colocate `app/repos/[repoId]/multi-agent/_components`; hooks in `lib/hooks` | yes |
| next-best-practices | App Router pages; thin `page.tsx` | yes |
| react-best-practices | picker / results split; no fetch in presentational bits | yes |
| react-testing-library | implementer smoke tests; AppShell mock; `vi.mock` = SUT import | yes |
| engineering-insights | after non-trivial work | yes |
| test gap-fill | — | **defer** (skipped in this execution mode; implementer owns cheap tests) |
| plan vs code check | — | **defer** to `plan-verifier` (**last**) |
| architecture boundaries | — | **defer** to `architecture-reviewer` (after implementer; **not** parallel with test-writer — test-writer is skipped) |
| logic / security / pre-PR | — | **defer** / **skip** `pr-self-review` unless the user asks |
| feature docs | — | **defer** / **skip** `doc-writer` |

## Out of scope for implementer
- Architecture review (`architecture-reviewer`) — after the single implementer (not parallel with test-writer)
- Plan verification (`plan-verifier`) — **last**, after implementer-owned tests
- Test gap-fill (`test-writer`) — skipped in this execution mode
- Docs (`doc-writer`) — do not write a second SDD spec
- Logic / security / pre-PR (`pr-self-review`) — skipped unless asked
- Opening PRs
- AC-29 — verify `mcp/` untouched; do not add tools
- `ci/`, `agent-runner/`, `reviewer-core/`, `e2e/`
- Changing `POST /pulls/:id/review` or executor concurrency
- Learn / Reply / Memory curator / Agent Performance / CI Runs
- Workspace-wide parent-run history
- Browser e2e
- Relocating or rewriting `RunTraceDrawer` internals

## Verification plan
Split ownership. Do **not** make implementer run a full package `pnpm test`.

### Implementer-owned (cheap)
| Package | Command | Scope |
| client | `pnpm typecheck`; `pnpm exec vitest run <touched test files>` | Configure empty/disable/select-all; results Columns/Tabs/filter; View trace mounts drawer |
| server | `pnpm typecheck`; unit vitest on touched files only (`--exclude '**/*.it.test.ts'`) | `groupConflicts`, start validation, estimates skip failed, parent assemble excludes standalone runs |

### test-writer-owned
| Package | Command | Scope |
| — | skipped | Execution mode skips `test-writer`. No Docker / `*.it.test.ts` required in this pass. |

### plan-verifier
Trust Implementation Report when those commands already `pass`.
Re-run Bash only if the report is missing, `partial`/`fail`, or an AC cannot be evidenced from files.
Do not require a Test Report from `test-writer`.

## Open questions
- none (if one implementer context window is tight, the orchestrator may continue the same implementer with Phase 4–6 — still one agent, not a second implementer spawn)
