# Spec: Onboarding Generator
Spec ID: SPEC-02
Status: draft
Supersedes: none
Packages: client, server

## Problem and user

A developer who just selected an unfamiliar repository in the studio has no first-day map of that codebase. Repo-intel can already rank files and critical import chains, a feature-model slot named `onboarding` already exists in Settings, and a structured onboarding JSON shape already exists in the shared contracts — but there is no generate/read API, no persisted tour per repo, and no studio page that turns those facts into a readable tour.

Primary user: a **new workspace member** opening the selected repository for the first time. They need a **generated, regenerable** tour they can skim in one sitting: where code lives (overview **and** nested layout), how the important **flows** move, a generated local-run briefing (not a README paste), a reading order that starts somewhere concrete, and first tasks they can pick by confidence.

`/onboarding` today is the **add-repository** form. That route stays. The tour is a different, repo-scoped screen.

## Goals / Non-goals

### Goals

- From a selected repository, **generate** a five-part onboarding tour grounded in that repo’s clone and (when present) its index facts — never invented paths or scripts.
- Persist **one** current tour per repository and show it on an **Onboarding Tour** workspace page.
- Let the user **regenerate** the tour (replace the stored one) and see when it was last generated and how large the index was.
- Let the user **copy a shareable studio URL** for the tour page (same access rules as the rest of the studio).
- Show **architecture** as both a general map of how pieces connect **and** a detailed nested layout of where code lives (so a newcomer knows where to look).
- Show **critical paths** as the key end-to-end **flows** of the application (how work moves), not a flat list of “important files”.
- Show **how to run the project** as an LLM-written briefing from code and configs: what to install, which commands to run, which environment variables are required — not a copied README.
- Show a **guided reading plan**: which file to open first and where to go next, so the reader is not lost in a large tree.
- Show **first tasks** for someone who just joined, each with complexity Low / Medium / High, so they can pick a starting task by their own confidence.

### Non-goals

- Replacing or merging with the add-repository screen at `/onboarding`.
- Public, unauthenticated tour URLs or share tokens (no anonymous internet sharing).
- Writing the tour markdown into the git clone / repo folder (Settings copy that mentions “tours are written to the repo folder”). Studio-only storage is permanent; no follow-up spec for clone export.
- GitHub (or any remote) deep-link on **Open**. Open is in-app clone preview only; no follow-up spec for remote links.
- In-app editing of generated prose (no WYSIWYG, no section-by-section regenerate).
- New MCP tools.
- Using the tour as review-prompt context (that is Project Context / skills).
- Generating tours for repositories the workspace cannot access.
- Auto-generate on repo import (user starts generation from the tour page).
- Multi-language tours (studio copy and generated text are English).
- Using README (or any single doc) as the local-run section by copying it verbatim.
- Importing the host repo’s issue tracker as first tasks.

## Clarifications

- Q: What are the five parts? A: Architecture, critical paths, how to run the project, guided reading plan, first tasks — matching the product brief (not the stale i18n line that lists “conventions & gotchas”).
- Q: Architecture — overview only, or also a nested code map? A: Both. General (how pieces connect) **and** detailed (nested layout: what lives where, how the code is organised), so a first-time reader knows where to look — e.g. the server area shown with nesting.
- Q: Critical paths — important files, or application flows? A: **Flows**. Key paths a newcomer must know (e.g. a request from UI to the database; how an agent run is started). They explain how work **moves**, not which files are merely “hot”.
- Q: Local run — paste README? A: No. LLM-generated briefing from **code and configs**: what to install, which commands, which environment variables.
- Q: Guided reading? A: An ordered plan: which file to start with, then where to go next, so the reader does not get lost in a large project.
- Q: First tasks? A: Recommended tasks for someone who just joined, to learn how the project works. Each task has complexity **Low / Medium / High** (низька / середня / висока) so the person can choose by confidence.
- Q: Public share link? A: No. Share copies the current studio tour URL. Recipients still need studio access.
- Q: Write the tour into the clone as markdown later? A: No. Studio-only storage is permanent; no follow-up spec.
- Q: GitHub deep-link on Open later, besides in-app preview? A: No. Open stays in-app clone preview only; no follow-up spec.
- Q: Run the rest of the SDD pipeline in this session? A: No — spec only for now.
- Unresolved: none

