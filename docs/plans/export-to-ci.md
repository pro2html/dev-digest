# Implementation Plan: Export to CI

## Spec source
- Path: `docs/specs/2026-08-30-export-to-ci.md`
- Spec ID: SPEC-06

## Execution mode
multi-agent

**Specialist cap (user constraint, not an AC):** later implementation via `sdd-implement` may spawn **at most 5 specialists**. Recommended chain: (1) `implementer` writes product code; (2) `architecture-reviewer` (Onion / UI layout / package+shared boundaries only); (3) `test-writer` (AC-cited tests; may run in parallel with architecture-reviewer); (4) `plan-verifier` last, after code + tests; (5) optional `pr-self-review` only if the user asks for a pre-PR pass. **Do not spawn `doc-writer` unless the user later asks.** Do not add a 6th agent.

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
- [ ] AC-38
- [ ] AC-39
- [ ] AC-40
- [ ] AC-41
- [ ] AC-42
- [ ] AC-43
- [ ] AC-44
- [ ] AC-45
- [ ] AC-46
- [ ] AC-47
- [ ] AC-48
- [ ] AC-49
- [ ] AC-50
- [ ] AC-51
- [ ] AC-52
- [ ] AC-53
- [ ] AC-54

## AC coverage
| AC | Plan task(s) | Notes |
| --- | --- | --- |
| AC-01 | Phase 7 — CI tab chrome (active-repo count, + Add to CI, Fail CI on, list/empty) | i18n copy in Phase 9 |
| AC-02 | Phase 7 — + Add to CI / + Add repository opens wizard at Target | |
| AC-03 | Phase 7 — Update CI config is per installation row; wizard pre-filled from that row | not a header control |
| AC-04 | Phase 7 — empty CI-deployment state; no Update CI config; no false “already installed” | |
| AC-05 | Phase 5 — installation list DTO; Phase 7 — row: `owner/name`, GitHub Actions, last job status, relative time | |
| AC-06 | Phase 1 — `exported_agent_version` on `ci_installations`; Phase 5/7 — show it | version at last successful open-PR export |
| AC-07 | Phase 7 — three-segment Fail CI on persists `ci_fail_on`; keep Config-tab control | reuse existing agent update route |
| AC-08 | Phase 7 — stored `any` highlights none of the three segments until the user picks | |
| AC-09 | Phase 5 — agent-scoped `source='ci'` history; Phase 7 — CI tab history distinct from local | |
| AC-10 | Phase 8 — wizard four steps + current-step highlight via `ExportWizardSteps` | |
| AC-11 | Phase 8 — Target shows GitHub Actions only (recommended); no Circle/Jenkins/CLI cards | |
| AC-12 | Phase 8 — collect `owner/name`; default from connected workspace repo when present | |
| AC-13 | Phase 3 — server `invalid_repo`; Phase 8 — refuse Continue when empty/invalid | |
| AC-14 | Phase 8 — Continue on Target with GHA + valid repo → Preview | |
| AC-15 | Phase 4 — `POST …/ci-preview` generates files; no installation; no GitHub PR | |
| AC-16 | Phase 3 — bundle file set; Phase 8 — Preview lists them | include bundled runner |
| AC-17 | Phase 4 — workflow override accepted on preview/export; Phase 8 — editable YAML | |
| AC-18 | Phase 3 — non-workflow files `editable: false`; Phase 8 — read-only in list | |
| AC-19 | Phase 3 — workflow invokes `node .devdigest/runner.mjs …` after checkout + setup-node; no `uses: devdigest/review-action@v1` | |
| AC-20 | Phase 3 — serialize current agent into `AgentManifest` and validate before Install | |
| AC-21 | Phase 4 — export refuses with `invalid_manifest`; Phase 8 — Install blocked | |
| AC-22 | Phase 3 — never write LLM keys, `GITHUB_TOKEN`, or ingest token into generated files | |
| AC-23 | Phase 3 — `.devdigest/memory.jsonl` snapshot or empty/placeholder (L07 not built) | |
| AC-24 | Phase 8 — Back on Preview → Target; no install | |
| AC-25 | Phase 3 — workflow `pull_request` types from Configure; Phase 8 — opened+synchronize default, reopened optional | do not use `CiExportInput.triggers` default (`reopened` included) as the wizard default |
| AC-26 | Phase 3 — post-as wired into workflow/runner; Phase 8 — GitHub review / PR comment / None | |
| AC-27 | Phase 8 — Configure copy: Fail CI on + required status check; no GitHub App | |
| AC-28 | Phase 8 — Continue on Configure → Install with selected triggers and post-as | |
| AC-29 | Phase 8 — Install: Open a PR (recommended) + zip; PR title in copy | |
| AC-30 | Phase 4 — `commitFiles` on `devdigest/ci` + open/update PR vs default branch; never commit on base | reuse `GitHubClient` |
| AC-31 | Phase 4 — persist `ci_installations` (`gha`) + return `pr_url` on open-PR success | |
| AC-32 | Phase 4 — missing `GITHUB_TOKEN` (`GITHUB_PAT` fallback) → `missing_github_token`; no GitHub writes | zip still allowed |
| AC-33 | Phase 4 — GitHub failure → `github_pr_failed`; no successful installation for that attempt | |
| AC-34 | Phase 4 — `action=files` returns zip of the same files; no installation; no PR | |
| AC-35 | Phase 5/8 — Install copy names provider key + ingest secret; Actions supplies `GITHUB_TOKEN` | |
| AC-36 | Phase 8 — Back on Install → Configure; no install | |
| AC-37 | Phase 3 — studio and bundled runner validate YAML with the same server `AgentManifest` | do not sync client `eval-ci.ts` |
| AC-38 | Phase 5/6 — ingest/trace records manifest version, model, tool versions, commit SHA | not byte-identical to local review |
| AC-39 | Phase 6 — `ci_fail_on=critical` + ≥1 critical → non-zero exit | reuse `gateTriggered` |
| AC-40 | Phase 6 — `ci_fail_on=warning` + warning or critical → non-zero exit | |
| AC-41 | Phase 6 — `ci_fail_on=never` does not fail solely because findings exist | |
| AC-42 | Phase 6 — runner posts review/comment with job `GITHUB_TOKEN`; ingest does not post | |
| AC-43 | Phase 6 — post-as none: no GitHub review/comment; still apply exit-code gate | |
| AC-44 | Phase 5 — authenticated ingest writes `agent_runs` `source='ci'` (counts, cost, duration, status) | not table `ci_runs` |
| AC-45 | Phase 5 — ingest without valid token → HTTP 401 `ingest_unauthorized`; no row | |
| AC-46 | Phase 5 — `GET /ci-runs` `source='ci'` only; Phase 9 — CI Runs page | |
| AC-47 | Phase 5/9 — row: repository, PR, agent, verdict, findings, cost, duration, job link | i18n follows brief, not stale table keys |
| AC-48 | Phase 9 — empty CI Runs state, not an error | |
| AC-49 | Phase 2 — new `ci` module only; do not edit multi-agent-run service or PR feed/timeline | constraint task |
| AC-50 | Phase 3/4 — non-`gha` target → 422 `unsupported_ci_target`; no other generators | |
| AC-51 | Phase 2 — preview, export, installation reads, Fail CI on (agent update), CI Runs require workspace membership; 403/404; no payload leak | |
| AC-52 | Phase 5 — ingest binds the run to the workspace that owns the token | |
| AC-53 | Phase 5/8 — first Install mints workspace ingest token, shows plaintext once; no Settings visit | plaintext never in Postgres |
| AC-54 | Phase 5/8 — later Install names the existing Actions secret; no second mint | rotation UX out of scope |

