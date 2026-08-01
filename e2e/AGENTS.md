# e2e/ — AGENTS.md

`@devdigest/e2e`: deterministic UI flows for the web app, driven by Vercel
**agent-browser** (native Rust + CDP CLI). No Playwright, no LLM, no API key.

- **Stack:** TypeScript, `tsx`, `agent-browser` CLI (external binary, not an
  npm test framework).
- **Run:** `pnpm test` (`run.ts`, runs every flow in one shared browser
  session) or `pnpm e2e:hermetic` (`../scripts/e2e.sh`, brings up its own
  stack). **Typecheck:** `pnpm typecheck`.
- **Map:** `specs/NN-name.flow.json` — each is a JSON list of agent-browser
  commands (see `README.md` for the shape); `lib/` holds `run.ts` helpers.

## Non-default conventions

- Locators are deterministic only (`--url`, `--text`, `find role|text|label`)
  — never use the AI `chat` command, or runs stop being stable/key-free.
- `{BASE}` in a flow is replaced with `E2E_BASE_URL`
  (default `http://localhost:3000`).
- A non-zero exit from any `cmd` fails the step and the flow — `wait --text` /
  `wait --url` **are** the assertions, there's no separate expect step.

## Gotchas

- Flows assume a **freshly-seeded DB** (demo repo `acme/payments-api`, PR
  #482). Flow `02` follows the home redirect to the *first* repo, so it
  assumes the seeded repo is the only one — don't run against a DB with other
  repos already added.

## Read when

- Flow JSON shape / precondition details → [`README.md`](README.md)
- Past gotchas/lessons learned → [`INSIGHTS.md`](INSIGHTS.md)