## User stories

- As a workspace member, I want an Onboarding Tour for the selected repo, so I can orient without reading the whole tree.
- As a workspace member, I want to generate the tour when none exists, so I am not looking at an empty shell.
- As a workspace member, I want to regenerate after the repo has changed, so the tour is not stale.
- As a first-time reader, I want a general architecture map and a nested “where things live” layout, so I know where to look without opening the whole tree.
- As a first-time reader, I want the key application flows (UI → persistence, how a run starts, …), so I understand how work moves through the system.
- As a first-time reader, I want generated local-run steps (install, commands, env vars) I can copy, so I can boot the project without reconstructing them from README.
- As a first-time reader, I want a numbered reading plan that starts at a concrete file and says where to go next, so I do not get lost.
- As someone who just joined, I want recommended first tasks with Low / Medium / High labels, so I can pick a starting task that matches my confidence.
- As a workspace member, I want to copy the page link, so I can send a teammate to the same tour in the studio.

## Acceptance criteria (EARS)

- AC-01: КОЛИ a workspace member opens Onboarding Tour for a selected repository, the system shall show that repository’s onboarding tour page (not the add-repository form).
- AC-02: КОЛИ no tour has been stored for that repository, the system shall show an empty state that lets the user start generation, and shall not invent sections.
- AC-03: КОЛИ the user starts generation (or regeneration) for a repository whose clone is available, the system shall produce exactly five sections in this order, with kinds `architecture`, `critical_paths`, `local_setup`, `reading_path`, `first_tasks`, and shall persist that tour as the repository’s current tour.
- AC-04: КОЛИ a stored tour exists, the system shall show the title **Onboarding for {repo-name}**, a subtitle that includes the index file count used for that generation and a relative last-generated time, and actions **Regenerate** and **Share link**.
- AC-05: КОЛИ a stored tour exists, the system shall provide in-page navigation to the five sections (Architecture overview, Critical paths, How to run locally, Guided reading path, First tasks) and shall render each section’s title and markdown body.
- AC-06: КОЛИ the `architecture` section includes a mermaid diagram string that the studio can parse, the system shall render that diagram in the Architecture overview block.
- AC-07: ЯКЩО the `architecture` diagram string is missing, empty, or not valid mermaid, ТОДІ the system shall still show the architecture body and shall not render a broken diagram placeholder.
- AC-08: КОЛИ the `architecture` section is shown, the system shall present a **general** overview of how the major pieces connect.
- AC-09: КОЛИ the `architecture` section is shown, the system shall present a **detailed nested layout** of where code lives (areas/packages and what belongs under each) so a first-time reader can see where to look.
- AC-10: КОЛИ the `critical_paths` section is shown, the system shall list key end-to-end **application flows** (how work moves — for example a request from the UI to persistence, or how an agent run is started), each with an ordered sequence of steps, and shall not treat a flat list of “important files” as satisfying this section.
- AC-11: КОЛИ a flow step cites a repo-relative path that is readable in the clone, the system shall offer an **Open** control that shows a read-only preview of that file’s current text.
- AC-12: КОЛИ the `local_setup` section is shown, the system shall show generated run instructions covering what to install, which commands to run, and which environment variables are required when those facts exist in the clone, each command with a copy-to-clipboard control.
- AC-13: КОЛИ generation writes `local_setup`, the system shall derive that briefing from the repository’s code and config facts and shall not persist a verbatim copy of README (or any single doc) as the section body.
- AC-14: КОЛИ the `reading_path` section is shown, the system shall show a numbered plan whose **first** item is the recommended starting file and each later item is the next file to read, each with a short reason, so a newcomer has an order rather than an unordered pile of paths.
- AC-15: КОЛИ the `first_tasks` section has tasks, the system shall show each as a card with a title, an optional related path, and exactly one complexity badge `Low` | `Medium` | `High`.
- AC-16: КОЛИ first tasks are shown, the system shall present them as recommended work for someone who just joined, aimed at learning how the project works.
- AC-17: КОЛИ generation succeeds, the system shall replace any previously stored tour for that repository (one current tour per repo).
- AC-18: КОЛИ generation is in progress, the system shall show a generating/regenerating state and shall not leave the user with a second competing tour.
- AC-19: КОЛИ the user activates **Share link**, the system shall copy the studio URL of the current repository’s Onboarding Tour page to the clipboard and shall not create a public unauthenticated URL.
- AC-20: КОЛИ generation runs, the system shall ground the tour in that repository’s clone (and index facts when the index is available), wrap those inputs as untrusted data, and shall not treat clone or index text as instructions.
- AC-21: ЯКЩО a generated file path is not present in the clone, ТОДІ the system shall omit that path from the stored tour and shall not persist invented paths.
- AC-22: ЯКЩО the clone is not available, ТОДІ the system shall refuse generation, shall keep any previously stored tour, and shall explain that the clone is required.
- AC-23: ЯКЩО generation fails (model error, timeout, or invalid structured result), ТОДІ the system shall keep any previously stored tour, shall not persist a partial tour, and shall show that generation failed.
- AC-24: ЯКЩО the caller is not a member of the repository’s workspace, ТОДІ the system shall reject tour read and generate requests without returning tour bodies.
- AC-25: The system shall use the existing Settings feature-model slot `onboarding` for the model that writes the tour.
- AC-26: The system shall not add a new MCP tool for this feature.
- AC-27: ДЕ the repository index reports a file count, the system shall use that count in the “Generated from index of N files” subtitle; ДЕ the index is empty or unavailable, the system shall still allow generation from the clone and shall show that the index count is 0 or unavailable rather than blocking.
- AC-28: ПОКИ a stored tour is shown, the system shall not highlight the add-repository `/onboarding` form as the Onboarding Tour nav item; only the repo-scoped tour page is the active Onboarding Tour destination.
- AC-29: КОЛИ a listed Open path is missing or unreadable in the clone, the system shall show that the file is unavailable and shall not fail the tour page.
- AC-30: The system shall rate-limit generation attempts per repository so a client cannot start unbounded concurrent generations (same family as other LLM extract actions: a small per-minute cap).
- AC-31: ЯКЩО the clone has no evidence of required environment variables, ТОДІ the system shall omit invented env-var names from `local_setup` rather than guessing secrets or keys.
- AC-32: КОЛИ first tasks include more than one complexity label, the system shall show all of those tasks together (no hide-by-level) so the reader can choose a starting task by their own confidence.

