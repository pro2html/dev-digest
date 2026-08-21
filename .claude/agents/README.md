# Agents

Project subagents in `.claude/agents/`. Each file is YAML frontmatter + system
prompt. Invoke by name (or let the parent route via `description`). Full
instructions live in the agent files — this README is only a map.

Typical chain: **researcher** (optional facts) → **spec-creator** (SDD spec) →
human approve (no `[NEEDS CLARIFICATION]`) → **implementation-planner** (plan) →
**sdd-implement** skill (fresh chat) → **implementer** → **architecture-reviewer**
+ **test-writer** in parallel → **plan-verifier** → **pr-self-review** →
**doc-writer** (optional; no second spec).

After a plan exists, the parent must load
[sdd-implement](../skills/sdd-implement/SKILL.md) rather than spawning
specialists ad hoc.

## Token-efficient hand-off (low risk)

Goal: cut repeated context **without** dropping plan-verifier /
architecture-reviewer or shrinking the English plan on disk. Do **not** merge
implementer with self-review, and do **not** switch verify agents to weaker
models as a substitute for this protocol.

### Parent / orchestrator rules

Follow [sdd-implement](../skills/sdd-implement/SKILL.md) for the implementation
chain. Short form:

1. **Canon on disk, not in chat.** Point agents at `docs/plans/<kebab>.md` and
   (after impl) the Implementation Report path list. Do **not** paste the full
   plan, full research report, or full verify report into the next Task prompt.
2. **Task prompts stay short** (path to plan + overrides + success notes). Let
   the subagent `Read` the plan file.
3. **Read Execution mode** on the Implementation Plan before spawning anyone:
   - **multi-agent** — spawn specialists in order: `implementer` →
     `architecture-reviewer` **and** `test-writer` in parallel → `plan-verifier`
     **last** (once) → optionally `pr-self-review` then `doc-writer`.
     Architecture-reviewer is boundaries only; logic bugs are `pr-self-review`.
   - **single-agent** — one agent executes Approach + tests; do **not** spawn
     `implementer`, `test-writer`, `architecture-reviewer`, or `doc-writer`.
     Still spawn read-only **`plan-verifier`** after that pass.
4. **One plan-verifier run** after implementer-owned checks are green **and**
   test-writer (multi-agent) has finished; fix CRITICAL architecture findings
   first. Re-run plan-verifier only for findings you asked to fix (scoped to
   those IDs/paths). Do not re-run full test suites when reports already pass.
5. **Prefer a fresh chat** for implementer (and for post-PASS polish) so the
   parent context is not the entire spec/plan history.
6. Skip a redundant **explore** when implementation-planner can read the repo;
   use researcher only when external facts or a non-obvious repo map are
   needed. Do **not** resume a heavy explore transcript into
   implementation-planner — start it with the research brief path or bullets
   instead. Specs come from **spec-creator**; implementation-planner does not
   clarify product requirements and does not plan a `draft` with
   `[NEEDS CLARIFICATION]` markers unless the user overrides.

### Artifact size limits (chat)

| From → to | Chat artifact | Limit |
|-----------|---------------|-------|
| researcher → spec-creator / parent | Research brief (bullets + key paths/URLs) | ≤ ~400 words; full detail only if asked |
| spec-creator → implementation-planner / parent | Russian Summary + `Spec file:` path | **No** full English spec in chat |
| implementation-planner → parent / implementer | Russian Summary + `Plan file:` path | **No** full English plan in chat |
| implementer → verifiers / parent | Implementation Report (existing template) with explicit **Changed paths** | Prefer path table over narrative dumps |
| plan-verifier / architecture-reviewer → parent | Verdict + findings table | Prefer findings only; no plan restatement |

### Verifier scoping

When an Implementation Report lists changed paths, verifiers **start** from
that allowlist (+ the plan file + listed entrypoints). Broaden only if a plan
item cannot be evidenced inside the list. Prefer `git`-style path focus over
re-reading unrelated packages.

## Catalog

