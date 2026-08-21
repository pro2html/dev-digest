# client/ — insights

Lessons learned and gotchas discovered while working in this package, that
aren't obvious from the code or the README. Append as they come up; keep each
entry short (what happened, what to do instead).

## 2026-07-31 — Context

**Insight:** `@devdigest/ui` already exports canonical severity/category visual tokens — `SEV` (severity → color/icon/label) and `CAT` (category → icon/label) from `primitives/tokens.ts`, plus ready-made `SeverityBadge`, `CategoryTag`, and `ConfidenceNum` primitives (used by `FindingCard`). The canonical CRITICAL icon is `AlertOctagon`, not `AlertCircle`/`XCircle`.

**Why it matters:** At least two other findings-related components (`FindingCard/constants.ts` and `RunTraceDrawer/_components/FindingsSection/FindingsSection.tsx`) each independently re-declare their own local `SEV_COLOR` map instead of importing `SEV` — easy to miss and re-duplicate (potentially with an inconsistent icon/color choice) when building any new findings UI.

**Evidence:** `client/src/vendor/ui/primitives/tokens.ts:6-14` (`SEV`/`CAT` definitions, `CRITICAL: { icon: "AlertOctagon", ... }`), `client/src/vendor/ui/primitives/index.ts:1-2` (both exported from the `@devdigest/ui` barrel).

**Action:** For any new severity- or category-colored UI, import `SEV`/`CAT` (or the `SeverityBadge`/`CategoryTag`/`ConfidenceNum` primitives) from `@devdigest/ui` rather than re-declaring severity colors/icons locally.

## 2026-08-01 — Recurring Error & Fix

**Insight:** jsdom’s `File` often lacks `File.prototype.text()`. Calling `file.text()` in import/upload handlers fails in Vitest even when the same code works in a real browser.

**Why it matters:** Import drawers and any client file-read path will pass in the browser but throw `TypeError: file.text is not a function` under `pnpm test`, producing flaky or false-failing RTL tests.

**Evidence:** Confirmed by `ImportSkillDrawer` test failure; fixed via `readFileText()` in `client/src/app/skills/_components/SkillBodyEditor/helpers.ts` (prefer `file.text()`, else `FileReader.readAsText`).

**Action:** Never call `file.text()` alone in client code meant to run under Vitest/jsdom — use a small helper with a `FileReader` fallback (see `readFileText`).

## 2026-08-01 — Pattern

**Insight:** List views wrapped in `AppShell` cannot be RTL-tested by mocking only `useRouter` — `AppShell` also needs `usePathname` / shell i18n. The durable pattern is to mock `components/app-shell` as a passthrough `<div>{children}</div>` (same idea as mocking data hooks for editor smoke tests).

**Why it matters:** Without the AppShell mock, Skills/Agents-style list tests fail with `No "usePathname" export` or a flood of `MISSING_MESSAGE: shell.*` errors even when the feature under test is fine.

**Evidence:** `client/src/app/skills/_components/SkillsListView/SkillsListView.test.tsx` — `vi.mock("../../../../components/app-shell", …)` plus a minimal `next/navigation` mock.

**Action:** For any new `AppShell`-wrapped list/detail smoke test, mock AppShell as a passthrough first; only expand navigation/i18n mocks if the test actually asserts shell chrome.

## 2026-08-01 — Context

**Insight:** Vendored `Donut` defaults to a currency legend (`valuePrefix="$"` + `toFixed(2)`). Count charts (e.g. findings-by-category) must pass `valuePrefix=""` and `formatValue={(n) => String(n)}` — otherwise the UI shows dollar amounts even when the data are integers.

**Why it matters:** The Skills Stats mockup used dollar labels as a prototype artifact; copying `<Donut segments={…} />` without formatters silently ships the wrong unit.

**Evidence:** `client/src/vendor/ui/charts/Donut.tsx` (`valuePrefix` / `formatValue` defaults), `client/src/app/skills/[id]/_components/SkillEditor/_components/StatsTab/StatsTab.tsx` (count formatter call site).

**Action:** For non-currency Donuts, always override both `valuePrefix` and `formatValue`; do not assume an empty prefix alone is enough (default still formats two decimals).

## 2026-08-01 — Recurring Error & Fix

**Insight:** `vi.mock("…/lib/hooks/…")` must use the **same relative path string as the component under test imports**, not a path computed from the test file’s directory depth. When the test sits one folder deeper than the component, a test-relative `../../../../…` fails to intercept and the real hook runs (QueryClient missing).

**Why it matters:** Nested `_components/Foo/Foo.test.tsx` next to `Foo.tsx` that imports `../../../../../lib/hooks/X` needs that exact specifier in `vi.mock`, even if counting `../` from the test file would suggest one more level.

