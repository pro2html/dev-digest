/* FindingsIndicator — critical/warning/suggestion counters that read as ONE
   unit: hovering anywhere on the group (not each icon individually) pops a
   card listing the underlying findings. Shared by the PR list's Findings
   column and the run timeline's inline findings (RunHistory). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV, CategoryTag, ConfidenceNum, MonoLink, type Category } from "@devdigest/ui";
import { githubBlobUrl } from "@/lib/github-urls";

export interface FindingsIndicatorItem {
  title: string;
  severity: "CRITICAL" | "WARNING" | "SUGGESTION";
  category: string;
  file: string;
  start_line: number;
  confidence: number;
}

const SEVERITY_ORDER = ["CRITICAL", "WARNING", "SUGGESTION"] as const;

const wrapStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
};

const cardStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  width: 400,
  maxHeight: 360,
  overflowY: "auto",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-strong)",
  borderRadius: 10,
  boxShadow: "var(--shadow-modal)",
  padding: 12,
  zIndex: 50,
  cursor: "default",
  animation: "ddpop .12s ease",
};

const cardHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  paddingBottom: 8,
  marginBottom: 8,
  borderBottom: "1px solid var(--border)",
};

const cardItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "7px 0",
  borderBottom: "1px solid var(--border)",
};

const cardMoreStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  textAlign: "center",
  paddingTop: 8,
};

/** Truncates a too-long file:line path with an ellipsis instead of forcing
 *  the card to scroll horizontally; full path is still on the title attr. */
const pathWrapStyle: React.CSSProperties = {
  minWidth: 0,
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/** Circular colored chip behind each severity icon, matching the design's
 *  filled-badge look (icon color stays the solid severity color). */
function iconBadgeStyle(bg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: bg,
    flexShrink: 0,
  };
}

/** Per-severity color + icon, matching FindingCard/FindingsSection everywhere else. */
function countStyle(color: string): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 600, color };
}

export function FindingsIndicator({
  critical,
  warning,
  suggestion,
  findings,
  size = "md",
  gap = 10,
  repoFullName,
  headSha,
}: {
  critical: number;
  warning: number;
  suggestion: number;
  /** Preview items for the hover card; omitted/empty ⇒ counts only, no hover. */
  findings?: FindingsIndicatorItem[];
  size?: "sm" | "md";
  gap?: number;
  /** owner/repo + head sha — when both are known, each finding's file:line
   *  becomes a real deep-link to that line on GitHub (same as FindingCard).
   *  Left unset ⇒ the path renders as an inert stub link. */
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const [hover, setHover] = React.useState(false);
  const counts: Record<(typeof SEVERITY_ORDER)[number], number> = {
    CRITICAL: critical,
    WARNING: warning,
    SUGGESTION: suggestion,
  };
  const total = critical + warning + suggestion;
  const iconSize = size === "sm" ? 12 : 13;

  if (total === 0) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  const shownCount = findings?.length ?? 0;
  const hiddenCount = Math.max(0, total - shownCount);
  const showCard = hover && shownCount > 0;

  return (
    <div
      data-testid="findings-indicator"
      style={{ ...wrapStyle, gap }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {SEVERITY_ORDER.filter((sev) => counts[sev] > 0).map((sev) => {
        const meta = SEV[sev];
        const I = Icon[meta.icon];
        return (
          <span key={sev} className="tnum" style={countStyle(meta.c)}>
            <I size={iconSize} />
            {counts[sev]}
          </span>
        );
      })}

      {showCard && (
        <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
          <div style={cardHeaderStyle}>{t("findingsCard.title", { count: total })}</div>
          <div>
            {findings!.map((f, i) => {
              const meta = SEV[f.severity];
              const I = Icon[meta.icon];
              const location = `${f.file}:${f.start_line}`;
              // Real GitHub deep-link when we know the repo + commit (same
              // helper as FindingCard); otherwise an inert stub link so the
              // path still reads/behaves as a link everywhere it's shown.
              const href =
                repoFullName && headSha
                  ? githubBlobUrl(repoFullName, headSha, f.file, f.start_line)
                  : undefined;
              return (
                <div key={i} style={i === findings!.length - 1 ? { ...cardItemStyle, borderBottom: "none" } : cardItemStyle}>
                  <span style={iconBadgeStyle(meta.bg)}>
                    <I size={13} style={{ color: meta.c }} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {f.title}
                      </span>
                      <CategoryTag category={f.category as Category} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, minWidth: 0 }}>
                      <div style={pathWrapStyle} title={location}>
                        <MonoLink href={href}>{location}</MonoLink>
                      </div>
                      <span style={{ flexShrink: 0 }}>
                        <ConfidenceNum value={f.confidence} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {hiddenCount > 0 && (
            <div style={cardMoreStyle}>{t("findingsCard.more", { count: hiddenCount })}</div>
          )}
        </div>
      )}
    </div>
  );
}