## Affected modules
| Module | Why | Notes from AGENTS.md / INSIGHTS.md |
| --- | --- | --- |
| `server/` (`@devdigest/api`) | New `ci` Fastify plugin: preview, export, installations, ingest, CI Runs; Drizzle writes to `ci_installations` + `agent_runs` | One plugin per feature (`modules/index.ts` has no `ci` yet). Secrets only via `LocalSecretsProvider` (`~/.devdigest/secrets.json`, mode `0600`); `GITHUB_TOKEN` canonical, `GITHUB_PAT` fallback. Do not drop empty course tables. Fastify request+response share one Zod schema. `AgentManifest` exists only on **server** `eval-ci.ts` (client twin already drifts — do not whole-file sync). List projections stay server-local DTOs (same pattern as `GET /runs/:id/summary`). Denormalize CI list fields onto `agent_runs` rather than joining `findings` at read. Stub tables need a real `pnpm db:generate` when columns are added. |
| `client/` (`@devdigest/web`) | Agent CI tab, Export wizard, `/ci-runs` page, hooks | Thin `page.tsx`; colocated `_components/`; data only through `src/lib/hooks/*` → `api.ts`. `ExportWizardSteps` already in `@devdigest/ui` (showcase). `activeKeyFor("/ci-runs")` already returns `"ci-runs"`; vendored `NAV` does **not** yet include the item (add it — same pattern as Eval Dashboard). `ci.json` and `agents.editor.tabs.ci` exist but are stale vs the spec. Config tab already owns four-value `ci_fail_on`; do not remove it. Modal/Drawer must portal to `document.body`. AppShell-wrapped list tests mock the shell. |
| `reviewer-core/` | Runner adapter calls the existing engine + `gateTriggered` | **Do not rewrite.** Consumed as TS source via path alias on the server; the bundled runner is the Actions adapter (GitHub/fs/HTTP), not a new engine. |
| `e2e/`, `mcp/` | Untouched | No new MCP tools. E2E not required for this plan’s implementer. |
| `server/src/vendor/shared` | Avoid | High risk. Reuse `CiExportInput`, `CiFile`, `CiInstallation`, `CiExport`, `CiResultArtifact`, `AgentManifest` (server). Change only if an AC field cannot be expressed; then dual-edit both copies and typecheck both packages. |

