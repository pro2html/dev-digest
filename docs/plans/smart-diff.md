# Development Plan: Smart Diff

## Goal

- Add a **Smart Diff** view that sorts PR changed files by review risk so
  reviewers see business logic first, not lock files or generated code.
- Classify files **deterministically** from already-imported `pr_files` (path /
  pattern / size heuristics) into `core` | `wiring` | `boilerplate`.
- Overlay findings from the **latest review** onto that grouping (badges, line
  highlights, auto-expand) — **no new LLM call**, no new persistence table.
- Expose `GET /pulls/:id/smart-diff` returning the existing Zod `SmartDiff`
  contract; render a SmartDiffViewer on the PR **Files changed** tab with a
  Smart order / Original order toggle.
- Ship a **`verify:l03`** (or equivalently named) script that runs classifier
  unit tests green/red without UI clicking.

## Success criteria

- [ ] File classifier maps paths to `core` / `wiring` / `boilerplate` using
      patterns + thresholds in a dedicated constants file
- [ ] Lock files (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`,
      `Cargo.lock`, `Gemfile.lock`, `poetry.lock`, `composer.lock`, etc.) are
      **always** `boilerplate`
- [ ] `GET /pulls/:id/smart-diff` returns `SmartDiff` (`groups` +
      `split_suggestion`) by combining persisted PR files + findings from the
      latest review; works immediately after PR import with empty
      `finding_lines`
- [ ] Smart Diff path creates **no** LLM / model request in logs
- [ ] Files changed tab: toggle **Smart order** (default) vs **Original order**
- [ ] Smart order: Core expanded by default; Boilerplate collapsed by default;
      files with findings auto-expanded; lock file starts collapsed
- [ ] File header shows path, +/- counts, findings badge (“N findings”); badge /
      finding affordance is clickable and scrolls the diff to the target line
- [ ] Inline finding markers on lines use severity colors (suggestion / warning /
      blocker) — severity joined client-side from reviews if not in
      `SmartDiffFile`
- [ ] `verify:l03` (name must contain `verify` or `l03`) runs real classifier
      tests (not a stub); at minimum: lock → boilerplate; core logic file stays
      top / expanded semantics covered by classifier + grouping assertions
- [ ] Thresholds/patterns live in constants (not magic strings inline in the
      classifier)
- [ ] Implementer-owned package tests / typechecks pass for touched packages

## Affected modules

| Module | Why | Notes from AGENTS.md / INSIGHTS.md |
|--------|-----|-------------------------------------|
| `server/` | New `modules/smart-diff/` (classifier, constants, service, route); register in `modules/index.ts` | Onion Fastify module; compute-on-read; no secrets; mirror `modules/intent/` shape but **without** LLM |
| `client/` | SmartDiffViewer + DiffTab toggle + hook; extend DiffViewer/FileCard for findings overlay / scroll | Colocate under PR `_components/`; hooks via `src/lib/hooks/*` only; reuse `@devdigest/ui` `SEV` tokens (client INSIGHTS) |
| `server/src/vendor/shared` + `client/src/vendor/shared` | Prefer **no change** — `SmartDiff` / `SmartDiffResponse` already exist | **High risk** if touched: two byte-identical copies (server INSIGHTS 2026-08-01) |
| `reviewer-core/` | None for MVP | Pure engine; Smart Diff is server+UI only |
| `e2e/` | Usually out of MVP | Manual demo video covers acceptance; defer browser e2e |

### Scaffolding already in repo (do not reinvent)

| Layer | Exists | Path |
|-------|--------|------|
| Zod | `SmartDiffRole`, `SmartDiffFile`, `SmartDiffGroup`, `SmartDiff` | `*/vendor/shared/contracts/brief.ts` |
| Zod | `SmartDiffResponse = SmartDiff` | `*/vendor/shared/contracts/review-api.ts` |
| Client type re-export | `SmartDiff` | `client/src/lib/types.ts` |
| i18n | `prReview.smartDiff.*` keys | `client/messages/en/prReview.json` |
| Contract test | `SmartDiff` parse smoke | `server/test/contracts.test.ts` |
| PR files | `GET /pulls/:id` → `PrFile[]` (`path`, `additions`, `deletions`, `patch`) | `server/src/modules/pulls/routes.ts` |
| Findings | `GET /pulls/:id/reviews` newest-first | `server/src/modules/reviews/routes.ts` |
| Files UI | `DiffTab` → `DiffViewer` → `FileCard` | `client/.../DiffTab`, `client/src/components/diff-viewer/` |
| Module registry comment | “intent/smart-diff” placeholder | `server/src/modules/index.ts` |
| Optional intel | `getFileRank` commented for smart-diff | `repo-intel` — **do not require** for MVP |

### Contract shape (must match — verify before coding)

```ts
SmartDiffFile = {
  path, pseudocode_summary?, additions, deletions, finding_lines: number[]
}
SmartDiffGroup = { role: 'core' | 'wiring' | 'boilerplate', files: SmartDiffFile[] }
SmartDiff = {
  groups: SmartDiffGroup[],
  split_suggestion: {
    too_big: boolean,
    total_lines: number,
    proposed_splits: { name: string, files: string[] }[]
  }
}
```

- `pseudocode_summary` (“What this does” blurb): **optional / leave `null`**.
  Populating it would need an LLM or hand-written copy — out of scope. If the
  UI receives a non-null value later, it may render; do not invent text.
- `finding_lines` carries line numbers only (no severity). Colored inline
  badges: join on the client with `usePrReviews` findings
  (`file` + `start_line` + `severity`).

### Missing today

- `server/src/modules/smart-diff/` (constants, classifier, service, routes)
- `GET /pulls/:id/smart-diff`
- Classifier unit tests + `verify:l03` script
- Client `useSmartDiff` hook + SmartDiffViewer + DiffTab toggle / DiffViewer
  finding overlays

## Constraints & risks

- **NO new LLM call.** Classifier and route are pure functions over DB rows.
  Do not call `resolveFeatureModel`, OpenAI/Anthropic adapters, or Intent
  derive. Smart Diff logs must never show a model request.
- **NO new DB tables / migrations.** Compute-on-read from `pr_files` +
  `reviews`/`findings`. Intent Layer’s `pr_intent` / migration `0014` is
  unrelated — do not conflict with in-progress Intent work on the branch.
- **Shared contracts:** default is **do not edit** `vendor/shared`. Only if a
  field is truly required for acceptance (unlikely) — edit **both** copies and
  typecheck both packages. Prefer client-side join for severity.
- **Lock file rule is absolute:** pattern match wins over size / “looks like
  source” heuristics — always `boilerplate`, always initially collapsed in UI.
- **repo-intel `file_rank`:** optional future enrichment only. MVP must work
  with zero indexing (same degraded-path philosophy as conventions INSIGHTS).
- **Latest review semantics:** `reviewsForPull` is newest-first. Use findings
  from the newest `ReviewRecord` for `finding_lines`. If product demo uses
  “Run all”, implementer may union findings from all reviews that share the
  newest review’s `run_id` when present — document the choice in code comment.
- **Intent coexistence:** Intent module uses LLM; Smart Diff must not import
  Intent service or share its derive path. Separate Fastify plugin.
- **Security:** workspace-scope PR access via existing `getContext` + PR
  ownership checks (same as `GET /pulls/:id` / intent). No secrets in logs.
  Path strings are untrusted display data — no `eval`, no shell.

## Approach

Order: shared contracts (only if needed) → server classifier + route → client
viewer → `verify:l03`.

### Phase 0 — Confirm contract (no edit expected)

1. Re-read `brief.ts` `SmartDiff*` and `review-api.ts` `SmartDiffResponse`.
2. Confirm client copy matches server (`diff` the two `brief.ts` files).
3. Decide: **no contract change** unless blocked; severity via client join.

### Phase 1 — Server: classifier + constants

Create `server/src/modules/smart-diff/`:

| File | Role |
|------|------|
| `constants.ts` | Path/basename patterns for boilerplate & wiring; extension / directory hints for core; `SPLIT_TOO_BIG_LINES` (and any sort tie-break thresholds) |
| `classifier.ts` | Pure `classifyPath(path): SmartDiffRole` (+ optional helpers for sort key within a role) |
| `service.ts` | Load PR (workspace-scoped) + `pr_files`; load latest review findings; build `SmartDiff` |
| `routes.ts` | `GET /pulls/:id/smart-diff` → `SmartDiffResponse` |
| `repository.ts` (optional thin) | Or reuse `ReviewRepository` / direct Drizzle reads already used by pulls — prefer calling existing review/pull data access without inventing a second findings API |

**Classification rules (deterministic, constants-driven):**

1. **Boilerplate (first match wins):** lockfiles; `dist/`, `build/`, `.next/`,
   `coverage/`; `*.min.js`; snapshots (`__snapshots__`, `*.snap`); generated
   (`*.generated.*`, `*.pb.go`, etc. — keep list in constants); large
   mechanical dumps if desired via size threshold **only after** path rules.
2. **Wiring:** config (`*.config.*`, `tsconfig*`, `package.json` **not**
   lockfile, `.env.example`, CI yaml under `.github/`); barrel/index files
   (`index.ts`, `index.tsx`, `mod.rs`, `__init__.py`); thin adapters/DI wiring
   paths if pattern-listed.
3. **Core (default for source):** application/source under `src/`, `app/`,
   `lib/`, `packages/*/src`, etc. — anything not matched above that looks like
   code; remaining unmatched files default to `core` **or** `wiring` per a
   single documented default in constants (prefer **`core`** so unknown code is
   reviewed, not skimmable).

**Grouping / ordering:**

- Emit up to three groups in fixed order: `core`, `wiring`, `boilerplate`
  (omit empty groups **or** include empty — pick one and stick to it;
  prefer **omit empty** for cleaner UI).
- Within a group, sort by: files with findings first, then by
  `(additions + deletions)` descending (review substance first).
- `finding_lines`: unique sorted `start_line` values for findings whose `file`
  matches the path (normalize path comparison consistently with how findings
  store `file`).
- `pseudocode_summary`: always `null` in MVP.
- `split_suggestion`:
  - `total_lines` = sum of additions+deletions across files
  - `too_big` = `total_lines >= SPLIT_TOO_BIG_LINES` (constant)
  - `proposed_splits`: when `too_big`, one proposed split per non-empty role
    group (name from role label); else `[]`

**Route:**

```http
GET /pulls/:id/smart-diff
→ 200 SmartDiffResponse
→ 404 if PR not in workspace
```

Register plugin in `server/src/modules/index.ts` next to `intent`.
No rate limit needed beyond defaults (read-only, cheap).

### Phase 2 — Server: classifier tests + `verify:l03` (REQUIRED)

1. Add unit tests, e.g. `server/test/smart-diff-classifier.test.ts` (or under
   `modules/smart-diff/*.test.ts` if the package already colocates — follow
   existing vitest discovery).
2. Minimum cases:
   - `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` → `boilerplate`
   - Typical app module e.g. `src/modules/billing/service.ts` → `core`
   - Wiring e.g. `src/index.ts` or `vite.config.ts` → `wiring`
   - Snapshot / `dist/` path → `boilerplate`
   - Grouping helper (if extracted): core files appear before boilerplate in
     emitted `groups` order; lockfile lands in boilerplate group
3. Add script — **either** is fine:
   - `server/package.json`: `"verify:l03": "vitest run <path-to-classifier-test>"`
     → run via `cd server && pnpm verify:l03`
   - **or** `scripts/verify-l03.sh` that `cd`s into `server` and runs the same
     vitest invocation
4. Name must contain `verify` or `l03`. Must execute real tests (exit non-zero
   on failure). Thin wrapper only — no stub `echo ok`.

### Phase 3 — Client: hook + SmartDiffViewer

1. **Hook** `client/src/lib/hooks/smart-diff.ts` (export from hooks barrel):
   - `useSmartDiff(prId)` → `GET /pulls/${prId}/smart-diff`
   - Query key e.g. `["smart-diff", prId]`
   - Invalidate on review completion alongside `["reviews", prId]` (same
     `onRunDone` path that already refetches reviews / intent) so badges appear
     after Run Review without reload

2. **SmartDiffViewer** colocated under
   `client/src/app/repos/[repoId]/pulls/[number]/_components/SmartDiffViewer/`
   (folder-per-component + `styles.ts` / `index.ts` per frontend-ui-architecture):
   - Group headers with role label, subtitle, icon/color:
     - **Core logic** — “The substance of the change — review closely.”
       (expanded by default)
     - **Wiring** — “Hooks the core into the app.”
     - **Boilerplate** — “Generated / mechanical — skim.”
       (collapsed by default)
   - Prefer extending i18n under `prReview.smartDiff` (existing keys + add
     subtitles / toggle labels / findings badge) rather than hardcoding English
   - Map each `SmartDiffFile` → `PrFile` by joining `path` with `pr.files` for
     `patch` (SmartDiff contract has no patch — patches stay on pull detail)
   - File headers: path, +/- , red dot / “N findings” badge when
     `finding_lines.length > 0`
   - Default open state: core group files expanded (subject to existing
     `AUTO_EXPAND_MAX_LINES` if reused); boilerplate **collapsed**; any file
     with findings **expanded** regardless of role
   - Optional `split_suggestion` banner using existing
     `largeTitle` / `largeBody` i18n when `too_big`
   - Do **not** invent `pseudocode_summary` UI copy if null

3. **DiffTab** changes:
   - Toggle: **Smart order** (default/active) vs **Original order**
   - Smart → SmartDiffViewer; Original → existing `DiffViewer` with
     `pr.files` order (unchanged commenting behavior)
   - Keep GitHub comment toggle working in both modes if feasible; minimum:
     Original keeps comments; Smart keeps comments if FileCard still used

4. **Findings overlay + scroll (acceptance-critical):**
   - Pass findings (from `usePrReviews` or parent) into FileCard / CodeLine
   - Inline markers by severity: SUGGESTION blue, WARNING yellow, CRITICAL red
     — use `@devdigest/ui` `SEV` tokens (do not redeclare color maps)
   - Clicking file-level “N findings” badge or a line marker expands the file
     (if needed) and `scrollIntoView` on the target line element
   - Stable line anchors: `data-path` + `data-line` (or ref map) on CodeLine

5. **page.tsx**: pass `prId` / invalidate smart-diff query on run done; keep
   Intent invalidate untouched.

### Phase 4 — Manual demo checklist (implementer notes)

- Large PR: core on top, lock collapsed
- Run Review → badges appear; click → scrolls to line
- Confirm Live Log / server logs: Smart Diff fetch does not trigger model call
- Homework notes (three short conclusions): **user / course homework**, not
  implementer code deliverable

## Skill routing (for implementer)

| Skill | When / which paths | Required? |
|-------|--------------------|-----------|
| `onion-architecture` | `server/src/modules/smart-diff/**` | yes |
| `fastify-best-practices` | `smart-diff/routes.ts`, module registration | yes |
| `zod` | Response schema wiring (`SmartDiffResponse`); only if contracts change | yes (boundary); contract edit only if unavoidable |
| `typescript-expert` | Classifier purity, path matching types | no (as needed) |
| `frontend-ui-architecture` | `SmartDiffViewer/`, DiffTab colocation, hooks placement | yes |
| `next-best-practices` | PR `page.tsx` / client boundaries | yes (light) |
| `react-best-practices` | Toggle state, expand/scroll, Query invalidation | yes |
| `react-testing-library` | Optional SmartDiffViewer smoke tests | no |
| `security` | Workspace scoping, no secrets in logs, untrusted paths | yes (constraints) |
| `engineering-insights` | After non-trivial finish — append gotchas to `server/` / `client/` INSIGHTS | yes (post-task) |
| `drizzle-orm-patterns` | Only if adding queries beyond existing repos | no if reusing |
| `postgresql-table-design` | — | defer (no schema) |
| `pr-self-review` | Pre-PR | **defer** |
| Architecture / security review agents | — | **defer** |

## Out of scope for implementer

- Architecture review, security review, PR self-review, opening PRs (unless
  user asks separately)
- New LLM calls, Intent derive changes, reviewer-core prompt changes
- New DB tables / migrations for smart-diff persistence
- Populating `pseudocode_summary` (“What this does”) via a model
- Requiring repo-intel `file_rank` for classification
- Browser e2e suite for Smart Diff (manual demo video is the mentor bar)
- Writing the three homework conclusion notes (user responsibility)
- Changing Intent Layer behavior or shared contracts for Intent

## Verification plan (implementer-owned)

| Package | Command | Scope |
|---------|---------|-------|
| `server` | `pnpm verify:l03` (or `bash scripts/verify-l03.sh`) | Classifier tests — **required mentor gate** |
| `server` | `pnpm exec vitest run --exclude '**/*.it.test.ts'` | Unit including new classifier tests |
| `server` | `pnpm typecheck` | Module + route types |
| `client` | `pnpm typecheck` | Viewer + hooks |
| `client` | `pnpm test` | Only if new/updated RTL tests added |
| Manual | Large PR in UI | Core first; lock collapsed |
| Manual | Run Review on that PR | Badges appear; click → line scroll |
| Manual | Server / Live Log | Smart Diff request creates **no** LLM call |
| Homework | Three short conclusions | User writes notes (not code) |

## Open questions

- **Latest review vs run-all wave:** Prefer newest single `ReviewRecord`; if
  demos always use “Run all agents”, confirm whether to union findings by
  shared `run_id` — implementer should pick the simpler newest-review rule
  unless demo clearly needs the union.
- **Empty groups:** Omit vs render empty section headers — recommend omit.
- **Default for unmatched paths:** Recommend `core` (review unknown code).
- **`SPLIT_TOO_BIG_LINES` exact number:** Not fixed by mentor — choose a
  documented constant (e.g. 400–800) in `constants.ts`; tune if demo PR never
  trips the banner.
- **Commenting in Smart order:** Keep if FileCard reuse is straightforward;
  otherwise Original order retains comments and Smart focuses on findings
  navigation (still meet badge/scroll acceptance).
