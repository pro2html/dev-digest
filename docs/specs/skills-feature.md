# Spec: Skills for review agents

Status: draft · Flag `skills-agent-tab-dnd-reorder`: done ·
Packages: `server/`, `client/`, `reviewer-core/` (read-only) ·
One document for the whole feature.

## 1. Why

A skill is a reusable markdown instruction block mixed into a review agent's
prompt. Unlike `agents.system_prompt`, one skill can be linked to multiple
agents, toggled on/off, and versioned separately.

A skill does not execute code and has no tool access: it is configuration text
only.

## 2. What already exists in the repo

The feature is being "stitched on" — the foundation is already there:

| Layer | What exists | Where |
|---|---|---|
| DB | `skills`, `skill_versions`, `agent_skills(order)` | `server/src/db/schema/skills.ts`, `agents.ts` |
| Contracts | `Skill`, `SkillType`, `SkillSource`, `AgentSkillLink` | `server/src/vendor/shared/contracts/knowledge.ts:114-199` |
| API | `GET/POST /agents/:id/skills`, Skills CRUD `/skills` | `server/src/modules/agents/routes.ts`, `modules/skills/` |
| Prompt | `skills` slot → `## Skills / rules` section | `reviewer-core/src/prompt.ts:88,109` |
| Trace | `prompt_assembly.skills` in contract and UI | `contracts/trace.ts:39-52`, `TraceBody.tsx:74-92` |
| Injection | `run-executor` loads bodies via `skillsRepo.bodiesForAgent`, passes them into `reviewPullRequest`, logs `skills.loaded` | `server/src/modules/reviews/run-executor.ts` |
| i18n | Skills page and import copy | `client/messages/en/skills.json` |

Prompt injection is wired: enabled linked skills appear in `prompt_assembly.skills`
and in the live log as `skills.loaded`; disabled / empty sets leave both absent.

## 3. Decisions

| Question | Decision |
|---|---|
| Layout | Skills Lab is **always split** (mockup): left skill list + right editor. `/skills` redirects to the first skill (`?tab=preview`) or shows empty state. No separate card-grid landing |
| Editor tabs | Config, Preview, Stats, Versions. Evals — out of scope |
| Import | Markdown file only. No archives, URLs, or community catalog |
| `source` for import | Reuse `imported_url` ("Imported" badge), no enum migration |
| Trust | Imported skill is created with `enabled=false`, "needs vetting" badge; once enabled it enters the prompt as normal instructions, no `wrapUntrusted` |
| Per-agent toggle | New column `agent_skills.enabled` |
| Tokens | Client-side estimate `ceil(chars/4)`, contracts untouched |
| New entities | 1 agent (Test Quality Reviewer) + 4 skills |
| Body editor | `Textarea mono` + custom line-number gutter, no new dependencies |
| Stats | `Used by` and `Findings (30D)` — from DB; `Pull frequency` and `Accept rate` — not tracked |
| Skill order on an agent | Drag-and-drop in `SkillsTab`; same API (`POST /agents/:id/skills` with full `{ skill_id, order, enabled }` array). No up/down arrows. No new DnD library — HTML5 Drag and Drop API |
| Agent Skills tab chrome | Match the Skills-tab mockup: grip handle, checkbox enable, type-colored badges, dimmed disabled rows, client filter. Keep Add skill + unlink (mockup omits them; product model still needs link/unlink) |

## 4. Data model

### 4.1 Migration

One migration (`pnpm db:generate` in `server/`):

    ALTER TABLE agent_skills ADD COLUMN enabled boolean NOT NULL DEFAULT true;

No further schema changes: `skills` and `skill_versions` already exist.

### 4.2 Field semantics

- `skills.enabled` — global switch. A disabled skill never enters any prompt,
  regardless of links.
- `agent_skills.enabled` — per-agent switch.
- `agent_skills.order` — order of blocks in the prompt, starting at 0.
- A skill enters the prompt only if `skills.enabled AND agent_skills.enabled`.
- `skills.version` increments **only when `body` changes**; edits to `name`,
  `description`, `type`, `enabled` do not bump the version (`skill_versions`
  stores only `body`).
- The `skill_versions` snapshot is written in the same transaction as the
  `UPDATE`, with `onConflictDoNothing()` — same pattern as
  `agents/repository.ts:148-166`.
- Deleting a skill cascades away `agent_skills` rows; agents remain.