## Constraints & risks
- Packages are **client + server only**. No monorepo workspace; `cd` into the package for scripts. Path aliases, not published npm packages.
- Do **not** rewrite `reviewer-core`. Do **not** publish or depend on `devdigest/review-action@v1`. The generated workflow must invoke the **bundled** runner.
- Do **not** modify the multi-agent-run service or the PR feed/timeline (AC-49).
- Table `ci_runs` stays unused scaffolding — **not** a second history. Installations may use `ci_installations`. Runs are `agent_runs.source='ci'`.
- GHA only: `CiTarget` remains `gha\|circle\|jenkins\|cli` in shared schemas; product **rejects** non-`gha` (AC-50).
- Secrets never in git, DB, or generated files. Ingest token: workspace-scoped, hash (or equivalent) in the local secrets file; plaintext shown once on first Install (AC-53). `SecretKey` already allows extra string keys (`string & {}`) — no vendor/shared change required for the key name.
- `@devdigest/shared` / `vendor/shared`: do not “sync” `eval-ci.ts`. `CiExport.installation` is required in the shared type — zip/open-PR extra fields (optional `ingest_token`, zip without a persisted installation) belong on **server-local** (and matching client hook) envelopes, not a shared-file cleanup.
- Untrusted inputs: `repo` must be `owner/name` only; workflow YAML is user text placed in a PR (do not execute it in the studio, do not interpolate secrets); ingest payload is untrusted even with a valid token (bound size, schema, store job URL as a link).
- Open-PR uses existing `GitHubClient.commitFiles` + `findOpenPr` + `openPullRequest` (`branch: "devdigest/ci"`, title `"Add DevDigest CI review"`, `base` from input defaulting to `main` as request default — target the repo default branch, never push to the base).
- Zip does **not** create an installation (AC-34). Preview does not mint the ingest token (AC-15 vs AC-53: mint on Install).
- Duplicate ingest for the same job identity updates or no-ops rather than inserting a second `agent_runs` row.
- Client vs server `eval-ci.ts` drift is pre-existing; plan-verifier must **not** require those two files to become byte-identical.
- Worktree scope: CI HTTP surface, CI Runs page, agent CI tab.

