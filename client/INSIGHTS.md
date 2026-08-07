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