### 4.3 Contracts

Edit **both** copies (`server/src/vendor/shared/`, `client/src/vendor/shared/`)
identically — there is no sync script.

In `contracts/knowledge.ts`:

- `AgentSkillLink` — add `enabled: z.boolean()`.
- New `AgentSkillLinkView` = `AgentSkillLink` + `name`, `type`,
  `skill_enabled` — so the agent's Skills tab renders without N+1.
- New `SkillVersion` = `{ skill_id, version, body, created_at }`.
- New `SkillStats`:
  `{ used_by_agents: number, findings_30d: number,
     findings_by_category: Record<FindingCategory, number>,
     pull_frequency: number | null, accept_rate: number | null }`.

`SkillType`, `SkillSource` stay unchanged. `Skill` gains optional
`used_by_agents: z.number().int().nullish()` — populated on `GET /skills`
(list); may be null on create/get-one until the next list refresh.

## 5. Server

### 5.1 Module `server/src/modules/skills/`

Structure mirrors `modules/agents/` one-to-one: `routes.ts` (default export is
a Fastify plugin), `service.ts`, `repository.ts`, `helpers.ts`, `constants.ts`.

Registration: one line in `server/src/modules/index.ts` (the module is already
mentioned there as planned). Expose the repository on the DI container as
`skillsRepo` — the reviews module needs it.

All requests are scoped by `workspaceId` via `getContext()`. Errors go through
`NotFoundError`; the global handler shapes the envelope.

### 5.2 Endpoints

| Method | Path | Body / params | Response |
|---|---|---|---|
| GET | `/skills` | — | `Skill[]` |
| GET | `/skills/:id` | uuid | `Skill` |
| POST | `/skills` | `name`, `description`, `type`, `body`, `enabled?` | 201 `Skill` |
| PUT | `/skills/:id` | same fields, all optional | `Skill` |
| DELETE | `/skills/:id` | uuid | `{ ok: true }` |
| GET | `/skills/:id/versions` | uuid | `SkillVersion[]`, newest first |
| GET | `/skills/:id/versions/:version` | uuid + int | `SkillVersion` |
| GET | `/skills/:id/stats` | uuid | `SkillStats` |
| POST | `/skills/import` | `{ name?, description?, type?, body }` | 201 `Skill` |

`POST /skills` rules: `source: 'manual'`, `enabled` defaults to `true`.

`POST /skills/import` rules:

- `source: 'imported_url'`, `enabled: false` **always** — vetting is required;
- `body` — string, `min(1).max(200_000)` (global `bodyLimit` 1 MB);
- `name` optional: if empty, take text from the first `# heading`, else
  `imported-skill`;
- `type` defaults to `custom`;
- content is stored as-is; nothing is parsed or executed.

Responses are not serialized through Zod schemas (same as agents) — return DTOs.

### 5.3 Stats: how we compute them

- `used_by_agents` — `COUNT(*) FROM agent_skills WHERE skill_id = $1`.
- `findings_30d` and `findings_by_category` — findings from the last 30 days
  on runs of agents that have this skill linked and enabled. Attribution is
  approximate (agent-level, not skill-level) — document that with a comment in
  `repository.ts` so it can later be replaced by a `skill_usage` table.
- `pull_frequency` and `accept_rate` — `null` + `// TODO(skills-telemetry)`.
  UI shows `—`. Telemetry for "skill entered the prompt" / "suggestion accepted"
  is not collected; that is a separate task.

### 5.4 Changes in the agents module

- `GET /agents/:id/skills` returns `AgentSkillLinkView[]`, sorted by `order`.
- `POST /agents/:id/skills` — extend `SetSkillsBody` to
  `{ skills: [{ skill_id, order, enabled }] }` as the canonical form
  (keep existing `skill_ids` / `skill_id` for compatibility).
- `PATCH /agents/:id/skills/:skillId` — toggle link `enabled`.
- `DELETE /agents/:id/skills/:skillId` — unlink; `repository.unlinkSkill()`
  already exists, the route does not.
- Link edits **do not bump** `agents.version` — keep current behavior.

## 6. Prompt injection and trace

This is the core of the feature. `reviewer-core` is **not** changed.

In `server/src/modules/reviews/run-executor.ts`, before calling
`reviewPullRequest`:

