# Development Plan: Intent Layer

## Goal

- Add an Intent Layer that derives a structured explanation of why a PR exists
  and what is in/out of scope, then injects that intent into review and shows
  it on the PR page before review results.
- Use a separate cheap flash-class model (`FEATURE_MODELS.review_intent`,
  OpenRouter) for classification. Inputs: PR title, description, linked
  issue/ticket, available plan/spec, file list + hunk headers — **never** full
  diff bodies.
- Persist intent per PR; allow re-derive when the PR updates; filter
  out-of-scope review noise while keeping a single signal for serious
  out-of-scope issues; log prompt composition, model, token estimates, and
  sources without secrets or excess diff content.

## Success criteria

- [ ] Classifier returns `Intent { intent, in_scope[], out_of_scope[] }` via a
      cheap model resolved by `resolveFeatureModel(..., 'review_intent')`
- [ ] Classifier input includes title, body (if any), linked issue (if fetched),
      plan/spec (only if actually read), file paths, and hunk headers — no
      full `+`/`-` hunk bodies
- [ ] Empty PR body → intent from title + files + hunk headers with
      `context_quality: low` / `missing_context` (no invented ticket/spec)
- [ ] Unreachable plan/spec/ticket links are marked as missing context — never
      silently replaced with hallucinated content
- [ ] Intent persisted in `pr_intent` (1:1 per PR); `GET` + `POST` (re-run)
      work; stale when PR `head_sha` changes (optional meta) or user re-runs
- [ ] On Run Review: intent injected into reviewer prompt (untrusted +
      `INJECTION_GUARD`); Live Log / traces show **two** distinct LLM calls
      (classify vs review)
- [ ] Out-of-scope findings filtered after grounding; CRITICAL / security
      always kept; ≥1 signal when non-critical OOS findings were suppressed
- [ ] Intent card on PR Overview (and compact block atop Findings) **before**
      review results; Re-run intent control
- [ ] Settings already exposes `review_intent`; default changed to a cheap
      OpenRouter flash model (aligned with other feature defaults)
- [ ] Observability logs source flags, model, token estimates — no API keys,
      no full diff / secret content
- [ ] Fail-open: classifier failure does not block Run Review
- [ ] Implementer-owned package tests/typechecks pass for touched packages

## Affected modules

| Module | Why | Notes from AGENTS.md / INSIGHTS.md |
|--------|-----|-------------------------------------|
| `server/` | New `modules/intent/` (derive + HTTP); wire in `reviews/run-executor`; optional `pr_intent` meta | Onion modules; secrets via `LocalSecretsProvider` only; pattern from `modules/conventions/` + `resolveFeatureModel` |
| `reviewer-core/` | `assemblePrompt` intent slot; optional scope-filter helper after `groundFindings` | Pure engine — no DB/FS; untrusted via `wrapUntrusted`; grounding remains mandatory |
| `server/src/vendor/shared` + `client/src/vendor/shared` | `PromptAssembly.intent`; optional transport fields on `PrIntentRecord` | **High risk:** two byte-identical copies — edit both (INSIGHTS 2026-08-01) |
| `client/` | Intent card, hooks, Overview/Findings integration | Colocate under PR `_components/`; Settings models UI already lists `review_intent` |
| `e2e/` | Usually out of MVP | Deterministic e2e without LLM — defer |

### Scaffolding already in repo (do not reinvent)

| Layer | Exists | Path |
|-------|--------|------|
| DB | `pr_intent` (`intent`, `in_scope`, `out_of_scope`) | `server/src/db/schema/reviews.ts` |
| DB | `pr_brief` (L05 — out of scope) | same |
| Zod | `Intent`, `PrIntentRecord`, `PrBrief` | `contracts/brief.ts`, `contracts/review-api.ts` |
| Repo | `upsertIntent` / `getIntent` | `reviews/repository/pull.repo.ts` |
| Feature model | `review_intent` (default today: `openai` / `gpt-4.1`) | `contracts/platform.ts` |
| Router hint | `routeModel('intent' \| 'classify')` cheap tasks | `server/src/platform/model-router.ts` |
| Executor comments | “load diff + intent” shared pre-work | `reviews/run-executor.ts` |
| Guard | `INJECTION_GUARD` already mentions derived intent/scope | `reviewer-core/src/prompt.ts` |

### Missing today

- `server/src/modules/intent/` (routes, service, sources builder, classifier prompt)
- HTTP `GET`/`POST /pulls/:id/intent`
- Slot in `assemblePrompt` / `PromptAssembly`
- Wire in `ReviewRunExecutor.executeRuns`
- Scope filter + OOS signal
- Client Intent card + hooks
- Cheap default for `review_intent`

## Constraints & risks

- **Shared contracts:** only add fields required for API/trace; sync both
  vendor copies in the same change; typecheck `server` + `client`.
- **Secrets:** never log or persist API keys / tokens; keys only via
  `LocalSecretsProvider` / `~/.devdigest/secrets.json`.