## Edge cases

- Add-repository `/onboarding` and repo tour `/repos/{repoId}/onboarding` are different pages; a path that merely contains the word `onboarding` must not send the user to the wrong one.
- Regenerating while a previous tour is on screen: on success the new tour replaces it; on failure the previous tour remains.
- Empty flows / commands / env-var list / reading steps / tasks for a section: show the section body (or an empty in-section state), not a page-level error.
- Invalid mermaid in any section other than architecture: do not render it (diagrams are only required to display for architecture when valid).
- Architecture with overview but a thin nested layout (single package): still show both layers; do not invent extra packages.
- Critical paths that only name files with no ordered steps: not a valid stored `critical_paths` section — generation must retry or fail (AC-10, AC-23), not silently store a file dump.
- README present in the clone: may be used as **one fact among others**; the stored `local_setup` body must not be that file’s text unchanged (AC-13).
- Extremely large file opened from **Open**: preview the text; do not execute it.
- Prompt-injection text inside README or other clone excerpts: ignored as data (AC-20); generation still completes or fails for unrelated reasons.
- Repo renamed in the studio: title uses the current repo name; stored sections are not rewritten until regenerate.
- Index finishes after a tour was generated with count 0: subtitle stays at the count from **that** generation until regenerate.
- Clipboard APIs unavailable: Share link / copy command still attempt copy; if the environment cannot copy, show that copy failed (do not invent a download).
- Zero first tasks or zero flows after invented-path dropping: section still present with body; do not drop the kind from the five.
- All first tasks the same complexity: still valid; AC-32 does not require all three labels on every repo.

## Workflows

