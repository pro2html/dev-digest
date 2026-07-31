# client/ — insights

Lessons learned and gotchas discovered while working in this package, that
aren't obvious from the code or the README. Append as they come up; keep each
entry short (what happened, what to do instead).

## 2026-07-31 — Context

**Insight:** `@devdigest/ui` already exports canonical severity/category visual tokens — `SEV` (severity → color/icon/label) and `CAT` (category → icon/label) from `primitives/tokens.ts`, plus ready-made `SeverityBadge`, `CategoryTag`, and `ConfidenceNum` primitives (used by `FindingCard`). The canonical CRITICAL icon is `AlertOctagon`, not `AlertCircle`/`XCircle`.

**Why it matters:** At least two other findings-related components (`FindingCard/constants.ts` and `RunTraceDrawer/_components/FindingsSection/FindingsSection.tsx`) each independently re-declare their own local `SEV_COLOR` map instead of importing `SEV` — easy to miss and re-duplicate (potentially with an inconsistent icon/color choice) when building any new findings UI.

**Evidence:** `client/src/vendor/ui/primitives/tokens.ts:6-14` (`SEV`/`CAT` definitions, `CRITICAL: { icon: "AlertOctagon", ... }`), `client/src/vendor/ui/primitives/index.ts:1-2` (both exported from the `@devdigest/ui` barrel).

**Action:** For any new severity- or category-colored UI, import `SEV`/`CAT` (or the `SeverityBadge`/`CategoryTag`/`ConfidenceNum` primitives) from `@devdigest/ui` rather than re-declaring severity colors/icons locally.
