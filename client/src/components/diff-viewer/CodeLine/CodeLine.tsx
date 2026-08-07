/* CodeLine — one rendered diff line: gutter number, +/- sign, text, plus the
   hover "+" affordance, any anchored comment threads, and an inline composer.
   Optional Smart Diff finding markers (severity color) + stable line anchors. */
"use client";

import React from "react";
import { SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { commentTargetFor, type CommentThread, type DiffCommentApi, cs } from "../comments";
import { type Line } from "../helpers";
import { s, lineRowFor, lineSignFor } from "../styles";
import { CommentThreadView } from "../CommentThreadView";
import { InlineComposer } from "../InlineComposer";

export function CodeLine({
  ln,
  path,
  threads,
  commenting,
  findingSeverity,
  onFindingClick,
}: {
  ln: Line;
  path: string;
  threads: CommentThread[];
  commenting?: DiffCommentApi;
  /** Severity of a finding anchored to this line's new (RIGHT) number. */
  findingSeverity?: Severity | null;
  onFindingClick?: () => void;
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
  const sev = findingSeverity ? SEV[findingSeverity] : null;

  return (
    <div
      style={cs.rowWrap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-path={path}
      data-line={lineNo ?? undefined}
    >
      <div style={lineRowFor(ln.kind)}>
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
        {sev && (
          <button
            type="button"
            title={sev.label}
            aria-label={`Finding: ${sev.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onFindingClick?.();
            }}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              border: "none",
              padding: 0,
              margin: "6px 6px 0 0",
              flexShrink: 0,
              cursor: "pointer",
              background: sev.c,
            }}
          />
        )}
        <span className="mono" style={s.lineText}>
          {ln.text || " "}
        </span>
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