| Agent | Model | Role | Mutates repo? |
|-------|-------|------|---------------|
| [researcher](researcher.md) | `sonnet` | Repo + external research | No |
| [spec-creator](spec-creator.md) | `grok` | SDD spec (EARS) → `docs/specs/YYYY-MM-DD-*.md` | Yes (`docs/specs/` only) |
| [implementation-planner](implementation-planner.md) | `grok` | Implementation Plan (AC-traced) → `docs/plans/` | Yes (`docs/plans/` only) |
| [implementer](implementer.md) | `grok` | Execute approved plan | Yes |
| [test-writer](test-writer.md) | `grok` | UI / backend tests | Yes (tests) |
| [plan-verifier](plan-verifier.md) | `sonnet` | Verify code vs plan checklist | No |
| [architecture-reviewer](architecture-reviewer.md) | `sonnet` | Architecture boundaries + evidence | No |
| [doc-writer](doc-writer.md) | `sonnet` | Specs / docs + mermaid | Yes (docs) |

---

## researcher

**Responsibility.** Gather and analyze facts from the repository and open
sources. No implementation.

| | |
|---|---|
| **Tools** | `Read`, `Grep`, `Glob`, `WebSearch`, `WebFetch` |
| **Denied** | `Write`, `Edit`, `NotebookEdit`, `Bash` |
| **Input** | Concrete research question (clarifies first if vague) |
| **Output** | Research report in chat; for hand-off to spec-creator / implementation-planner prefer a short **brief** (see agent file) |

---

## spec-creator

**Responsibility.** Produce an SDD feature spec (what / why: behaviour, EARS AC,
workflows, service communication, contracts). Six clarification categories;
`[NEEDS CLARIFICATION]` instead of guesses. May **read** `devdigest` MCP
(`list_agents`, `get_conventions`, `get_findings`; never `run_agent_on_pr`).
Persists under `docs/specs/YYYY-MM-DD-<kebab-feature>.md` (flat; `SPEC-NN` in
the body). Does not write product code, Implementation Plans, or implementation
recipes. Does not rewrite legacy narrative specs unless explicitly asked.
Alias: spec-planner.

| | |
|---|---|
| **Tools** | `Read`, `Grep`, `Glob`, `Write`, `Edit`, `Skill`, read-only `devdigest` MCP |
| **Denied** | `NotebookEdit`, `Bash`, `Agent`; MCP write (`run_agent_on_pr`) |
| **permissionMode** | `acceptEdits` |
| **Preloaded skills** | `ears-requirements`, `mermaid-diagram`. (On-demand: onion / frontend-ui / security / Fastify / Drizzle / Postgres / Next / React / `zod` / `typescript-expert`. Never: `react-testing-library`, `pr-self-review`, `engineering-insights`.) |
| **Input** | Feature / change request; optional design/mockups; research brief |
| **Output** | English file `docs/specs/YYYY-MM-DD-<kebab-feature>.md` + Russian summary in chat |

### Rule sources (spec-creator)

| Practice | Source |
|----------|--------|
| Persist SDD specs | [`docs/specs/`](../../docs/specs/) (`spec-creator`; not legacy narrative rewrites) |
| EARS AC, six categories, `[NEEDS CLARIFICATION]` | [ears-requirements](../skills/ears-requirements/SKILL.md) |
| Workflow / sequence diagrams | [mermaid-diagram](../skills/mermaid-diagram/SKILL.md) |
| Module / UI boundaries as constraints (on-demand) | [onion-architecture](../skills/onion-architecture/SKILL.md), [frontend-ui-architecture](../skills/frontend-ui-architecture/SKILL.md) |
| Untrusted inputs / access as requirements (on-demand) | [security](../skills/security/SKILL.md) |

---

## implementation-planner

**Responsibility.** Produce an executable Implementation Plan from an existing
SDD spec (`SPEC-NN`, `AC-01`…). Every plan task cites an AC-ID. Persists under
`docs/plans/`. Does not write product code, specs, or clarify requirements
(that is spec-creator). Refuses `draft` specs with `[NEEDS CLARIFICATION]`
unless the user overrides. Asks **Execution mode** (multi- vs single-agent).

| | |
|---|---|
| **Tools** | `Read`, `Grep`, `Glob`, `Write`, `Edit`, `Skill` |
| **Denied** | `NotebookEdit`, `Bash`, `Agent` |
| **permissionMode** | `acceptEdits` |
| **Preloaded skills** | `onion-architecture`, `frontend-ui-architecture`, `mermaid-diagram`. Stack skills on-demand from `Packages:` (Fastify/Drizzle/Postgres/Next/React/RTL/`zod`/`typescript-expert`/`security`). Not preloaded: `engineering-insights`, `pr-self-review`. |
| **Input** | SDD spec path with `AC-01`… (`docs/specs/YYYY-MM-DD-*.md`); Execution mode if already chosen |
| **Output** | English file `docs/plans/<kebab-name>.md` (spec source, execution mode, **AC coverage**, phases with `AC:`, Skill routing, verification) + Russian summary in chat |