1. Load skill bodies: `skillsRepo.bodiesForAgent(agentId)` →
   `SELECT s.name, s.body FROM agent_skills l JOIN skills s ON s.id = l.skill_id
   WHERE l.agent_id = $1 AND l.enabled AND s.enabled ORDER BY l.order ASC`.
2. Prefix each body with `### <name>` so the trace block is readable per skill.
   Concatenation into one block is already done in `assemblePrompt`.
3. Pass `...(bodies.length ? { skills: bodies } : {})` into
   `reviewPullRequest`. Do not pass an empty array — the section must be absent
   (reviewer-core convention: a missing slot is not rendered).
4. Log a `runLog` event: `skills.loaded` with `{ count, names }` — so the live
   log shows which skills were pulled in.
5. On the fallback path `traceFromBuffer()` (`run-executor.ts:435`), also set
   `skills`, otherwise the block is lost on failure.

After that, `prompt_assembly.skills` stops being `null`, and the existing
`PromptBlock` in `TraceBody.tsx` renders the "Skills" block with no UI changes.

In the client `TraceBody`, add a `~N tokens` estimate next to the block label
(`ceil(text.length / 4)`) — same for all blocks, so added tokens are visible
when comparing runs.

## 7. Client

### 7.1 Navigation

In `client/src/vendor/ui/nav.ts` (vendored file — intentional edit) add a
`SKILLS LAB` section, move `Agents` into it, and add `Skills`
(`href: "/skills"`, icon `Sparkles`, `gKey: "s"`). Mockup items that have no
routes (Conventions, Eval Dashboard, Multi-Agent Review, Agent Performance,
CI Runs, Memory, Project Context) are **not** added — that would create dead
links. `activeKeyFor()` already understands `/skills`.

### 7.2 Layout: always-split Skills Lab (mockup)

Skills Lab matches the design mockups: **list + detail always**, not a
separate grid landing (unlike `/agents`).

**`/skills`.** Client page: while skills load, show a skeleton shell; if the
list is empty — empty state + Create/Import entry points (reuse
`SkillsListView` empty chrome or equivalent); if the list is non-empty —
`router.replace('/skills/:firstId?tab=preview')` so the user lands on the
split editor with the Preview tab (side preview from the requirements).

**`/skills/:id` — primary UI.** Container `height: calc(100vh - 52px)`, left
column `width: 280`, `flexShrink: 0`, `borderRight: 1px solid var(--border)`,
`background: var(--bg-surface)` — "Skills" heading, `Add Skill` dropdown
(Create / Import from file), client search (`Search skills…`), scrollable
`SkillCard` list with `active={s.id === id}`. Selecting a card navigates to
`/skills/:id?tab=preview` (default side view is Preview). Switching cards
while already on an editor tab may keep the current `?tab=`. Right side:
header (icon, name, type badge, version `v{n}`, disabled `Run on evals` with
title "Coming soon") and tab body. `VALID_TABS = ["config", "preview",
"stats", "versions"]`; missing/invalid `?tab=` collapses to **`preview`**.
Breadcrumbs: `Skills Lab / Skills / <name>`. Create/Import flows may land on
`?tab=config` so the author can edit/vet immediately.

Folder structure:

    client/src/app/skills/
    ├── page.tsx                       # redirect to first skill or empty state
    ├── _components/
    │   ├── SkillCard/                 # left-rail card
    │   ├── skillTypeBadge.ts          # shared SkillType → badge colors
    │   ├── SkillsListView/            # empty-state / redirect helper chrome
    │   │   └── _components/ImportSkillDrawer/
    │   └── SkillBodyEditor/           # textarea + gutter + token count
    └── [id]/
        ├── page.tsx                   # "use client": split pane, ?tab= in URL
        └── _components/SkillEditor/
            └── _components/{ConfigTab,PreviewTab,StatsTab,VersionsTab}/

`SkillCard` — left-rail card: `active?`, `onClick`, `onToggle`. Contents:
icon, monospace name, `enabled` toggle, delete button, two-line description,
**type badge colored by `SkillType`** (same map as agent Skills tab:
rubric/accent, convention/ok, security/crit, custom/muted), source badge
(`Manual` / `Imported` / `Extracted` / `Community`), metrics line
`{used_by_agents} agents · —% pull · —% accept`. `GET /skills` includes
`used_by_agents` (count of `agent_skills` rows) on each skill so cards do not
N+1 stats. For `source != 'manual'` when `enabled=false` — "needs vetting"
badge with title "Untrusted source — vet before enabling".

