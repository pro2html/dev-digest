---
name: ears-requirements
description: >
  Writes testable EARS acceptance criteria for DevDigest SDD specs. Use when
  authoring or reviewing feature specs, user stories, NFRs, or AC under
  docs/specs/; when spec-creator drafts SPEC-NN files; or when requirements
  must stay implementation-free. Covers Ukrainian EARS triggers (КОЛИ, ПОКИ,
  ЯКЩО/ТОДІ, ДЕ), English "the system shall", AC quality, US→AC mapping,
  six clarification categories, and [NEEDS CLARIFICATION]. Does NOT cover
  Implementation Plans, test code, or implementation recipes.
---

# EARS requirements (DevDigest SDD)

Write **verifiable behaviour**, not how to build it. Canonical output lives in
`docs/specs/YYYY-MM-DD-<kebab>.md` via **spec-creator**.

See [examples.md](examples.md) for good/bad AC pairs. File template:
[spec-creator.md](../../agents/spec-creator.md) and [docs/specs/README.md](../../../docs/specs/README.md).

## Language (local course convention)

| Part | Language |
|------|----------|
| Spec prose, stories, contracts, diagram labels | English |
| EARS **triggers** | Ukrainian: `КОЛИ`, `ПОКИ`, `ЯКЩО` / `ТОДІ`, `ДЕ` |
| Mandatory marker | English `shall` (not `система повинна`) |
| Chat summary (spec-creator) | Russian |

**Canonical AC** (trigger Ukrainian, body English):

```
AC-01: КОЛИ the user opens a PR whose repo index is missing, the system shall return status "degraded" with an explicit reason.
```

Do not mix `система повинна (shall)` with English bodies. Ubiquitous AC have no trigger:

```
AC-02: The system shall reject unauthenticated requests to workspace-scoped pull resources.
```

## Patterns

| Pattern | Trigger | Shape |
|---------|---------|-------|
| Ubiquitous | (none) | The system shall \<observable response\>. |
| Event-driven | `КОЛИ` | КОЛИ \<trigger\>, the system shall \<response\>. |
| State-driven | `ПОКИ` | ПОКИ \<in state\>, the system shall \<response\>. |
| Unwanted | `ЯКЩО` … `ТОДІ` | ЯКЩО \<unwanted\>, ТОДІ the system shall \<response\>. |
| Optional | `ДЕ` | ДЕ \<feature is present\>, the system shall \<response\>. |

Number every criterion `AC-01`, `AC-02`, … so tests and verifiers can map to them.

Prefer **one trigger + one observable outcome** per AC. Split compounds (`and` two behaviours) into two IDs.

## Quality bar

Each AC must be:

- **Atomic** — one behaviour
- **Observable** — a user, API client, or MCP caller can see the outcome
- **Implementation-free** — no file paths, SQL, class names, library choices, test commands
- **Unambiguous** — no «nice», «fast», «intuitive», «should», «as appropriate»

If it cannot be verified, move it to **Open questions**, a `[NEEDS CLARIFICATION]`
marker, or rewrite as a measurable NFR. Do **not** invent an observable outcome.

## Six clarification categories

`spec-creator` scans these before persisting a spec. Each is Clear / Partial /
Missing. High-impact Partial/Missing → question or marker, not a guess.

| # | Category | Must be clear |
|---|----------|----------------|
| 1 | Functional Scope & Behavior | Goals, success, non-goals, roles |
| 2 | Domain & Data Model | Entities, identity, lifecycle / states |
| 3 | Interaction & UX Flow | Critical journeys; empty / error / loading (or N/A) |
| 4 | Non-Functional Quality Attributes | Measurable NFRs, auth/privacy — or parked |
| 5 | Integration & External Dependencies | HTTP / MCP / GitHub / LLM; failure modes |
| 6 | Edge Cases & Failure Handling | Unwanted paths, conflicts, degraded / partial |

Planning-level detail (paths, libraries, phase order) is **not** a spec
clarification — leave it for **implementation-planner**.

## [NEEDS CLARIFICATION]

Never silently invent product behaviour.

- Reasonable default (this repo / brief / industry) → use it + **Assumptions**.
- Choice changes **scope, security/privacy, or UX** and no default exists →
  `[NEEDS CLARIFICATION: <specific question>]` in the spec body.
- **Maximum 3 markers.** Priority: scope > security/privacy > UX > technical.
- `implementation-planner` does not plan while any marker remains (unless the
  user explicitly overrides).

### NFRs

State a **threshold or rule**, not a vibe.

- Bad: The system shall be fast.
- Good: КОЛИ the blast map is requested for a PR with ≤ 50 changed files and a complete index, the system shall return the HTTP response within 2 seconds.

If no number is known, park it in Open questions — do not invent SLAs.

## User stories → AC

- Every user story maps to ≥ 1 AC. If a story has no AC, drop the story or add AC.
- AC may exist without a story (security, errors, degraded states).
- Do not duplicate a story verbatim as an AC — the AC is the testable shall.

## What must not appear in AC

- Folder layout, module file lists, migration SQL, Zod/Drizzle snippets
- Phase order, skill routing, `pnpm test` / typecheck commands
- Component or function names (`BlastCard`, `getBlastRadius`)

Name **resources and fields** (HTTP path, MCP tool, status enum) only at contract level; mark invented names `assumption:`.

## Unwanted vs edge cases

- **AC (unwanted / state)** — required behaviour when things go wrong (401, `degraded`, empty list).
- **Edge cases section** — extra scenarios that must not contradict AC; promote into AC when they are in-scope behaviour.

## Checklist before the spec is draft-ready

- [ ] Triggers match the table; bodies are English `the system shall`
- [ ] IDs are unique and dense (`AC-01`… no gaps in a new spec)
- [ ] Vague or compound AC rewritten or split
- [ ] Error / empty / degraded paths have AC or an explicit Non-goal
- [ ] NFRs are measurable or listed as Open questions / markers
- [ ] Six-category scan done; no silent product guesses
- [ ] At most 3 `[NEEDS CLARIFICATION: …]` markers; rest are Assumptions or Open questions