## Approach
### Phase 1 — Persistence and local contracts
- [ ] Additive Drizzle changes on `ci_installations`: store the agent version serialized at the last successful open-PR export; unique `(agent_id, repo)` so re-export updates the same row. Run `pnpm db:generate` in `server/`; never drop `ci_runs` or `ci_installations`.  AC: AC-06, AC-31
- [ ] Additive columns on `agent_runs` for CI list identity (repository, PR number, job URL, verdict) plus a workspace-scoped uniqueness guard on job URL (partial unique index or equivalent) so duplicate ingest updates/no-ops. Do not insert into `ci_runs`.  AC: AC-09, AC-44, AC-47
- [ ] Server-local Zod DTOs (module file, not `vendor/shared`): preview request (reuse `CiExportInput` fields + optional workflow override); preview response `{ files: CiFile[] }`; open-PR response envelope around `CiExport` plus optional one-time `ingest_token` + Actions secret name; zip response (files or binary zip, `pr_url` null, **no** required persisted `installation`); installation-list row (`CiInstallation` + last-run status + relative activity + exported version); CI Runs list row (repo, PR, agent, verdict, findings, cost, duration, job URL); ingest body = `CiResultArtifact` **plus** trace fields (job URL, commit SHA, model, manifest version, tool versions, optional verdict).  AC: AC-15, AC-31, AC-34, AC-38, AC-44, AC-47, AC-53

### Phase 2 — `ci` module (Onion) and tenancy
- [ ] Add `server/src/modules/ci/` (`routes.ts`, `service.ts`, `repository.ts`, helpers, constants, local DTOs). Register in `server/src/modules/index.ts`. Presentation validates → calls service; service owns rules; repository owns Drizzle; GitHub/secrets/LLM only via `container` ports. Do not import multi-agent-run or PR-feed modules; do not put business `if`s in routes.  AC: AC-49
- [ ] Studio routes (preview, export, installation list, CI Runs, agent `ci_fail_on` updates via existing agents update) resolve `getContext` and load the agent/runs **by workspace**. Missing membership/agent → existing `not_found` / forbidden pattern with no manifest or run payload in the body.  AC: AC-51

### Phase 3 — Bundle generator and AgentManifest
- [ ] Pure bundle builder: given agent + skills + repo + target + triggers + post-as + optional workflow override, emit `CiFile[]`. Required paths: `.devdigest/agents/<slug>.yaml`, `.devdigest/skills/<slug>.md` per attached skill (omit skill files when none), `.devdigest/memory.jsonl` (workspace memory snapshot if any exists, else empty/placeholder), `.github/workflows/devdigest-review.yml`, bundled runner (e.g. `.devdigest/runner.mjs`). Non-workflow files `editable: false`; workflow `editable: true`.  AC: AC-16, AC-18, AC-23
- [ ] Serialize current agent (name, provider, model, system prompt, attached skill slugs, strategy, `ci_fail_on`) into YAML and `AgentManifest.parse` (server `eval-ci.ts` schema) before the bundle is offered for Install. Zero attached skills → empty `skills`, still valid.  AC: AC-20, AC-21, AC-37
- [ ] Generated workflow: `pull_request` types from Configure; job = checkout + setup-node + `node .devdigest/runner.mjs review --agent …` (flags/env for post-as). Must **not** contain `uses: devdigest/review-action@v1`. Secret **names** may appear as `${{ secrets.NAME }}`; never interpolate live key values.  AC: AC-19, AC-22, AC-25, AC-26
- [ ] Reject `target !== 'gha'` before generating files (`unsupported_ci_target`). Validate `repo` as exactly `owner/name` (no URL, no extra segments) (`invalid_repo`).  AC: AC-13, AC-50
- [ ] Bundled runner source lives under the `ci` module and, **at bundle generation time**, validates agent YAML with the **same** `AgentManifest` Zod object the studio uses (embed/bundle that schema into `runner.mjs`; do not re-implement a second hand-rolled schema). Runner adapts `reviewer-core` (import/bundle); do not change the engine’s public review contract.  AC: AC-37