### 7.3 Editor tabs

**Config** — form: `Name` (required), `Description`, `Type` (select over
`SkillType`), `Skill body` (`SkillBodyEditor`). Caption under description is
directive, from the requirements: the description is the skill's interface;
the agent uses it to decide whether to pull the skill in. Tab header: version
badge `v{version}`, `Enabled` toggle, `Save` button. While the form is dirty —
`unsaved` badge next to the file name and an active `Save`; on success — toast
and dirty reset.

**Preview** — heading "Rendered as the reviewing agent receives it", render
`body` via the `Markdown` primitive (`@devdigest/ui`) inside a card.

**Stats** — four `MetricCard`s (`Used by`, `Pull frequency`, `Accept rate`,
`Findings (30D)`), "Agents using this skill" list linking to `/agents/:id`,
and a `Findings by category` donut. Note: show `Donut` with a **count**
formatter, not currency — dollar labels on the mockup are a prototype
artifact. For `null` metrics — `—` and title "Not tracked yet".

**Versions** — version list from `GET /skills/:id/versions`, number and date,
expand body in `Markdown`. Read-only; no rollback in this scope.

### 7.4 SkillBodyEditor

No new dependencies: `Textarea mono` + absolutely positioned line-number
gutter synced via `scrollTop`. Above the field — `<slug>.md` chip, `unsaved`
badge, `~N tokens` on the right (`ceil(value.length / 4)`, recomputed on every
keystroke).

### 7.5 Import

`Add Skill` button — dropdown: `Create skill` (modal like `CreateAgentModal`)
and `Import from file` (drawer).

Import drawer:

1. `<input type="file" accept=".md,.markdown,text/markdown">`. Any other
   extension or MIME — inline error "Only .md files are supported", no request
   is sent. Archives are not accepted; there is no unpacking code.
2. File is read in the browser (`file.text()`), name prefilled from the first
   `# heading`.
3. Preview screen: name, type, `Markdown` render of the body, trust warning —
   a third-party skill is third-party instructions in the agent prompt; it will
   be created disabled.
4. Only the `Import skill` button sends `POST /skills/import`. Nothing is
   written to the DB before confirmation.
5. Success: toast, navigate to `/skills/:id`, skill appears disabled and marked
   "needs vetting".

### 7.6 Skills tab in the agent editor

In `client/src/app/agents/[id]/_components/AgentEditor/constants.ts` add a
`skills` tab (i18n key `editor.tabs.skills` already exists) and include it in
`VALID_TABS` on `agents/[id]/page.tsx`.

Visual target: the agent Skills-tab mockup (grip + checkbox rows, filter,
"Order matters…" hint). The list is **linked skills only** (not the full
workspace catalog). Add skill and unlink stay in the product UI even though
the mockup omits them — linking and enabling are separate concerns.

#### Header

- Left: title `Skills`, then `{n} of {total} enabled` in accent color
  (`n` = link-enabled count, `total` = linked count; not affected by filter).
- Right: client filter input (`agents.skills.filterPlaceholder` =
  `Filter skills…`) matching name (case-insensitive), then `Add skill`
  dropdown of unlinked workspace skills.
- Below: hint copy exactly —
  `Order matters — earlier skills appear earlier in the assembled prompt. Drag to reorder.`

#### Row anatomy (left → right)

1. Drag handle — six-dot grip (`GripVertical` in the icon registry), muted.
2. `Checkbox` (not `Toggle`) for `agent_skills.enabled` — instant `PATCH`.
3. Skill name — monospace, `var(--text-primary)` when enabled; still a link to
   `/skills/:id` but styled as plain text (no accent-link look). Set
   `draggable={false}` on the anchor so nested drag does not fight the row.
4. Type badge on the right — colored by `SkillType`:

   | Type | color | bg |
   |---|---|---|
   | `rubric` | `var(--accent)` | `var(--accent-bg)` |
   | `convention` | `var(--ok)` | `var(--ok-bg)` |
   | `security` | `var(--crit)` | `var(--crit-bg)` |
   | `custom` | `var(--text-secondary)` | `var(--info-bg)` |

5. Unlink (ghost trash) — keep for product; not shown on the mockup.
6. If `skill_enabled === false`, keep the `globally off` warn badge.

