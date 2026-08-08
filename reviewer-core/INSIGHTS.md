# reviewer-core/ — insights

Lessons learned and gotchas discovered while working in this package, that
aren't obvious from the code or the README. Append as they come up; keep each
entry short (what happened, what to do instead).

## 2026-08-07 — Decision

**Insight:** Out-of-scope filtering runs **after** `groundFindings`, then the score is recomputed from the kept set. Suppressed OOS noise is signaled only via a summary suffix + Live Log — never by inventing a fake grounded `file:line` finding.

**Why it matters:** Emitting a synthetic finding for “N suppressed” would either fail grounding or lie about a citation; filtering before grounding would drop items that never get a chance to prove a real security line.

**Evidence:** `reviewer-core/src/review/run.ts` (ground → `filterOutOfScopeFindings` → `scoreFromFindings` + `outOfScopeSummarySuffix`); escape hatch keeps CRITICAL / `security` / `secret_leak` / `lethal_trifecta`.

**Action:** Keep scope-filter after grounding; never mint fake citations for OOS signals.