### Phase 4 — Preview and export HTTP
- [ ] `POST /agents/:id/ci-preview`: generate bundle; no `ci_installations` row; no GitHub calls. Accept optional in-wizard workflow override so later Install uses edited YAML.  AC: AC-15, AC-17
- [ ] `POST /agents/:id/export-ci` with `action=open_pr`: if manifest invalid → 422 `invalid_manifest` and no GitHub write. If no GitHub credential → 409/400 `missing_github_token`, no write. Else `commitFiles` onto `devdigest/ci` from `base` (repo default / request default `main`), then `findOpenPr` or `openPullRequest` titled “Add DevDigest CI review”. Never commit onto the base branch. On GitHub failure → 502 `github_pr_failed`, do not record a successful installation. On success → upsert `ci_installations` (`target_type='gha'`, exported agent version) and return installation + files + `pr_url`.  AC: AC-21, AC-30, AC-31, AC-32, AC-33
- [ ] `POST /agents/:id/export-ci` with `action=files`: same generated files as a zip (`Content-Type: application/zip` or equivalent 200 file download). Do **not** persist an installation and do **not** open a PR. Missing GitHub token does not block zip.  AC: AC-34, AC-32

### Phase 5 — Ingest token, ingest, installation list, CI Runs API
- [ ] Workspace ingest token in `LocalSecretsProvider` (hash at rest, never Postgres). First time the user **reaches Install** and no token exists: mint, persist hash, return plaintext once + Actions secret name (implementation name e.g. `DEVDIGEST_INGEST_TOKEN`). If a token already exists: name the secret only; do not mint a second.  AC: AC-53, AC-54, AC-35
- [ ] `POST /ci/ingest`: authenticate with the ingest token (Authorization bearer or equivalent). Invalid/missing → 401 `ingest_unauthorized`, no insert. Valid → persist `agent_runs` with `source='ci'` in **that** workspace (findings count, cost, duration, status at minimum; identity columns from Phase 1; trace document with manifest version, model, tool versions, commit SHA). Repeat job URL → update or no-op. Do not post GitHub reviews from this handler.  AC: AC-38, AC-42, AC-44, AC-45, AC-52
- [ ] `GET /agents/:id/ci-installations`: workspace-scoped list envelope (repo, `gha` label, last known job status from latest CI `agent_runs` for that agent+repo, activity timestamp, exported version).  AC: AC-05, AC-06
- [ ] `GET /ci-runs`: workspace list of `agent_runs` where `source='ci'` only (local studio runs excluded), projected for the table in AC-47.  AC: AC-09, AC-46, AC-47
- [ ] Fail CI on updates continue through existing `PUT/PATCH /agents/:id` (`ci_fail_on`); no new gate route required.  AC: AC-07

### Phase 6 — Bundled runner runtime (Actions)
- [ ] Runner reads/validates the exported manifest (`AgentManifest`); on invalid YAML, fail closed (non-zero, no GitHub review posted).  AC: AC-21, AC-37
- [ ] After review, apply `gateTriggered` / equivalent from `reviewer-core` for exit code: `critical` (AC-39), `warning` (AC-40), `never` (AC-41).  AC: AC-39, AC-40, AC-41
- [ ] Post-as `github_review` or `pr_comment`: publish via job `GITHUB_TOKEN`. Post-as `none`: do not post; still apply the exit-code gate.  AC: AC-42, AC-43
- [ ] On completed review, POST ingest with token + artifact + trace fields. Studio ingest is record-only. MVP may skip ingest when the runner crashes before it can POST.  AC: AC-38, AC-44

