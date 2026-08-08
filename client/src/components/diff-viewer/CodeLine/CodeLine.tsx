/* CodeLine — one rendered diff line: gutter number, +/- sign, text, plus the
   hover "+" affordance, any anchored comment threads, and an inline composer.
   Findings: left severity stripe + right word-links (suggestion|warning|blocker)
   that deep-link to Agent runs. */
"use client";

import React from "react";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { commentTargetFor, type CommentThread, type DiffCommentApi, cs } from "../comments";
import { type Line } from "../helpers";
import { s, lineRowFor, lineSignFor } from "../styles";
import { CommentThreadView } from "../CommentThreadView";
import { InlineComposer } from "../InlineComposer";
import { findingLinkLabel, type DiffFindingMarker } from "../findings";

export function CodeLine({
  ln,
  path,
  threads,
  commenting,
  findingMarkers,
  stripeSeverity,
  onOpenFinding,
}: {
  ln: Line;
  path: string;
  threads: CommentThread[];
  commenting?: DiffCommentApi;
  /** All findings whose start anchors on this line — render every link. */
  findingMarkers?: DiffFindingMarker[];
  /** Left-edge stripe color by worst covering finding. */
  stripeSeverity?: Severity | null;
  /** Navigate to Agent runs → this finding card. */
  onOpenFinding?: (findingId: string) => void;
}) {
  const [hover, setHover] = React.useState(false);
  const [composing, setComposing] = React.useState(false);

  if (ln.kind === "hunk") {
    return (
      <div className="mono" style={s.hunk}>
        {ln.text}
      </div>
    );
  }

  const sign = ln.kind === "add" ? "+" : ln.kind === "del" ? "−" : "";
  const target = commenting?.canComment ? commentTargetFor(ln) : null;
  const showAdd = hover && !!target && !composing;
  const lineNo = ln.newNo ?? ln.oldNo;
  const markers = findingMarkers ?? [];
  const stripe = stripeSeverity ? SEV[stripeSeverity] : null;

  return (
    <div
      style={cs.rowWrap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-path={path}
      data-line={lineNo ?? undefined}
      data-old-line={ln.oldNo ?? undefined}
      data-new-line={ln.newNo ?? undefined}
    >
      <div style={lineRowFor(ln.kind)}>
        <span
          aria-hidden
          style={{
            ...s.findingStripe,
            background: stripe ? stripe.c : "transparent",
          }}
        />
        <span className="mono tnum" style={{ ...s.lineNo, position: "relative" }}>
          {showAdd && target && (
            <button
              type="button"
              title="Add a comment on this line"
              aria-label="Add a comment on this line"
              onClick={() => setComposing(true)}
              style={cs.addBtn}
            >
              +
            </button>
          )}
          {lineNo ?? ""}
        </span>
        <span className="mono" style={lineSignFor(ln.kind)}>
          {sign}
        </span>
        <span className="mono" style={s.lineText}>
          {ln.text || " "}
        </span>
        {markers.length > 0 && (
          <span style={s.findingLinks}>
            {markers.map((m, i) => {
              const sev = SEV[m.severity];
              const label = findingLinkLabel(m.severity);
              const IconComp = Icon[sev.icon];
              const clickable = !!m.id && !!onOpenFinding;
              return (
                <button
                  key={m.id ?? `${m.line}-${m.severity}-${i}`}
                  type="button"
                  title={clickable ? `Open ${label} in Agent runs` : sev.label}
                  aria-label={clickable ? `Open ${label} in Agent runs` : `Finding: ${label}`}
                  disabled={!clickable}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (m.id && onOpenFinding) onOpenFinding(m.id);
                  }}
                  style={{
                    ...s.findingLink,
                    color: sev.c,
                    cursor: clickable ? "pointer" : "default",
                    opacity: clickable ? 1 : 0.85,
                  }}
                >
                  <IconComp size={12} style={{ flexShrink: 0 }} />
                  {label}
                </button>
              );
            })}
          </span>
        )}
      </div>

      {commenting &&
        commenting.showComments &&
        threads.map((th) => (
          <CommentThreadView key={th.rootId} thread={th} commenting={commenting} path={path} />
        ))}

      {commenting && composing && target && (
        <InlineComposer
          commenting={commenting}
          path={path}
          line={target.line}
          side={target.side}
          onClose={() => setComposing(false)}
        />
      )}
    </div>
  );
}