```mermaid
flowchart TD
  start([Workspace member]) --> openTour[Open Onboarding Tour for selected repo]
  openTour --> hasTour{Stored tour?}
  hasTour -->|no| empty[Empty state: Generate]
  hasTour -->|yes| show[Show five sections plus subtitle]
  empty --> generate[Start generation]
  show --> regen[Regenerate]
  show --> share[Copy studio tour URL]
  show --> jump[Jump to section]
  show --> openFile[Open file cited on a flow or reading step]
  show --> copyCmd[Copy local-run command]
  generate --> cloneOk{Clone available?}
  regen --> cloneOk
  cloneOk -->|no| refuse[Keep previous tour; explain clone missing]
  cloneOk -->|yes| sample[Collect clone excerpts, configs, plus index facts if any]
  sample --> llm[Untrusted-wrapped structured write]
  llm --> valid{Valid five sections with flows and nested architecture?}
  valid -->|no| fail[Keep previous tour; show failure]
  valid -->|yes| drop[Drop links whose paths are not in the clone]
  drop --> persist[Replace stored tour]
  persist --> show
```

```mermaid
sequenceDiagram
  participant User
  participant Studio
  participant API
  participant Clone
  participant Index
  participant Model
  User->>Studio: Open Onboarding Tour
  Studio->>API: Read current tour
  API-->>Studio: Tour or empty
  User->>Studio: Generate or Regenerate
  Studio->>API: Start generation
  API->>Clone: Read excerpts and configs
  API->>Index: File count and path facts when present
  API->>Model: Structured tour from untrusted facts
  Model-->>API: Five sections
  API->>Clone: Drop paths not on disk
  API-->>Studio: Persisted tour
  User->>Studio: Share link / Open cited file / Copy command
```

## Service communication

- **Studio (web)** asks the **API** for the selected repo’s current tour and to start generation. The browser does not read the clone to build section prose.
- **API** reads excerpts, **config files**, and file existence from that repo’s **local git clone**, and index file-count / ranked-path facts from **repo-intel when available**. It calls the workspace’s **onboarding** feature-model. It stores one tour document per repository. Ranked paths are **facts for the writer**, not a substitute for the critical-paths **flows**.
- **Studio** renders markdown, mermaid, nested layout, flow steps, command lists, reading plan, and task cards. File **Open** preview is served by the **API** from the clone (same trust boundary as other clone reads).
- **MCP** is unchanged.

## Contracts

Cover each channel that applies; write `N/A` for unused channels.
Shapes only — not ORM/SQL/Zod. Mark invented names `assumption:`.

### HTTP

Existing shared shape (fact): `Onboarding` = `{ sections: OnboardingSection[] }`, each section `{ kind, title, body, diagram?, links: [{ label, path }] }`.

`assumption:` additive fields on the same document (mockup + this clarification):

- `layout` or equivalent nested structure on `architecture` (areas and children: what lives where). Overview prose stays in `body`; mermaid stays in `diagram`.
- `flows`: ordered application flows on `critical_paths`, each `{ title, steps: [{ label, path? }] }`. A list of files with no steps is not this field.
- `commands`: ordered shell command strings on `local_setup` (may be empty).
- `env_vars`: names of required environment variables on `local_setup` (only those evidenced in clone/config; may be empty — AC-31).
- `note`: short reason on a reading-plan file step (why read this next).
- `complexity`: `low` | `medium` | `high` on each first-task item (task title may be `label` or a dedicated title). Required when the task is present (AC-15).
- Envelope for the page: `{ sections, generated_at, files_indexed }` where `files_indexed` is the index count recorded at generation time (0 if none).

`assumption:` resources (names not served today):

- Read current tour for a repo (empty/null sections when none stored — not the same as repo not found).
- Generate/regenerate (POST), rate-limited, returns the new envelope or a generation failure.
- Read-only file preview for a repo-relative path on that clone (Open). Reject paths that escape the clone.

Unauthenticated or cross-workspace callers get the same rejection family as other repo routes.

### MCP

N/A — no new tool or payload field (AC-26).

### Events / status

- Read: success with a tour, or success with empty/not-generated (AC-02). Clone missing is not “empty success” for **generate** (AC-22).
- Generate in progress: studio pending state (AC-18).
- Generate failure: previous tour retained (AC-23).
- Do not reuse repo-intel `partial` / `degraded` as the tour document status. Index-unavailable is AC-27 (count 0 / unavailable in the subtitle), not a failed tour.

### Errors