### Phase 7 — Client: agent CI tab
- [ ] Add `ci` to `AgentEditor` `TABS` and render a colocated `CiTab` when `?tab=ci`. Show “Active in N repos” (distinct repos with an installation), **+ Add to CI**, three-segment **Fail CI on** (Critical / Warning+ / Never → `critical` / `warning` / `never`), installation list or empty state. Keep Config-tab CI-gate control.  AC: AC-01, AC-07
- [ ] Empty (N = 0): empty CI-deployment copy; still allow **+ Add to CI** / **+ Add repository**; hide **Update CI config**; do not show a successful install PR as done.  AC: AC-04
- [ ] Installation rows: `owner/name`, label GitHub Actions, last job status, relative last-activity time, exported workflow/manifest version, per-row **Update CI config**.  AC: AC-03, AC-05, AC-06
- [ ] **+ Add to CI** / **+ Add repository** open the wizard at Target (new export). **Update CI config** reopens the wizard populated from **that** row (same agent, GHA, that repo only).  AC: AC-02, AC-03
- [ ] If stored `ci_fail_on` is `any`, none of the three segments is selected until the user picks one (then overwrite `any`).  AC: AC-08
- [ ] When CI-sourced runs exist for the agent, show a history (at least status, time, target repo) that excludes `source='local'`.  AC: AC-09

### Phase 8 — Client: Export to CI wizard
- [ ] Wizard UI (modal/drawer portaled to `document.body`) using vendored `ExportWizardSteps` with labels Target → Preview → Configure → Install and the current step highlighted. Close/navigate away after Preview and before Install leaves no installation and no PR (client simply does not call export).  AC: AC-10
- [ ] Target: GitHub Actions as the selectable recommended target (`pull_request`); do not render CircleCI/Jenkins/Generic CLI cards. Repo field `owner/name`; default to the connected workspace repo `full_name` when present. Empty/invalid repo: cannot Continue; message that a valid repository is required. Continue with GHA + valid repo → Preview.  AC: AC-11, AC-12, AC-13, AC-14
- [ ] Preview: call ci-preview; list generated files including the runner; workflow YAML in an editor marked editable (edits held in wizard state and sent on Install); other files read-only. Back → Target without installing.  AC: AC-15, AC-16, AC-17, AC-18, AC-24
- [ ] Configure: triggers `opened` + `synchronize` selected by default, `reopened` optional; Post results as GitHub review (recommended) / PR comment / None; copy that merge blocking is Fail CI on + GitHub required status check and **no GitHub App**. Continue → Install with those choices.  AC: AC-25, AC-26, AC-27, AC-28
- [ ] Install: **Open a PR with these files** (recommended) and **Copy files as a zip**; state PR title “Add DevDigest CI review” and include generated files (count from the actual list, not hardcoded 5). Secret copy: provider API key + ingest token secret names; Actions supplies `GITHUB_TOKEN`. First visit mints/shows copyable token (AC-53) or names the existing secret (AC-54). Back → Configure without installing.  AC: AC-29, AC-35, AC-36, AC-53, AC-54
- [ ] Confirm Open PR → `export-ci` `open_pr`; show `pr_url` on success; surface `missing_github_token` / `github_pr_failed` / `invalid_manifest` without claiming success. Confirm zip → download; no installation.  AC: AC-21, AC-30, AC-32, AC-33, AC-34

### Phase 9 — Client: CI Runs page, nav, i18n
- [ ] Add `client/src/app/ci-runs/page.tsx` (thin) + colocated list view inside `AppShell`. Fetch `GET /ci-runs`. Table of CI-sourced runs only with repository, PR, agent, verdict, findings, cost, duration, job link. Empty: “no automated reviews yet”, not an error.  AC: AC-46, AC-47, AC-48
- [ ] Add a Global sidebar item for `/ci-runs` in vendored `client/src/vendor/ui/nav.ts` (helper already treats the path as `"ci-runs"`). Do not loosen `activeKeyFor`.  AC: AC-46
- [ ] Update `client/messages/en/ci.json` (and wizard/CI-tab strings) to match the spec: CI deployment, + Add to CI / Update CI config, no GitHub App sentence, CI Runs columns per AC-47. Leave Config-tab four-value `ci_fail_on` copy in `agents.json`.  AC: AC-01, AC-27, AC-47

