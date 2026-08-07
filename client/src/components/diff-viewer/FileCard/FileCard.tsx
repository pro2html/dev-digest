/* FileCard — one collapsible file in the diff: header (path, +/- stat, comment
   count / findings badge) and, when open, its parsed lines plus any outdated
   comments. Optional Smart Diff finding markers + scroll-to-line. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import type { PrFile } from "@/lib/types";
import { AUTO_EXPAND_MAX_LINES } from "../constants";
import { parsePatch, type Line } from "../helpers";
import {
  buildThreads,
  keysForLine,
  partitionThreads,
  type CommentThread,
  type DiffCommentApi,
} from "../comments";
import { markersByLine, type DiffFindingMarker } from "../findings";
import { s, chevronFor } from "../styles";
import { CodeLine } from "../CodeLine";
import { OutdatedComments } from "../OutdatedComments";

/** Threads anchored to a given parsed line (RIGHT=new, LEFT=old). */
function threadsForLine(ln: Line, matched: Map<string, CommentThread[]>): CommentThread[] {
  if (matched.size === 0) return [];
  const out: CommentThread[] = [];
  for (const key of keysForLine(ln)) {
    const list = matched.get(key);
    if (list) out.push(...list);
  }
  return out;
}

function scrollToFindingLine(path: string, line: number) {
  const nodes = document.querySelectorAll<HTMLElement>("[data-path][data-line]");
  for (const el of nodes) {
    if (el.dataset.path === path && el.dataset.line === String(line)) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
  }
}

export function FileCard({
  file,
  commenting,
  findings,
  defaultOpen,
  findingsBadgeLabel,
}: {
  file: PrFile;
  commenting?: DiffCommentApi;
  /** Smart Diff finding markers (line + severity). */
  findings?: DiffFindingMarker[];
  /** Override initial open state (Smart Diff roles / findings). */
  defaultOpen?: boolean;
  /** i18n label for the findings badge, e.g. "3 findings". */
  findingsBadgeLabel?: string;
}) {
  const t = useTranslations("shell");
  const autoExpand =
    (file.additions ?? 0) + (file.deletions ?? 0) <= AUTO_EXPAND_MAX_LINES;
  const [open, setOpen] = React.useState(
    defaultOpen !== undefined ? defaultOpen : autoExpand,
  );
  const lines = React.useMemo(() => parsePatch(file.patch), [file.patch]);
  const byLine = React.useMemo(
    () => markersByLine(findings ?? []),
    [findings],
  );
  const findingCount = findings?.length ?? 0;

  // Group this file's comments into threads, then split into ones we can anchor
  // to a rendered line vs. "outdated" (GitHub dropped the line / it's not here).
  const comments = commenting?.comments;
  const { matched, outdated } = React.useMemo(() => {
    if (!comments) return { matched: new Map<string, CommentThread[]>(), outdated: [] };
    const fileThreads = buildThreads(comments.filter((c) => c.path === file.path));
    const renderedKeys = new Set<string>();
    for (const ln of lines) for (const k of keysForLine(ln)) renderedKeys.add(k);
    return partitionThreads(fileThreads, renderedKeys);
  }, [comments, file.path, lines]);

  const commentCount = commenting
    ? commenting.comments.filter((c) => c.path === file.path).length
    : 0;

  const firstFindingLine = findings?.[0]?.line;
  const worstSev: Severity | null = React.useMemo(() => {
    if (!findings || findings.length === 0) return null;
    let best: Severity = findings[0]!.severity;
    for (const f of findings) {
      if (SEV[f.severity] && f.severity === "CRITICAL") return "CRITICAL";
      if (f.severity === "WARNING" && best === "SUGGESTION") best = "WARNING";
    }
    return best;
  }, [findings]);

  const jumpToFindings = (e: React.MouseEvent) => {
    e.stopPropagation();
    const line = firstFindingLine;
    if (line == null) return;
    if (!open) {
      setOpen(true);
      // Wait for expand before scrolling.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToFindingLine(file.path, line));
      });
    } else {
      scrollToFindingLine(file.path, line);
    }
  };

  return (
    <div style={s.fileCard}>
      <div onClick={() => setOpen((o) => !o)} style={s.fileHeader}>
        <Icon.ChevronRight size={13} style={chevronFor(open)} />
        <Icon.FileText size={14} style={s.fileIcon} />
        <span className="mono" style={s.filePath}>
          {file.path}
        </span>
        <span className="mono tnum" style={s.fileStat}>
          <span style={s.addText}>+{file.additions}</span>{" "}
          <span style={s.delText}>−{file.deletions}</span>
        </span>
        {findingCount > 0 && (
          <button
            type="button"
            onClick={jumpToFindings}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: worstSev ? SEV[worstSev].c : "var(--text-muted)",
              padding: 0,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: worstSev ? SEV[worstSev].c : "var(--crit)",
              }}
            />
            {findingsBadgeLabel ?? `${findingCount} findings`}
          </button>
        )}
        {commentCount > 0 && (
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}
          >
            <Icon.MessageSquare size={12} />
            {commentCount}
          </span>
        )}
      </div>
      {open && (
        <div style={s.fileBody}>
          {lines.length === 0 ? (
            <div style={s.noDiff}>{t("diffViewer.noDiffText")}</div>
          ) : (
            lines.map((ln, i) => {
              const sev =
                ln.newNo != null ? byLine.get(ln.newNo) ?? null : null;
              return (
                <CodeLine
                  key={i}
                  ln={ln}
                  path={file.path}
                  threads={threadsForLine(ln, matched)}
                  commenting={commenting}
                  findingSeverity={sev}
                  onFindingClick={
                    ln.newNo != null
                      ? () => scrollToFindingLine(file.path, ln.newNo!)
                      : undefined
                  }
                />
              );
            })
          )}
          {commenting && commenting.showComments && <OutdatedComments threads={outdated} />}
        </div>
      )}
    </div>
  );
}