**Evidence:** `SkillsTab.test.tsx` initially mocked an 8-level path; Vitest still loaded real `useAgentSkills` until the mock matched `SkillsTab.tsx`’s 7-level import.

**Action:** Copy the import path from the SUT file into `vi.mock(...)`; do not recount `../` from the test file.

## 2026-08-02 — Recurring Error & Fix

**Insight:** React warns when a style object mixes the `border` shorthand with a longhand override like `borderColor` during rerender (e.g. drag-over highlight). Split the base style into `borderWidth` / `borderStyle` / `borderColor` so drop-target state can safely change only `borderColor`.

**Why it matters:** DnD (and any hover/selected row) that toggles `borderColor` on top of `border: "1px solid …"` spam the console and can drop the border inconsistently.

**Evidence:** `SkillsTab` drag-over stderr during `SkillsTab.test.tsx`; fixed in `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/styles.ts`.

**Action:** Prefer longhand border properties whenever a state style will override one side of the border.

## 2026-08-03 — Pattern

**Insight:** `useConventionSkillDraft` is a `useMutation` (not `useQuery`) even though it only fetches data, because its input is a variable-length array of IDs passed as a request body. This matches the codebase convention of never stuffing arrays into query-string parameters.

**Why it matters:** Using `useQuery` with an array key would work technically but requires serializing IDs into a URL (which has length limits, cache-key instability, and violates the existing pattern). Treating it as a mutation avoids stale-cache issues and aligns with how other "fetch with complex input" hooks work in this codebase.

**Evidence:** `client/src/lib/hooks/conventions.ts:55-61` (`useConventionSkillDraft` as mutation with body `{ ids }`), spec §7.6 ("mutation rather than a query because the id list is a body").

**Action:** When a hook needs to fetch data using a payload that doesn't fit in a clean query key (arrays, nested objects), use `useMutation` + explicit body rather than forcing it into `useQuery` with a serialized key.

## 2026-08-06 — Recurring Error & Fix

**Insight:** On Conventions cards, clicking the active **Accepted** button must PATCH `status: "pending"` (unaccept), not `"rejected"`. Reject is a separate ghost action. Also, `@devdigest/ui` `IconName` exposes the pencil as `"Edit"` (aliased to lucide `Pencil`) — `"Pencil"` fails typecheck even though `Icon.Edit` renders a pencil.

**Why it matters:** Wiring Accepted → reject silently corrupts the selection model ("Accepted is the selection") and disables Create skill after a double-click. Using `icon="Pencil"` on `IconBtn`/`Button` is a compile error.

**Evidence:** Spec §7.3; `client/src/vendor/ui/icons.tsx` (`Edit: Pencil`); fixed in `ConventionCard.tsx` via separate `onAccept` / `onUnaccept` / `onReject`.

**Action:** Treat Accept as a toggle (accepted ↔ pending); keep Reject distinct. Prefer `icon="Edit"` for pencil affordances.

## 2026-08-07 — Context

**Insight:** Settings Models UI does **not** read `FEATURE_MODELS` from vendored `@devdigest/shared` at runtime — `client/src/lib/feature-models.ts` is a third, client-only mirror (webpack can't resolve shared's `.js` re-exports). Changing `review_intent` defaults in both `vendor/shared/contracts/platform.ts` copies is not enough for the Settings picker defaults.

**Why it matters:** Editing only the shared contracts leaves Settings still advertising `openai`/`gpt-4.1` for Intent until the local mirror is updated.

**Evidence:** Comment in `client/src/lib/feature-models.ts`; Intent Layer default change required three places (server vendor, client vendor, `lib/feature-models.ts`).

**Action:** When changing any `FEATURE_MODELS` default/label, sync server vendor + client vendor **and** `client/src/lib/feature-models.ts` in the same change.

## 2026-08-07 — Pattern

**Insight:** `SmartDiff` / `SmartDiffFile` carry paths, +/- counts, and `finding_lines` only — no `patch` and no severity. The Files tab joins `pr.files` by path for patch text, and joins newest-review findings from `usePrReviews` (`file` + `start_line` + `severity`) for colored markers. Invalidate `["smart-diff", prId]` alongside `["reviews", prId]` on run done.

**Why it matters:** Inventing `pseudocode_summary` or stuffing severity into the Smart Diff contract would force a shared-contract edit (dual vendor copies) or an LLM. Forgetting the query invalidation leaves badges empty until a full reload after Run Review.

**Evidence:** `client/.../SmartDiffViewer/SmartDiffViewer.tsx` (path join + severity map); `client/src/lib/hooks/smart-diff.ts`; `client/.../page.tsx` invalidates `["smart-diff", prId]` in `onRunDone`.