- **Untrusted data:** intent, PR body, issue/spec text are data inside
  `<untrusted>` — never instructions; intent must not descope real
  security/correctness defects (`INJECTION_GUARD`).
- **No full diff bodies in classifier:** sources builder must extract hunk
  headers only; unit-test invariant (no `+`/`-` body lines in classifier payload).
- **Linked issue not persisted** on `pull_requests` today — best-effort live
  fetch on derive; 404/timeout → missing context, no hallucination.
- **Plan/spec module incomplete** in starter registry — only include content
  successfully read from an explicit link/path; otherwise
  `sources.plan_spec = false`.
- **Fail-open** on classifier errors so Run Review still completes.
- **OOS filter vs grounding:** do not invent fake `file:line` findings for the
  OOS signal; prefer summary suffix + Live Log `result` (+ optional UI badge).
- **Dual model source:** `feature_models.review_intent` is canonical;
  `routeModel` optional fallback only — do not fork truth.
- **Default model:** change `FEATURE_MODELS.review_intent` from expensive
  `gpt-4.1` to cheap OpenRouter flash (e.g. align with `onboarding`:
  `openrouter` + `deepseek/deepseek-v4-flash` or current flash slug).
- Do not “clean up” unused schema columns (`server/AGENTS.md`).

## Approach

### Data sources (classifier)

| Source | Where | Classifier | Notes |
|--------|-------|------------|-------|
| Title | `pull_requests.title` | always | |
| Description | `pull_requests.body` | truncate (~4k) | empty → low quality |
| Linked issue | GitHub `getPullRequest` / body refs | only if fetched | never invent |
| Plan / spec | links/paths from body | only if read OK | timeout/404 → missing |
| File list | `pr_files.path` (+ stats) | always | |
| Hunk headers | `@@ … @@` from `pr_files.patch` | always | reuse hunk-header regex from git diff parser helpers |
| Full diff | `loadDiff` | **never** | review Call 2 only |

Builder: `server/src/modules/intent/sources.ts` → bundle + meta
(`context_quality`, `missing[]`, source flags).

### Call sequence (import → review)

```mermaid
sequenceDiagram
  participant UI
  participant Pulls as pulls/routes
  participant Intent as intent/service
  participant LLM1 as Cheap classifier
  participant DB as pr_intent
  participant Rev as run-executor
  participant Core as reviewer-core

  UI->>Pulls: GET list + GET /pulls/:id
  Note over Pulls: body, files, patches; linked_issue runtime-only

  alt Missing / stale / Re-run Intent
    UI->>Intent: POST /pulls/:id/intent
    Intent->>Intent: build sources (no diff bodies)
    Intent->>LLM1: Call 1 structured Intent
    Intent->>DB: upsertIntent
    Intent-->>UI: PrIntentRecord + quality/sources
  end

  UI->>Rev: POST /pulls/:id/review
  Rev->>Rev: loadDiff (full, for review)
  Rev->>Intent: ensureIntent (get or derive, fail-open)
  Rev->>Core: reviewPullRequest(+ intent)
  Note over Core: Call 2 agent model
  Core->>Core: groundFindings then scopeFilter
  Rev->>DB: reviews + findings
```

**When to derive:** lazy on Run Review if missing/stale; explicit
`POST /pulls/:id/intent`; never block import/poll.

### Phase 0 — Shared contracts (minimal)

- Extend `PromptAssembly` with `intent: z.string().nullish()` in both
  `server/src/vendor/shared/contracts/trace.ts` and client mirror.
- Keep core `Intent` shape; optionally extend transport `PrIntentRecord` with
  `context_quality`, `sources`, `derived_for_sha`, `stale` (computed).
- Prefer API/response meta over a DB migration for MVP; optional later:
  `meta jsonb` or `derived_for_sha` / `context_quality` on `pr_intent`.

### Phase 1 — Server `modules/intent/`

New Fastify plugin (pattern: `modules/conventions/`):

| Piece | Responsibility |
|-------|----------------|
| `sources.ts` | Build classifier input; hunk headers only |
| `prompt.ts` / prompts | Classifier system + untrusted sections |
| `llm-schema.ts` | Zod ≡ `Intent` (+ optional quality/missing) |
| `service.ts` | `derive`, `ensureForReview`, `get`; `resolveFeatureModel`; `completeStructured`; `upsertIntent` |
| `routes.ts` | `GET` / `POST /pulls/:id/intent` |
| Register | `server/src/modules/index.ts` |

Default: update `FEATURE_MODELS.review_intent` to cheap OpenRouter flash.

### Phase 2 — reviewer-core prompt + scope filter

- `PromptParts.intent?: string`; render `## Derived intent & scope` after task /
  near PR description via `wrapUntrusted('intent', …)`.
- Update assembly for traces.
- Pure helper e.g. `review/scope-filter.ts`:
  - Drop findings clearly about `out_of_scope` topics when not CRITICAL/security
    (and not secret-leak / lethal kinds).
  - Escape hatch: never drop CRITICAL / `security` / secret-related kinds.
  - Signal: summary suffix + Live Log — **not** a fake grounded line.
