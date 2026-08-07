/* SeverityTabs — filter chips for Critical / Warning / Suggestion. Active tab
   shows only that severity; clicking again clears the filter. */
"use client";

import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import { ANCHOR_SEVERITIES, type AnchorSeverity } from "./constants";
import { s } from "./styles";

const ARIA_KEY: Record<
  AnchorSeverity,
  "filterCritical" | "filterWarning" | "filterSuggestion"
> = {
  CRITICAL: "filterCritical",
  WARNING: "filterWarning",
  SUGGESTION: "filterSuggestion",
};

const LABEL_KEY: Record<AnchorSeverity, "critical" | "warning" | "suggestion"> = {
  CRITICAL: "critical",
  WARNING: "warning",
  SUGGESTION: "suggestion",
};

export function SeverityTabs({
  counts,
  active,
  onToggle,
}: {
  counts: Record<AnchorSeverity, number>;
  active: AnchorSeverity | null;
  onToggle: (severity: AnchorSeverity) => void;
}) {
  const t = useTranslations("prReview.panel");
  const visible = ANCHOR_SEVERITIES.filter((sev) => counts[sev] > 0);
  if (visible.length === 0) return null;

  return (
    <div style={s.anchors} data-testid="severity-tabs" role="tablist">
      {visible.map((sev) => {
        const meta = SEV[sev];
        const I = Icon[meta.icon];
        const count = counts[sev];
        const isActive = active === sev;
        return (
          <button
            key={sev}
            type="button"
            role="tab"
            aria-selected={isActive}
            className="tnum"
            style={s.tabBtn(isActive ? meta.c : "var(--text-muted)", isActive ? meta.bg : "transparent")}
            title={t(ARIA_KEY[sev], { count })}
            aria-label={t(ARIA_KEY[sev], { count })}
            onClick={() => onToggle(sev)}
          >
            <I size={13} />
            {count}
            {t(LABEL_KEY[sev])}
          </button>
        );
      })}
    </div>
  );
}