**Action:** Keep patch/severity joins on the client; leave `pseudocode_summary` null/hidden unless a later lesson populates it.

## 2026-08-07 — Pattern

**Insight:** Smart Diff route features must import `FileCard` / `AUTO_EXPAND_MAX_LINES` / finding types only from `@/components/diff-viewer` (barrel). Path joins for patch + severity use the same `normalizePath` as the server classifier (POSIX slashes, strip `./` and leading `/`), living in colocated `SmartDiffViewer/helpers.ts` — not in the React component file.

**Why it matters:** Deep-importing `FileCard`/`constants`/`findings` couples the PR page to internal layout of `diff-viewer`. Raw `f.file` / `smartFile.path` keys can miss markers when GitHub and importer disagree on `./` or slashes.

**Evidence:** Architecture review A1–A3 on Smart Diff; `client/src/components/diff-viewer/index.ts`; `SmartDiffViewer/helpers.ts` mirrors `server/.../smart-diff/classifier.ts` `normalizePath`.

**Action:** Extend the diff-viewer barrel when a route needs more of its surface; keep path-identity helpers pure and colocated (or shared only if a plan explicitly allows touching contracts).

## 2026-08-07 — Pattern

**Insight:** Inline finding affordances on Files changed are **word-links** (`suggestion` / `warning` / `blocker`) on the right of the finding's first line — not severity dots. Click sets `?tab=findings&finding=<id>` and scrolls to `[data-finding-id]`. Multiple findings on the same line must all render (`markersByLine` keeps an array; do not collapse to worst-only).

**Why it matters:** Collapsing markers hid co-located findings; scrolling only inside the diff missed the mentor UX (jump to Agent runs). CRITICAL is labeled **blocker** in the diff (mockup), while `SEV.CRITICAL.label` stays "Critical" elsewhere.

**Evidence:** `diff-viewer/findings.ts` (`findingLinkLabel`, `markersByLine`); `CodeLine.tsx`; `page.tsx` `openFinding`; `FindingsTab` / `ReviewRunAccordion` deep-link open + scroll.

**Action:** Always pass `id` on `DiffFindingMarker` from review records; wire `onOpenFinding` from the PR page through DiffTab / SmartDiffViewer / DiffViewer.

## 2026-08-14 — Decision

**Insight:** `@devdigest/ui` `Drawer` is `aria-modal` with a full-screen dimming overlay — it looks like a modal even though it slides from the right. Project-context file preview is a non-modal fixed `aside` (`position: fixed; right: 0`, no overlay) in `ContextAttach/PreviewSidebar.tsx`, not `Modal` and not `Drawer`.

**Why it matters:** Using `Drawer` for “sidebar preview” still traps focus and greys out the agent/skill editor, which contradicts the Context-tab mockup (list stays interactive, preview is a fourth column).

**Evidence:** `client/src/vendor/ui/kit/Drawer.tsx` (`aria-modal="true"` + overlay); `client/src/components/ContextAttach/PreviewSidebar.tsx:25` (`<aside>` without overlay).

**Action:** For right-hand previews that must leave the rest of the page usable, copy the PreviewSidebar pattern (fixed aside + Escape). Reserve `Drawer` for blocking slide-overs (Run Trace, import).

## 2026-08-14 — Decision

**Insight:** `@devdigest/ui` `Markdown` is compact inline GFM (only `p` / `strong` / `code` / `a`). Combined with the global heading reset and Tailwind preflight (headings inherit size/weight, lists lose bullets and padding), a full spec/docs file looks like one undifferentiated blob. Document previews use `MarkdownDoc` (`.dd-md-doc`), not that primitive.

**Why it matters:** Restyling vendor `Markdown` would also blow up FindingCard / CommentCard / skill Preview with GitHub-sized H1s. The two surfaces are different on purpose.

**Evidence:** `client/src/vendor/ui/primitives/Markdown.tsx:5-13` (inline-only components); `client/src/vendor/ui/styles.css:205-211` (`h1–h4, p { margin: 0 }`); `client/src/components/MarkdownDoc/MarkdownDoc.tsx:7-12`; used by `FilePreview.tsx` and `PreviewSidebar.tsx`.

**Action:** Keep vendor `Markdown` for compact cards. For a full-file Project Context preview, import `MarkdownDoc` from `@/components/MarkdownDoc`.

## 2026-08-14 — Recurring Error & Fix

**Insight:** `activeKeyFor` must not treat every pathname containing `/onboarding` as the Onboarding Tour nav item. Add-repository lives at `/onboarding`; the tour is only `/repos/:repoId/onboarding`.

