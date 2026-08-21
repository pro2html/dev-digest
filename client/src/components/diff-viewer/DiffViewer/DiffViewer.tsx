/* DiffViewer — basic GitHub-style unified diff viewer. Renders real PrFile.patch
   (unified-diff text from the F1 API) as a list of collapsible FileCards.
   Optional inline comments + review finding overlays (Original order). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import type { PrFile } from "@/lib/types";
import { type DiffCommentApi } from "../comments";
import { buildFindingMarkersByPath, normalizeDiffPath } from "../findings";
import type { DiffRiskMarker } from "../risks";
import { s } from "../styles";
import { FileCard } from "../FileCard";

export function DiffViewer({
  files,
  commenting,
  findings,
  onOpenFinding,
  focusFile,
  focusLine,
  risksByPath,
}: {
  files: PrFile[];
  commenting?: DiffCommentApi;
  /** Latest-review findings for inline word-links. */
  findings?: FindingRecord[];
  onOpenFinding?: (findingId: string) => void;
  /** Expand and scroll to this changed-file path (`?file=`). */
  focusFile?: string | null;
  focusLine?: number | null;
  /** Risk Areas icons keyed by normalized path. */
  risksByPath?: Map<string, DiffRiskMarker[]>;
}) {
  const t = useTranslations("shell");
  const findingMap = React.useMemo(
    () => buildFindingMarkersByPath(findings ?? []),
    [findings],
  );

  if (!files || files.length === 0) {
    return <div style={s.empty}>{t("diffViewer.noChangedFiles")}</div>;
  }
  return (
    <div style={s.list}>
      {files.map((f, i) => {
        const key = normalizeDiffPath(f.path);
        const markers = findingMap.get(key) ?? [];
        const risks = risksByPath?.get(key) ?? [];
        const focused = focusFile != null && key === normalizeDiffPath(focusFile);
        return (
          <FileCard
            key={i}
            file={f}
            commenting={commenting}
            findings={markers}
            risks={risks}
            defaultOpen={markers.length > 0 || risks.length > 0 ? true : undefined}
            forceOpen={focused}
            onOpenFinding={onOpenFinding}
            focusLine={focused ? focusLine : null}
          />
        );
      })}
    </div>
  );
}
