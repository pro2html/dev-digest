# Agents

Project subagents in `.claude/agents/`. Each file is YAML frontmatter + system
prompt. Invoke by name (or let the parent route via `description`). Full
instructions live in the agent files — this README is only a map.

Typical chain: **researcher** (facts) → **planner** (plan) → **implementer**
(code) → **test-writer** (optional tests) → **plan-verifier** (plan contract) →
**architecture-reviewer** (boundaries) → separate **security** / `pr-self-review`
→ **doc-writer** (when docs are needed).

## Token-efficient hand-off (low risk)

Goal: cut repeated context **without** dropping plan-verifier /
architecture-reviewer or shrinking the English plan on disk. Do **not** merge
implementer with self-review, and do **not** switch verify agents to weaker
models as a substitute for this protocol.

### Parent / orchestrator rules

1. **Canon on disk, not in chat.** Point agents at `docs/plans/<kebab>.md` and
   (after impl) the Implementation Report path list. Do **not** paste the full
   plan, full research report, or full verify report into the next Task prompt.
2. **Task prompts stay short** (path to plan + overrides + success notes). Let
   the subagent `Read` the plan file.
3. **One verify wave** after implementer-owned checks are green: run
   plan-verifier and architecture-reviewer in parallel once. Re-run only for
   findings you asked to fix (scoped to those IDs/paths).
4. **Prefer a fresh chat** for post-PASS polish / Q&A so the parent context is
   not the entire impl history.
5. Skip a redundant **explore** when planner can read the repo; use researcher
   only when external facts or a non-obvious repo map are needed. Do **not**
   resume a heavy explore transcript into planner — start planner with the
   research brief path or bullets instead.

### Artifact size limits (chat)

| From → to | Chat artifact | Limit |
|-----------|---------------|-------|
| researcher → planner / parent | Research brief (bullets + key paths/URLs) | ≤ ~400 words; full detail only if asked |
| planner → parent / implementer | Russian Summary + `Plan file:` path | **No** full English plan in chat |
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
| [planner](planner.md) | `grok` | Structured Development Plan → `docs/plans/` | Yes (`docs/plans/` only) |
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
| **Output** | Research report in chat; for hand-off to planner prefer a short **brief** (see agent file) |

---

## planner

**Responsibility.** Produce an executable Development Plan aligned with modules,
project skills, `INSIGHTS.md`, and architectural constraints. Persists the plan
under `docs/plans/`. Does not write product code or run shell.

| | |
|---|---|
| **Tools** | `Read`, `Grep`, `Glob`, `Write`, `Edit`, `Skill` |
| **Denied** | `NotebookEdit`, `Bash`, `Agent` |
| **permissionMode** | `acceptEdits` |
| **Preloaded skills** | Architecture: `onion-architecture`, `frontend-ui-architecture`, `mermaid-diagram`. Backend: `fastify-best-practices`, `drizzle-orm-patterns`, `postgresql-table-design`. Frontend: `next-best-practices`, `react-best-practices`, `react-testing-library`. Cross: `zod`, `typescript-expert`, `security`. (Not preloaded: `engineering-insights`, `pr-self-review`.) |
| **Input** | Feature / change request with enough success criteria |
| **Output** | English file `docs/plans/<kebab-name>.md` (canonical: goal, modules, constraints, phases, **Skill routing**, verification) + Russian summary in chat |

### Rule sources (planner)

| Practice | Source |
|----------|--------|
| Subagent file format, `description` routing, tool allow/deny, `permissionMode`, `skills` preload, focused one-task agents, chain workflows | [Claude Code: Create custom subagents](https://code.claude.com/docs/en/sub-agents) |
| When to use subagents vs skills; policy for repeated workflows | [Anthropic: How and when to use subagents](https://claude.com/blog/subagents-in-claude-code) |
| Clarify-before-work + fixed report shape | Local pattern: [researcher.md](researcher.md) |
| Module map, `INSIGHTS.md`, do-not-touch `@devdigest/shared`, per-package scripts/tests | Root [`AGENTS.md`](../../AGENTS.md), [`TESTING.md`](../../TESTING.md), [engineering-insights](../skills/engineering-insights/SKILL.md) |
| Skill routing targets | Catalog in [../skills/README.md](../skills/README.md) |
| Persist plans | [`docs/plans/`](../../docs/plans/) (planner-only; not `doc-writer`) |

---

## implementer

**Responsibility.** Implement an **approved** Development Plan in frontend and/or
backend, load skills from the plan’s Skill routing, run tests for touched
packages, self-check within implementation only. Architecture and security
review are out of scope.

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
| Tool least privilege, `acceptEdits`, no nested `Agent`, sequential hand-off from planner | [Claude Code: Create custom subagents](https://code.claude.com/docs/en/sub-agents) |
| Skills as on-demand procedures; subagent for isolated implementation context | [Anthropic: How and when to use subagents](https://claude.com/blog/subagents-in-claude-code) |
| Plan-as-contract, verification only for touched packages, no drive-by scope | Root [`AGENTS.md`](../../AGENTS.md), [`TESTING.md`](../../TESTING.md) |
| Defer architecture / security / pre-PR review / plan check / docs | [architecture-reviewer](architecture-reviewer.md), [plan-verifier](plan-verifier.md), [doc-writer](doc-writer.md), [security](../skills/security/SKILL.md), [pr-self-review](../skills/pr-self-review/SKILL.md) |
| Capture lessons after non-trivial work | [engineering-insights](../skills/engineering-insights/SKILL.md) |

---

## test-writer

**Responsibility.** Write focused UI and backend tests after implementation,
following `TESTING.md` (typological seams). Does not implement product features
or run architecture review.

| | |
|---|---|
| **Tools** | `Read`, `Grep`, `Glob`, `Bash`, `Edit`, `Write`, `Skill`, `TodoWrite` |
| **Denied** | `Agent` |
| **permissionMode** | `acceptEdits` |
| **Preloaded skills** | `react-testing-library` (on-demand: `react-best-practices`, `fastify-best-practices`, `zod`, `onion-architecture`) |
| **Input** | Plan / Implementation Report / behaviours to cover |
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
approved Development Plan (success criteria, phases, skill routing,
verification commands). Structured pass/fail with evidence — not generic
advice.

| | |
|---|---|
| **Tools** | `Read`, `Grep`, `Glob`, `Bash`, `Skill` |
| **Denied** | `Write`, `Edit`, `NotebookEdit`, `Agent` |
| **permissionMode** | `plan` |
| **Preloaded skills** | none (on-demand from plan Skill routing) |
| **Input** | Plan path `docs/plans/…` + optional Implementation Report (**Changed paths**) |
| **Output** | Plan Verification report in chat (Russian): overall + per-item table |

### Rule sources (plan-verifier)

| Practice | Source |
|----------|--------|
| Plan as executable contract / observable outcomes | [OpenAI Cookbook: Codex exec plans](https://github.com/openai/openai-cookbook/blob/main/articles/codex_exec_plans.md) |
| Binary, evidence-backed acceptance checks | [Braingrid: Acceptance criteria AI can verify](https://www.braingrid.ai/blog/how-to-write-acceptance-criteria-ai-agent-can-verify) |
| Read-mostly verifier; Bash only for verification | [Claude Code: Create custom subagents](https://code.claude.com/docs/en/sub-agents) |

---

## architecture-reviewer

**Responsibility.** Read-only architecture boundary review (Onion, frontend UI
layout, package / shared boundaries). Findings require `path:lines` evidence.
Does not rewrite code.

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
docs) with mermaid diagrams. Knows the destination map. Does not write
`INSIGHTS.md` or product code.

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