**Why it matters:** A substring check highlights Onboarding Tour while the user is on the add-repo form (AC-28) and sends g-nav to the wrong page.

**Evidence:** `client/src/components/app-shell/helpers.ts:29` (`/^\/repos\/[^/]+\/onboarding(?:\/|$)/`); `client/src/components/app-shell/helpers.test.ts` (add-repo `/onboarding` → `""`).

**Action:** Match the repo-scoped tour with a path regex (or `startsWith("/repos/")` + segment check). Leave `/onboarding` unmatched so it is not `onboarding-tour`.

## 2026-08-14 — Decision

**Insight:** Onboarding Tour **Open** is a non-modal fixed aside like Project Context, but the body is `<pre>`/monospace source — not `MarkdownDoc`. Cited files are clone source (TS, env examples, compose), not specs/docs markdown.

**Why it matters:** Rendering those files through `MarkdownDoc` would mangle source and still skip binaries poorly. `Drawer` would modal-trap the tour page (see the 2026-08-14 PreviewSidebar insight).

**Evidence:** `client/src/app/repos/[repoId]/onboarding/_components/OnboardingView/FilePreviewSidebar.tsx:25,48` (`<aside>` + `<pre>`).

**Action:** Copy the PreviewSidebar chrome (fixed aside + Escape). Use `MarkdownDoc` only for Project Context markdown; use `<pre>` for onboarding clone preview.

## 2026-08-14 — Recurring Error & Fix

**Insight:** jsdom has no `IntersectionObserver`. A scroll-spy TOC that constructs it in `useEffect` will throw during RTL render even when the test never asserts the spy.

**Why it matters:** The Onboarding Tour “ON THIS PAGE” nav is mounted whenever a stored tour is shown; every existing view test failed with `IntersectionObserver is not defined` until the effect bailed out.

**Evidence:** `client/src/app/repos/[repoId]/onboarding/_components/OnboardingView/PageToc.tsx:21` (`typeof IntersectionObserver === "undefined"` guard); Vitest jsdom run of `OnboardingView.test.tsx`.

**Action:** Guard `new IntersectionObserver` (click-to-anchor still works). Do not polyfill globally unless a test actually asserts intersection.

## 2026-08-14 — Context

**Insight:** `mermaid.initialize` is process-global. The architecture tour variant re-inits a custom `theme`/`themeVariables`/`themeCSS` (dark nodes, colored strokes, linear LR spacing) immediately before `parse`/`render`.

**Why it matters:** A later `MermaidDiagram` with the default dark theme can inherit the last initialize if it does not call `initialize` itself. The shared component already re-inits on every effect, so each instance must keep doing that.

**Evidence:** `client/src/components/mermaid-diagram/MermaidDiagram.tsx` (`ARCHITECTURE_THEME` vs `DEFAULT_THEME`, `mermaid.initialize` in the effect).

**Action:** Always `initialize` in the render effect. Do not assume a previous diagram’s theme is still active — or that it isn’t.

## 2026-08-14 — Recurring Error & Fix

**Insight:** Deep-link scroll into Files changed (`?file=` / `?line=`) cannot live in `DiffTab` as a 50ms `setTimeout`. Smart Diff still shows a skeleton then; `[data-path][data-line]` does not exist yet, so AC-07 often misses the line.

**Why it matters:** Risk Areas clicks looked like a no-op: the tab switched, the file might not even be expanded yet, and the cited line never entered the viewport.

**Evidence:** `client/src/components/diff-viewer/FileCard/FileCard.tsx:99-105` — scroll after the card is open and the patch is parsed; Smart Diff only mounts `FileCard` after `useSmartDiff` resolves.

**Action:** Scroll from `FileCard` (`forceOpen` + `focusLine`) once lines are on screen. Do not time a querySelector from the tab against Smart Diff load.

## 2026-08-14 — Recurring Error & Fix

**Insight:** Why+Risk Brief facts are diff **stats only** (no hunks), so `file_refs` are almost always a bare path (`src/auth.ts`), not `path:line`. Dropping refs without `lineStart` yields an empty overlay — Files changed looks unchanged.

**Why it matters:** Risk Areas links still navigate, but no shield/link/zap ever appears on a diff line.

**Evidence:** `server/test/brief.test.ts` fixtures use `file_refs: ['src/auth.ts']`; `client/.../IntentCard/helpers.ts` `buildRiskMarkersByPath` now keeps path-only markers (`line: 0`) and `overlayRisksOnLines` pins them to the first added line.

**Action:** Never require `:line` on brief citations. Pin path-only (or out-of-hunk) markers to a visible changed line; `review_focus.line_start` is only a hint when present.

