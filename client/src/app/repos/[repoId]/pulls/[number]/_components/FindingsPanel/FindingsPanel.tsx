/* FindingsPanel — severity filter tabs + hide-low-confidence + j/k navigation
   + FindingCard list, wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { KEY_TO_ACTION, type AnchorSeverity } from "./constants";
import { severityCounts, visibleFindings } from "./helpers";
import { SeverityTabs } from "./SeverityTabs";
import { s } from "./styles";

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
  focusFindingId = null,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
  focusFindingId?: string | null;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [severityFilter, setSeverityFilter] = React.useState<AnchorSeverity | null>(null);
  const [focusIdx, setFocusIdx] = React.useState(0);

  const shown = React.useMemo(
    () => visibleFindings(findings, hideLow, severityFilter),
    [findings, hideLow, severityFilter],
  );
  const counts = React.useMemo(() => severityCounts(findings), [findings]);
  const hasTabs = counts.CRITICAL + counts.WARNING + counts.SUGGESTION > 0;

  React.useEffect(() => {
    if (!focusFindingId) return;
    const idx = shown.findIndex((f) => f.id === focusFindingId);
    if (idx >= 0) setFocusIdx(idx);
  }, [focusFindingId, shown]);

  // Keep keyboard focus inside the visible list when filters change.
  React.useEffect(() => {
    setFocusIdx((i) => (shown.length === 0 ? 0 : Math.min(i, shown.length - 1)));
  }, [shown.length]);

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, shown.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focusIdx]) {
        action.mutate({ findingId: shown[focusIdx]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusIdx, action, prId]);

  const toggleSeverity = (severity: AnchorSeverity) => {
    setSeverityFilter((prev) => (prev === severity ? null : severity));
    setFocusIdx(0);
  };

  return (
    <div>
      <div style={s.toolbar}>
        <SeverityTabs counts={counts} active={severityFilter} onToggle={toggleSeverity} />
        {hasTabs && <div style={s.divider} aria-hidden />}
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusIdx || f.id === focusFindingId}
              defaultExpanded={i === 0 || f.id === focusFindingId}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