### Rule sources (implementation-planner)

| Practice | Source |
|----------|--------|
| Subagent file format, `description` routing, tool allow/deny, `permissionMode`, `skills` preload, focused one-task agents, chain workflows | [Claude Code: Create custom subagents](https://code.claude.com/docs/en/sub-agents) |
| When to use subagents vs skills; policy for repeated workflows | [Anthropic: How and when to use subagents](https://claude.com/blog/subagents-in-claude-code) |
| Spec as product contract; no requirements Q&A | [spec-creator.md](spec-creator.md), [ears-requirements](../skills/ears-requirements/SKILL.md) |
| Module map, `INSIGHTS.md`, do-not-touch `@devdigest/shared`, per-package scripts/tests | Root [`AGENTS.md`](../../AGENTS.md), [`TESTING.md`](../../TESTING.md), [engineering-insights](../skills/engineering-insights/SKILL.md) |
| Skill routing targets | Catalog in [../skills/README.md](../skills/README.md) |
| Persist plans | [`docs/plans/`](../../docs/plans/) (implementation-planner-only; not `doc-writer` / `spec-creator`) |

---

## implementer

**Responsibility.** Implement an **approved** Implementation Plan in frontend and/or
backend, load skills from the plan’s Skill routing, run **targeted** typecheck /
vitest on touched files (not a full package suite), self-check within
implementation only. Architecture and security review are out of scope.

| | |
|---|---|
| **Tools** | `Read`, `Grep`, `Glob`, `Bash`, `Edit`, `Write`, `Skill`, `TodoWrite` |
| **Denied** | `Agent` |
| **permissionMode** | `acceptEdits` |
| **Preloaded skills** | none (on-demand via Skill tool per plan) |
| **Input** | Approved plan — prefer `docs/plans/<kebab-name>.md` (English); short overrides only |
| **Output** | Code changes + Implementation Report in chat (Russian): status, **Changed paths**, skills, verification, hand-off |

### Rule sources (implementer)

| Practice | Source |
|----------|--------|
| Tool least privilege, `acceptEdits`, no nested `Agent`, sequential hand-off from implementation-planner | [Claude Code: Create custom subagents](https://code.claude.com/docs/en/sub-agents) |
| Skills as on-demand procedures; subagent for isolated implementation context | [Anthropic: How and when to use subagents](https://claude.com/blog/subagents-in-claude-code) |
| Plan-as-contract, targeted typecheck/vitest for touched files, no drive-by scope | Root [`AGENTS.md`](../../AGENTS.md), [`TESTING.md`](../../TESTING.md) |
| Defer architecture / security / pre-PR review / plan check / docs | [architecture-reviewer](architecture-reviewer.md), [plan-verifier](plan-verifier.md), [doc-writer](doc-writer.md), [security](../skills/security/SKILL.md), [pr-self-review](../skills/pr-self-review/SKILL.md) |
| Capture lessons after non-trivial work | [engineering-insights](../skills/engineering-insights/SKILL.md) |

---

## test-writer

**Responsibility.** Write focused UI and backend tests after implementation,
following `TESTING.md` (typological seams). Each new test cites `AC-NN`. Does
not implement product features or run architecture review. Runs in parallel
with architecture-reviewer; plan-verifier comes after.

| | |
|---|---|
| **Tools** | `Read`, `Grep`, `Glob`, `Bash`, `Edit`, `Write`, `Skill`, `TodoWrite` |
| **Denied** | `Agent` |
| **permissionMode** | `acceptEdits` |
| **Preloaded skills** | `react-testing-library` (on-demand: `react-best-practices`, `fastify-best-practices`, `zod`, `onion-architecture`) |
| **Input** | Plan / Implementation Report / `AC-NN` to cover |
| **Output** | Test files + Test Report in chat (Russian) |

### Rule sources (test-writer)

| Practice | Source |
|----------|--------|
| Suite map, philosophy, unit vs `*.it.test.ts`, commands | [`TESTING.md`](../../TESTING.md) |
| RTL / Vitest client patterns | [react-testing-library](../skills/react-testing-library/SKILL.md) |
| Focused test-writer subagent, least privilege tools | [Claude Code: Create custom subagents](https://code.claude.com/docs/en/sub-agents) |

---

## plan-verifier

**Responsibility.** Verify implemented code against **every** item of an
approved Implementation Plan (AC coverage, phases with AC-IDs, skill routing,
verification commands). Run **last** after implementer + test-writer (and after
CRITICAL architecture fixes). Trust existing pass reports; do not re-run full
suites by default. Structured pass/fail with evidence — not generic advice.

| | |
|---|---|
| **Tools** | `Read`, `Grep`, `Glob`, `Bash`, `Skill` |
| **Denied** | `Write`, `Edit`, `NotebookEdit`, `Agent` |
| **permissionMode** | `plan` |
| **Preloaded skills** | none (on-demand from plan Skill routing) |
| **Input** | Plan path `docs/plans/…` + Implementation Report (**Changed paths**) + Test Report |
| **Output** | Plan Verification report in chat (Russian): overall + per-item table |

### Rule sources (plan-verifier)

| Practice | Source |
|----------|--------|
| Plan as executable contract / observable outcomes | [OpenAI Cookbook: Codex exec plans](https://github.com/openai/openai-cookbook/blob/main/articles/codex_exec_plans.md) |
| Binary, evidence-backed acceptance checks | [Braingrid: Acceptance criteria AI can verify](https://www.braingrid.ai/blog/how-to-write-acceptance-criteria-ai-agent-can-verify) |
| Read-mostly verifier; Bash only for verification | [Claude Code: Create custom subagents](https://code.claude.com/docs/en/sub-agents) |

---

## architecture-reviewer

**Responsibility.** Read-only architecture **boundary** review (Onion, frontend
UI layout, package / shared boundaries). After implementer, parallel with
test-writer, **before** plan-verifier. Findings require `path:lines` evidence.
Does not rewrite code and is not a logic-bug hunt (`pr-self-review`).

| | |
|---|---|
| **Tools** | `Read`, `Grep`, `Glob`, `Skill` |
| **Denied** | `Write`, `Edit`, `NotebookEdit`, `Bash`, `Agent` |
| **permissionMode** | `plan` |
| **Preloaded skills** | `onion-architecture`, `frontend-ui-architecture` |
| **Input** | Scoped paths / plan path / Implementation Report Changed paths |
| **Output** | Architecture Review in chat (Russian): verdict + findings table |

### Rule sources (architecture-reviewer)

| Practice | Source |
|----------|--------|
| Onion / UI architecture rules | [onion-architecture](../skills/onion-architecture/SKILL.md), [frontend-ui-architecture](../skills/frontend-ui-architecture/SKILL.md) |
| Evidence-based architecture review contracts | [Architecture reviews need contracts](https://dev.to/devasservice/why-architecture-reviews-need-contracts-not-chat-3jjg), [arch-review.md example](https://raw.githubusercontent.com/bdfinst/agentic-dev-team/main/plugins/dev-team/agents/arch-review.md) |
| Read-only reviewer tools | [Claude Code: Create custom subagents](https://code.claude.com/docs/en/sub-agents) |

---

## doc-writer

**Responsibility.** Document implemented features under `docs/` (and package
docs) with mermaid diagrams. Knows the destination map. Does **not** create a
second undated spec next to a dated SDD file. Does not write `INSIGHTS.md` or
product code.

| | |
|---|---|
| **Tools** | `Read`, `Grep`, `Glob`, `Write`, `Edit`, `Skill`, `TodoWrite` |
| **Denied** | `Agent`, `Bash` |
| **permissionMode** | `acceptEdits` |
| **Preloaded skills** | `mermaid-diagram` |
| **Input** | Approved plan from `docs/plans/` and/or Implementation Report |
| **Output** | Docs (English) + Documentation Report in chat (Russian) |

### Rule sources (doc-writer)

| Practice | Source |
|----------|--------|
| Destination map for this repo | Agent file + existing [`docs/specs/`](../../docs/specs/), [`docs/agent-prompts/`](../../docs/agent-prompts/) |
| Doc-type classification lens (do not invent new folders) | [Diátaxis](https://diataxis.fr/start-here/) |
| Mermaid conventions | [mermaid-diagram](../skills/mermaid-diagram/SKILL.md) |
| Specs tone | e.g. [`docs/specs/skills-feature.md`](../../docs/specs/skills-feature.md) |

---

## Adding an agent

1. Add `<name>.md` here with required frontmatter `name` + `description`.
2. Restrict tools to the minimum for the role.
3. Link the new agent from this catalog.
4. Keep the full prompt in the agent file — update this README only as a map.
