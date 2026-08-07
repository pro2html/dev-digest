# reviewer-core/ — AGENTS.md

`@devdigest/reviewer-core`: pure review logic — diff → prompt → LLM →
grounded findings. **No** database, GitHub, or filesystem access; the only
side effect is an LLM call through an **injected** `LLMProvider`.

- **Stack:** TypeScript 5.7, Zod 3, `openai` client (used against
  OpenRouter). `type: module`; the package never emits JS — `build` is a
  type-check only (`tsc --noEmit`).
- **Test:** `pnpm test` (vitest, `--passWithNoTests`). **Typecheck:**
  `pnpm typecheck`.
- **Map:** `src/review/` orchestrates the run (`run.ts`,
  `prompt.ts` assembles the prompt, `grounding.ts` grounds findings against
  the diff); `src/llm/` wraps the provider + structured output
  (`structured.ts`, Zod → JSON Schema, parse-with-repair); `src/output/` is
  the `Review`/finding shape. Public surface is `src/index.ts` only.

## Non-default conventions

- **Consumed as source**, not a built artifact — the server imports it via a
  tsconfig path alias (`@devdigest/reviewer-core` → `../reviewer-core/src`).
  Don't add a publish/dist step.
- Untrusted content (diff, repo map) is always wrapped with `wrapUntrusted()`
  + `INJECTION_GUARD` before hitting the prompt — never interpolate raw diff
  text directly.
- The grounding gate (`groundFindings()`) is mandatory: a finding without a
  real diff line citation gets dropped, and the score is recomputed from
  **surviving** findings only — never trust a score the model returns.
- Optional prompt slots (`skills`, `memory`, `specs`, `callers`) are wired by
  later course lessons; if a caller omits one, `assemblePrompt` just leaves
  that section out — don't add a fallback/default for unused slots.

## Read when

- Pipeline diagram / public API list → [`README.md`](README.md)
- Architecture decisions → [`docs/`](docs/README.md)
- Feature/behavior specs → [`specs/`](specs/README.md)
- Past gotchas/lessons learned → [`INSIGHTS.md`](INSIGHTS.md)