- `assumption:` `not_found` — repo does not exist in the workspace.
- `assumption:` `forbidden` / unauthenticated — AC-24.
- `assumption:` `clone_unavailable` — AC-22 on generate.
- `assumption:` `generation_failed` — model/timeout/invalid structured output (AC-23).
- `assumption:` `invalid_path` — Open/preview path fails clone-boundary checks.
- Missing file on **Open**: file-unavailable outcome for that preview (AC-29), tour page stays up.

## Design & UX analysis

Designs analysed (chat attachments): Onboarding Tour — architecture + TOC; critical paths + local run + reading path; reading path + first tasks.

### Gaps vs design

- Mockup **Critical paths** is a flat file list with Open. Product clarification overrides that: this section is **application flows** (ordered steps). File Open remains only where a flow step cites a real path (AC-10, AC-11).
- Mockup **Architecture** is one prose block plus a simple diagram. Product requires **two layers**: general overview **and** a nested “where code lives” layout (AC-08, AC-09). The diagram still illustrates the general map (AC-06).
- Mockup **How to run locally** is numbered commands only. Product also requires install steps and evidenced environment variables, generated from code/configs, not a README paste (AC-12, AC-13, AC-31).
- Mockup sidebar also shows Eval Dashboard, Memory, Multi-Agent Review, Agent Performance, CI Runs. Those items are **not** this feature. Only **Onboarding Tour** is added as a Workspace destination for the selected repo. Project Context remains whatever the current studio already ships.
- Mockup **Share link** looks like a first-class share action. This spec is clipboard copy of the studio URL, not a public token page (Clarifications).
- Mockup **Open** does not specify GitHub vs in-app. Confirmed: in-app clone preview only; no remote deep-link now or later.
- Stale studio i18n (`generate.body` lists “overview, architecture, key modules, getting started, and conventions & gotchas”) disagrees with this spec. Canonical five parts are the kinds in AC-03.
- Existing `Onboarding` contract has no nested layout, flows, `commands`, `env_vars`, `note`, or `complexity`. Additive shared-contract fields are in scope as a high-risk dual-copy change.
- Add-repo `/onboarding` already steals the `onboarding-tour` nav key via a pathname substring. The tour page must be the nav target; the add-repo form must not stay highlighted as Onboarding Tour (AC-28).

### Uncovered corner cases

- No selected repo in the shell: Onboarding Tour cannot bind to a repo (same as other repo pages).
- Generate clicked twice quickly: rate limit + single in-flight pending state (AC-18, AC-30).
- Preview of a binary path: treat as unavailable text, not a download of arbitrary bytes into a markdown renderer.

### Cross-module interactions

- **Feature-model `onboarding`** already exists in Settings; this feature must **use that slot**, not add a parallel id.
- **Shared `Onboarding` / `OnboardingSection` / `OnboardingLink`**: reuse; extend additively for nested layout, flows, commands, env vars, reading notes, and task complexity.
- **Repo-intel** supplies file count and may supply ranked/critical **file** chains as **facts** to the writer. Those chains must not be shown as the Critical paths section in place of application flows (AC-10). Index off or empty must not block clone-based generation (AC-27).
- **Add-repository** route stays at `/onboarding`.
- **Project Context** is a different page (browse/attach markdown). Do not merge catalogs.
- **`@devdigest/shared`**: likely additive fields on onboarding DTOs (high risk: two vendored copies).

### UX recommendations (non-binding)

- Collapsible section cards as in the mockup.
- Architecture: general overview and mermaid first; nested layout immediately under them so “where to look” is on the same card.
- Critical paths: one card per flow, steps in order; Open only on steps that cite a file.
- Guided reading: numbered, first item visually marked as the start.
- Complexity colours: Low green, Medium orange, High red — only if those tokens already exist; otherwise reuse existing badge chrome.
- After successful first generate, scroll to Architecture overview.
- Copy/Share should confirm briefly (copied) without a modal.

## Non-functional requirements