## Recommendations
- Reuse `GitHubClient.commitFiles` / `findOpenPr` / `openPullRequest` and existing agent update for `ci_fail_on`. Do not add a second GitHub client.
- Keep all new HTTP envelopes as **module-local Zod DTOs**. Do not edit `vendor/shared/contracts/eval-ci.ts` unless a remaining AC field truly cannot be expressed; if that happens, dual-edit both copies and typecheck both packages — never “sync” `AgentManifest` onto the client file as cleanup.
- Do not use shared `CiRun` (it mirrors unused `ci_runs`). CI history is `agent_runs` + the local list DTO.
- Ship the runner as a module asset (pre-bundled `runner.mjs` or an export-time bundle of `modules/ci/runner/` + `AgentManifest` + `reviewer-core`). Do not run esbuild on every preview request if a checked-in asset suffices. Do not add `devdigest/review-action`.
- Zip: there is no zip library in the repo. Prefer a small store-only zip writer in the `ci` module so `action=files` is a real file download (spec error table). Do not add a heavy dependency.
- Ingest token secret name: `DEVDIGEST_INGEST_TOKEN`. Store `sha256(token)` under a secrets.json key; compare with a timing-safe equality check.
- Wizard defaults for `triggers` are **UI state** (`opened`, `synchronize`); send them explicitly so the shared `CiExportInput` default (which includes `reopened`) is not applied accidentally.

## Skill routing (for implementer)
| Skill | When / which paths | Required? |
| --- | --- | --- |
| `onion-architecture` | `server/src/modules/ci/**` — routes vs service vs repository; no peer imports into reviews / multi-agent / PR feed | yes |
| `fastify-best-practices` | `server/src/modules/ci/routes.ts` — plugin, Zod type provider, error codes | yes |
| `zod` | local DTOs in `modules/ci`; ingest/`repo`/`target` boundaries. **Not** a wholesale `eval-ci.ts` sync | yes |
| `drizzle-orm-patterns` | `server/src/db/schema/ci.ts`, `runs.ts`, generated migration, `modules/ci/repository.ts` | yes |
| `postgresql-table-design` | additive columns, unique `(agent_id, repo)`, partial unique on job URL, indexes on `source` + `workspace_id` | yes |
| `security` | ingest auth, secrets not in git/DB/bundle, `owner/name` validation, untrusted ingest/YAML; constraints only | yes |
| `frontend-ui-architecture` | `client/src/app/agents/[id]/…/CiTab`, wizard colocated folder, `client/src/app/ci-runs/**`, `lib/hooks/ci.ts` | yes |
| `next-best-practices` | `client/src/app/ci-runs/page.tsx`, agent `?tab=ci` | yes |
| `react-best-practices` | CI tab, wizard, CI Runs table; portal overlays | yes |
| `typescript-expert` | only if local DTO vs shared `CiExport` friction | no |
| `react-testing-library` | client tests | **defer** to `test-writer` |
| `engineering-insights` | after non-trivial landing — `server/INSIGHTS.md` / `client/INSIGHTS.md` | yes (post-implementation) |
| `mermaid-diagram` | not required for implementer | no |
| tests gap-fill | — | **defer** to `test-writer` (specialist 3); each `it(...)` cites `AC-NN` |
| architecture boundaries | — | **defer** to `architecture-reviewer` (specialist 2; after implementer; parallel with test-writer) |
| plan vs code check | — | **defer** to `plan-verifier` (specialist 4; **last**, after tests) |
| logic / security / pre-PR | — | **defer** to optional `pr-self-review` (specialist 5, **only if the user asks**) |
| feature docs | — | **defer** — **do not spawn `doc-writer`** unless the user later asks (cap: 5 specialists; `doc-writer` would be a 6th) |

## Out of scope for implementer
- Architecture review (`architecture-reviewer`) — after implementer, parallel with test-writer (counts toward the 5-specialist cap)
- Plan verification (`plan-verifier`) — **last**, after tests
- Test gap-fill (`test-writer`) — Execution mode is multi-agent
- Docs (`doc-writer`) — **not scheduled**; do not write a second SDD spec; do not spawn this agent under the 5-specialist cap
- Logic / security / pre-PR (`pr-self-review`) — after plan-verifier **and only if the user asks** (optional 5th specialist)
- Opening PRs
- A 6th orchestrated agent of any kind
- CircleCI / Jenkins / Generic CLI generators; GitHub App; OIDC ingest; token rotation UX; L07 memory product; rewriting `reviewer-core`; treating `ci_runs` as history; publishing `devdigest/review-action@v1`; byte-identical local vs CI output; changing how local reviews are triggered
- Uncovered AC: none (all AC-01…AC-54 are in AC coverage)