- Pipeline order: reduce → `groundFindings` → scopeFilter → rescore from kept.

### Phase 3 — Wire into review run

In `ReviewRunExecutor.executeRuns` after `loadDiff` (or parallel with
lightweight sources — classifier must not receive full diff):

1. `ensureForReview` (fail-open).
2. `RunLogger` steps: sources summary, classify tool, tokens, injected yes/no.
3. Pass `intent` into `reviewPullRequest` / `assemblePrompt`.
4. Apply scope filter after grounding; emit OOS signal in log/summary.

### Phase 4 — Client UI

- Component: `.../pulls/[number]/_components/IntentCard/`
- Show: summary (`intent`), In scope / Out of scope lists, quality badge,
  stale/missing warnings, **Re-run intent**.
- Placement: first section of `OverviewTab`; compact block atop `FindingsTab`
  before Live review / Review runs.
- Hooks: `usePrIntent` → `GET`/`POST /pulls/:id/intent`.
- i18n under existing PR review message namespace.
- Settings: registry default only (picker already exists).

### Phase 5 — Observability

Log via `RunLogger` / POST response (no secrets, no full patches):

| Event | Log |
|-------|-----|
| `intent.sources` | body_len, has_issue, has_spec, files_n, hunk_headers_n, missing[], quality |
| `intent.classify` | provider, model, tokens, latency |
| `intent.persisted` / `intent.failed` | pr_id; on fail review continues |
| `intent.injected` / `intent.scope_filter` | yes/no; dropped_n |

`prompt_assembly.intent` in run trace (truncated slot text).

### Phase 6 — Implementer smoke tests

- `reviewer-core`: prompt slot; scope-filter escape hatch; no-diff-body invariant
  for a shared sources helper if tested from server.
- `server`: sources builder; fail-open ensure; route happy path / upsert.
- `client`: IntentCard render (quality/stale/re-run).

## Skill routing (for implementer)

| Skill | When / which paths | Required? |
|-------|--------------------|-----------|
| `onion-architecture` | `server/src/modules/intent/**` | yes |
| `fastify-best-practices` | `intent/routes.ts` | yes |
| `drizzle-orm-patterns` | only if adding `pr_intent` columns / migration | yes if schema |
| `postgresql-table-design` | same | yes if schema |
| `zod` | Intent DTO, llm-schema, `PromptAssembly`, route schemas | yes |
| `typescript-expert` | shared contracts + cross-package wiring | yes |
| `security` | untrusted wrap, no secrets in logs, injection, OOS escape hatch | yes |
| `frontend-ui-architecture` | `IntentCard` colocation under PR page | yes |
| `next-best-practices` | PR page / hooks / data fetching | yes |
| `react-best-practices` | IntentCard | yes |
| `react-testing-library` | IntentCard smoke tests | yes (smoke) |
| `engineering-insights` | after non-trivial wrap-up | yes |
| plan-verifier / architecture-reviewer / test-writer / doc-writer | post-implement checks & specs | **defer** |
| pr-self-review / security review subagent | pre-PR | **defer** |

## Out of scope for implementer

- Architecture review (`architecture-reviewer`), plan verification
  (`plan-verifier`), test gap-fill (`test-writer`), feature docs (`doc-writer`)
- Security review, PR self-review, opening PRs
- Smart Diff, full PR Brief (blast / risks / history) — later lessons
- Full Project Context module — only best-effort read of linked files if present
- Multi-agent eval / CI export
- e2e with live LLM

## Verification plan (implementer-owned)

| Package | Command | Scope |
|---------|---------|--------|
| `reviewer-core` | `pnpm test` / `pnpm typecheck` | intent prompt slot, scope-filter, assembly |
| `server` | `pnpm test` (+ `.it.test` for upsert/routes if needed) / `pnpm typecheck` | sources builder (no bodies), fail-open, intent routes |
| `client` | `pnpm test` / `pnpm typecheck` | IntentCard, hooks |
| `e2e` | — | skip MVP |

### Manual / video checklist

1. Intent card correctly describes PR goal (in/out scope).
2. Classifier uses separate cheap model from Settings `review_intent`.
3. Classifier request has no full change bodies (headers + paths only).
4. Plan/spec from PR description included when fetchable; otherwise missing flagged.
5. Logs show two LLM calls (classify + review); composition without secrets/excess code.
6. Read-only agents must not modify product files (process check — not code).

## Open questions

1. Change default `FEATURE_MODELS.review_intent` to which exact OpenRouter flash
   slug in this PR? (Recommendation: match `onboarding` —
   `openrouter` + `deepseek/deepseek-v4-flash` unless a newer flash is preferred.)
2. Serious OOS signal: Live Log + summary suffix only, or also UI badge
   “N suppressed”?
3. Add `derived_for_sha` / `meta` migration now, or MVP with Re-run-only
   freshness (no automatic stale badge)?
4. Intent card on both Overview and Findings, or one surface only?
   (Recommendation: both — Overview for verification, Findings before results.)
)