- Generation is a **synchronous** studio action with an explicit pending state, in the same family as convention extraction (rate-limited; timeout-guarded). No background job is required for MVP.
- Rate limit: a small per-minute cap on generate per the conventions-extract family (AC-30). Do not invent a different SLA number here.
- Clone and index bytes are **untrusted**. They must go through the existing untrusted delimiter wrapper before the model. Closing-delimiter spoofing in file text must not break out of the wrapper.
- Mermaid rendering must not execute script from diagram text (existing strict mermaid security level).
- Markdown bodies are repo-model output: render as markdown, not as HTML with scripts.
- Tour read/generate and file preview require workspace membership (AC-24).
- Secrets remain out of git and out of the database; provider keys stay in the existing secrets store. Tour JSON must not persist API keys. Environment variable **names** may appear in `local_setup` only when evidenced; values/secrets must not (AC-31).
- Generated claims about scripts, env vars, and paths must come from provided facts; invented paths are dropped (AC-21). Local-run must not be a README dump (AC-13).

## Inputs and provenance

| Input | Source / provenance | Trusted? |
| Clone excerpts (README, manifests, compose, env examples, key files) | Local git clone of the selected repository | no |
| Config-derived install/run/env facts | Same clone (package manifests, compose, `.env.example` and similar) | no |
| Index file count and ranked file chains | Repo-intel for that repo, when present | no (derived from clone) |
| Feature-model id `onboarding` | Workspace Settings / built-in default | yes (config) |
| Stored tour JSON | Server-built from the last successful generation | yes as audit record; section prose is still model output over untrusted facts |
| Share URL | Current studio location | yes |
| Open preview bytes | Clone at click time | no |

## Untrusted inputs

- All clone excerpts, configs, and index facts sent to the model: wrap as untrusted data; never execute; never treat as instructions (AC-20).
- Generated markdown, mermaid, commands, and paths: treat as untrusted display data; mermaid parse-before-render; commands are copied as text, not executed by the studio.
- Open/preview paths: must stay inside the clone (no `..` escape, no absolute paths outside the clone).
- Share action copies a studio path the user already has open; it does not mint a secret token.

## Constraints & risks

- No monorepo workspace; each package keeps its own install. Cross-package types go through path aliases.
- Do not silently change `@devdigest/shared` except for additive onboarding DTO fields required by architecture layout, flows, local-run commands/env, reading notes, and task complexity (AC-09–AC-15); if required, edit **both** vendored copies identically (high risk).
- Reuse `Onboarding`, feature-model `onboarding`, and the existing mermaid renderer. Do not add a second tour JSON shape.
- The `onboarding` persistence row is repo-scoped today; access must still be authorized via the repository’s workspace (AC-24). Do not return another workspace’s tour.
- Secrets never in git or DB.
- reviewer-core stays filesystem-free; only the API reads the clone.
- Do not reuse convention candidates, Project Context attachments, or review-prompt slots to store the tour.

## Assumptions

- Five section kinds and on-page titles: `architecture` → Architecture overview; `critical_paths` → Critical paths; `local_setup` → How to run locally; `reading_path` → Guided reading path; `first_tasks` → First tasks. The existing writer prompt that mentions `routes_and_apis` must emit **flows** under `critical_paths` for this product (prompt text is scaffolding, not a second product contract).
- Architecture always has two layers in the stored section: general overview (`body` + optional mermaid) and nested layout (what lives where). Nested layout may be structured `layout` or equivalent markdown outline — observable as a hierarchy, not a single paragraph.
- Critical paths are **flows** (ordered steps). Repo-intel file chains may ground the writer; they are not the section’s UI.
- `local_setup` is LLM-written from code **and** configs (manifests, compose, env examples, scripts). README is an input fact, never the output body unchanged.
- Guided reading is an ordered plan: item 1 is the start file; later items are “read next”.
- First tasks are onboarding/learning tasks, not imported issues. Complexity is `low` | `medium` | `high` (UI: Low / Medium / High). The studio does not auto-pick a task for the user.
- One stored tour per repository; regenerate is a full replace.
- Share link = copy studio URL; no public token table.
- Open = in-app read-only preview from the clone only. No GitHub or remote deep-link, now or later.
- Tour storage is studio/API only. The generated tour is never written into the git clone, now or later.
- Language of generated titles and bodies: English.
- Generation is user-triggered, not automatic on import.
- Index facts are optional input; clone is mandatory for generate.
- HTTP resource names above are invented (`assumption:`) except the existing `Onboarding` section shape.
- Existing add-repo i18n/nav key collision is in scope to fix (AC-28).
- MCP `list_agents` is irrelevant; no agent subset.

## Open questions

- none
