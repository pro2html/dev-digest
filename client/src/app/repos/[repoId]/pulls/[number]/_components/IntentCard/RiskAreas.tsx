"use client";

import React from "react";
import { Icon } from "@devdigest/ui";
import type { WhyRiskItem } from "@devdigest/shared";
import { citationTarget } from "./helpers";
import { riskVisual } from "@/components/diff-viewer";
import { s } from "./styles";

function RiskRow({
  risk,
  changed,
  onFocusFile,
}: {
  risk: WhyRiskItem;
  changed: Set<string>;
  onFocusFile: (path: string, line?: number) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const visual = riskVisual(risk.severity);
  const Glyph = Icon[visual.icon];
  const expandable = Boolean(risk.explanation);

  return (
    <li style={s.riskRowWrap}>
      <div style={s.riskRow}>
        <Glyph size={14} style={{ color: visual.color, flexShrink: 0 }} />
        <div style={s.riskMain}>
          <span style={s.riskTitle}>{risk.title}</span>
          {risk.file_refs.length > 0 ? (
            <div style={s.riskRefs}>
              {risk.file_refs.map((ref, j) => {
                const target = citationTarget(ref, changed);
                if (target.kind === "file") {
                  return (
                    <button
                      key={`${ref}-${j}`}
                      type="button"
                      className="mono"
                      style={s.fileLink}
                      onClick={() => onFocusFile(target.path, target.line)}
                    >
                      {ref}
                    </button>
                  );
                }
                return (
                  <span key={`${ref}-${j}`} className="mono" style={s.riskLabel}>
                    {target.text}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
        {expandable ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={risk.title}
            style={s.riskChevronBtn}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon.ChevronDown size={14} style={s.riskChevron(open)} />
          </button>
        ) : (
          <Icon.ChevronDown size={14} style={s.riskChevron(false)} />
        )}
      </div>
      {open && risk.explanation ? <p style={s.riskExplanation}>{risk.explanation}</p> : null}
    </li>
  );
}

export function RiskAreas({
  risks,
  changed,
  title,
  onFocusFile,
  pending = false,
  pendingLabel,
  failed = false,
  failedLabel,
  retryLabel,
  onRetry,
}: {
  risks: WhyRiskItem[];
  changed: Set<string>;
  title: string;
  onFocusFile: (path: string, line?: number) => void;
  pending?: boolean;
  pendingLabel?: string;
  failed?: boolean;
  failedLabel?: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  if (risks.length === 0 && !pending && !failed) return null;
  return (
    <>
      <hr style={s.divider} />
      <div style={s.risksBlock}>
        <div style={s.risksHead}>
          <Icon.AlertTriangle size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <span style={s.risksTitle}>{title}</span>
        </div>
        {pending && pendingLabel ? <p style={s.muted}>{pendingLabel}</p> : null}
        {failed && failedLabel ? (
          <p style={s.muted}>
            {failedLabel}{" "}
            {onRetry && retryLabel ? (
              <button type="button" style={s.fileLink} onClick={onRetry}>
                {retryLabel}
              </button>
            ) : null}
          </p>
        ) : null}
        {risks.length > 0 ? (
          <ul style={s.riskList}>
            {risks.map((risk, i) => (
              <RiskRow
                key={`${risk.title}-${i}`}
                risk={risk}
                changed={changed}
                onFocusFile={onFocusFile}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}