Disabled link (`enabled === false`): whole row at ~0.55 opacity (name + badge
dimmed). Filter is client-side over the linked list; DnD maps drop indices
through `skill_id` back onto the full ordered array.

#### Order via drag-and-drop (required)

Up/down arrows are **not used** — they are awkward with more than two skills.

Behavior:

- Every list row is `draggable`; the grip handle is the primary affordance;
  the whole row is also draggable.
- During drag: highlight the drop target, `cursor: grabbing`.
- On `drop` — reorder and call `useSetAgentSkills` /
  `POST /agents/:id/skills` once with the full list and recomputed
  `order` (0..n-1). There is no partial PATCH for order.
- While the mutation is `isPending` — new drag is blocked.
- Keyboard a11y: `Alt+↑` / `Alt+↓` on the focused row moves neighbors via the
  same API call (not mentioned in the visible hint).
- Do **not** add `@dnd-kit` / `react-beautiful-dnd` — use HTML5 Drag and Drop
  (`draggable`, `onDragStart` / `onDragOver` / `onDrop`). Extract helper
  `reorderLinks(links, from, to)` next to the component for unit tests.

### 7.7 Data and i18n

`client/src/lib/hooks/skills.ts`, re-exported from `lib/hooks/index.ts`:
`useSkills`, `useSkill`, `useSkillVersions`, `useSkillStats`, `useCreateSkill`,
`useUpdateSkill`, `useDeleteSkill`, `useImportSkill`; keys `["skills"]`,
`["skill", id]`, `["skill-versions", id]`, `["skill-stats", id]`. Mutations
invalidate the list and `setQueryData(["skill", id])`. In
`lib/hooks/agents.ts` — `useAgentSkills`, `useSetAgentSkills`,
`useToggleAgentSkill`, `useUnlinkAgentSkill`.

Components do not call `fetch` directly — only via `lib/api.ts`.

`client/messages/en/skills.json` already has `page`, `detail`, `drawer`,
`file`, `listItem`, `preview`. Add an `editor` branch (tab labels, `unsaved`,
`tokens`, form fields, Stats and Versions copy) and `page.subtitle` for the
grid header. Leave `url` and `community` branches untouched — they are for
future import sources.

## 8. Seed: agent and skills

New agent **Test Quality Reviewer** — reviews test quality: uncovered branches,
missed corner cases, over-mocking, flakiness. Prompt source lives in
`docs/agent-prompts/test-quality-reviewer.md` following
`docs/agent-prompts/README.md` (role, what to look for, severity rubric,
verdict semantics, findings discipline); the body is duplicated in
`server/src/db/seed-prompts.ts` and inserted idempotently from `seed.ts`.

Four skills:

| Skill | Type | How created | Link |
|---|---|---|---|
| `test-coverage-nudge` | custom | seed (`manual`) | Test Quality Reviewer |
| `test-corner-cases` | rubric | seed (`manual`) | Test Quality Reviewer |
| `pr-quality-rubric` | rubric | seed (`manual`) | Test Quality Reviewer |
| `api-contract-breaking-change` | convention | **UI import** from `docs/sample-skills/api-contract-breaking-change.md` | General Reviewer (after vetting and enabling) |

Place the import file in `docs/sample-skills/` ahead of time — that is the
demo of the full import path, including preview and vetting. The folder is
intentionally not `docs/skills/`, to avoid confusion with `.claude/skills/` —
working agent skills inside this repo.

Note: seed inserts the agent directly, bypassing the repository, so
`agent_versions` rows do not appear until the agent is edited via the API.
That is existing behavior; do not change it for this feature.

## 9. Control experiment

Both scenarios are run as before/after by toggling `agent_skills.enabled`,
without editing prompts.

**Test Quality.** PR with a happy-path-only test. Run 1: all skills disabled on
Test Quality Reviewer — expect a miss. Run 2: skills enabled — expect findings
about an uncovered branch and a corner case.

**API Contract.** PR that changes a route signature. Run 1: General Reviewer
without `api-contract-breaking-change` — miss. Run 2: skill enabled — breaking
change found.

In both cases open the run trace → `Prompt assembly`: the second run has a
`Skills` block, and total `tokens_in` is higher by roughly the block size.

Record the scenario and expected findings in `docs/experiments/skills-ab.md`.

## 10. Tests