## Verification plan
Split ownership. Do **not** make implementer run a full package `pnpm test`.

### Implementer-owned (cheap)
| Package | Command | Scope |
| --- | --- | --- |
| server | `cd server && pnpm typecheck` | after every phase that touches `server/` |
| server | `cd server && pnpm exec vitest run test/ci*.test.ts --exclude '**/*.it.test.ts'` | unit only on files this work added; no Docker |
| server | `cd server && pnpm db:generate` | after schema edits; commit generated SQL **and** `meta/` snapshot; never hand-edit generated SQL |
| client | `cd client && pnpm typecheck` | after every phase that touches `client/` |
| client | `cd client && pnpm exec vitest run <touched test files>` | only paths changed in that phase; skip if none yet |
| reviewer-core | — | skip unless the runner change forces a typecheck (`cd reviewer-core && pnpm typecheck`); **no engine rewrite** |

If any `vendor/shared` file is edited (should be avoided), typecheck **both** `server` and `client` in that same phase. Do not require the two `eval-ci.ts` files to become byte-identical.

### test-writer-owned
| Package | Command | Scope |
| --- | --- | --- |
| server | `cd server && pnpm exec vitest run --exclude '**/*.it.test.ts'` | unit: repo/`target` rejection (AC-13, AC-50), `AgentManifest` round-trip (AC-20, AC-21, AC-37), no secrets in bundle (AC-22), workflow invokes bundled runner not `review-action` (AC-19), zip does not insert installation (AC-34), ingest 401 (AC-45), gate exit code (AC-39–AC-41), post-as none skips GitHub (AC-43) |
| server | `cd server && pnpm exec vitest run .it.test` | integration (real Postgres, self-skip without Docker): preview has no installation (AC-15), open-PR persists installation + `pr_url` (AC-30, AC-31), GitHub token missing (AC-32), GitHub failure does not persist success (AC-33), ingest writes `agent_runs` `source='ci'` in token workspace (AC-44, AC-52), duplicate job URL (edge), `GET /ci-runs` excludes local (AC-46), cross-workspace 403/404 with no leak (AC-51) |
| client | `cd client && pnpm test` | RTL: CI tab empty vs list (AC-01, AC-04, AC-05), Add to CI opens Target (AC-02), Update CI config is per-row (AC-03), Fail CI on three-segment + `any` (AC-07, AC-08), wizard steps/validation/back (AC-10–AC-14, AC-24, AC-36), Configure defaults and copy (AC-25–AC-27), Install PR vs zip (AC-29, AC-34), first-token vs existing (AC-53, AC-54), CI Runs empty + columns (AC-47, AC-48), `activeKeyFor("/ci-runs")`. Mock AppShell on list pages; mock hooks with the **SUT import path**; do not call `file.text()` without a FileReader fallback |

Every `it(...)` cites `AC-NN`. Client fetch is mocked — pair new routes with server tests.

### plan-verifier
Trust Implementation Report + Test Report when those commands already `pass`. Re-run Bash only if reports are missing, `partial`/`fail`, or an AC cannot be evidenced from files. Specifically: `ci` is registered in `modules/index.ts`; `ci_runs` is never written; `vendor/shared` untouched (or dual-edited with justification); no `uses: devdigest/review-action@v1` in generated workflow; secrets not in bundle fixtures; multi-agent-run and PR feed files unchanged; specialist cap was not exceeded (no `doc-writer` unless the user asked).

## Open questions
- Runner packaging: checked-in pre-bundled `modules/ci/assets/runner.mjs` vs export-time esbuild of `modules/ci/runner/`. Prefer a checked-in asset so preview stays request-scoped and `AgentManifest` is still the same import at bundle-build time.
- Zip writer: store-only helper in the `ci` module vs adding a zip dependency. Prefer the helper (no new runtime dep).
- Actions secret name `DEVDIGEST_INGEST_TOKEN` vs another name — pick one and use it consistently in Install copy and the workflow template.