Server (`server/test/`, vitest + Testcontainers, gated by `dockerAvailable()`):

- `skills.it.test.ts` — CRUD, workspace isolation, version bump only on `body`
  change, snapshot in `skill_versions`, import creates `enabled=false` and
  `source='imported_url'`, reject empty body.
- `agent-skills.it.test.ts` — link, order, toggle `PATCH`, unlink, cascade on
  skill delete.
- `run-executor` — unit on the resolve helper: returns only pairs that are
  globally enabled + agent-enabled, in `order`; a disabled skill does not
  appear in `prompt_assembly.skills`; with zero skills the slot is `null`.

Client (`client/`, vitest + RTL, fetch mocked): `SkillCard` (type colors,
`used_by_agents` metrics), `SkillsListView` (redirect to split `?tab=preview`
or empty state), `SkillEditor` (tab switching via `?tab=`, dirty/unsaved),
`ImportSkillDrawer` (reject non-md, preview before save, import only on
confirm), agent editor `SkillsTab` (checkbox, unlink, drag-and-drop reorder →
`useSetAgentSkills` with new `order`; filter; unit on helpers `reorderLinks` /
`filterLinkedSkills` + drop via `fireEvent`).

## 11. Acceptance criteria

1. A skill can be created and edited in the UI; changing the body bumps the
   version, visible on the Versions tab. Skills Lab is always-split; selecting
   a skill opens the Preview tab; cards show type colors and `N agents`.
2. Test Quality Reviewer has its skills linked; General Reviewer has the
   imported `api-contract-breaking-change`.
3. An enabled skill appears in the trace as a separate `Skills` block and in
   the live log as `skills.loaded`; a disabled one appears in neither.
4. Import went through the preview screen; only `.md` is accepted; nothing
   executable was run; there is no archive unpacking in the codebase.
5. The control experiment reproduces on both scenarios; the `tokens_in`
   difference between runs is visible.
6. `pr-self-review` exists with auto-invoke off
   (`.claude/skills/pr-self-review/`), was invoked manually, and pulled in both
   frontend and backend skills. This checks repo tooling, not product code.
7. On the agent's Skills tab, order is changed via drag-and-drop; there are no
   up/down arrows in the UI; after drop, prompt order matches the list.

## 12. Out of scope

URL import, community skill catalog, archives, Evals tab and a working
"Run on evals" button, server-side token counts per prompt slot, real
`pull frequency` / `accept rate` telemetry, rollback to a previous skill
version, auto-extracting skills from the codebase (`source: 'extracted'`).

## 13. Risks

- **Duplicated contracts.** `vendor/shared` is copied in `server/` and
  `client/` with no sync. Drift breaks types silently.
- **Vendored `nav.ts` edit.** The file is marked vendored; the change may
  conflict with a design-system update from the course.
- **Approximate skill attribution for findings** on the Stats tab. The
  "Findings (30D)" number is really about agents that use the skill. Replace
  with a `skill_usage` table when precision is needed.
- **Instruction injection.** An imported skill, once enabled, enters the prompt
  as trusted text. The only guard is default `enabled=false` and manual
  vetting. Call this out in the demo video.

## 14. Implementation flag: DnD reorder in SkillsTab

| Field | Value |
|---|---|
| ID | `skills-agent-tab-dnd-reorder` |
| Status | `done` |
| Package | `client/` |
| Scope | `SkillsTab` UI + i18n + tests only; do not touch API/contracts |
| Entry point | `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/SkillsTab.tsx` |
| API | already exists: `useSetAgentSkills` → `POST /agents/:id/skills` |
| Blockers | none |
| Done when | no arrows; DnD changes order; reorder test green; `orderHint` is current |

Checklist:

- [x] Remove `ArrowUp` / `ArrowDown` and `move(index, delta)`
- [x] Add HTML5 DnD + visual grip handle (`GripVertical`)
- [x] On drop call existing `setSkills.mutate` with the full array
- [x] Match mockup chrome: filter, checkbox, type-colored badges, dimmed rows
- [x] Keep Add skill + unlink (mockup omits them; product still needs them)
- [x] Update `client/messages/en/agents.json` → `skills.orderHint` (mockup copy)
- [x] Update `SkillsTab.test.tsx` for DnD / filter / checkbox
- [x] Remove the `no drag-n-drop` comment in `SkillsTab.tsx`
