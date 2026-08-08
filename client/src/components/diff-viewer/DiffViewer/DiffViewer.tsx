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
import { s } from "../styles";
import { FileCard } from "../FileCard";

export function DiffViewer({
  files,
  commenting,
  findings,
  onOpenFinding,
}: {
  files: PrFile[];
  commenting?: DiffCommentApi;
  /** Latest-review findings for inline word-links. */
  findings?: FindingRecord[];
  onOpenFinding?: (findingId: string) => void;
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
        const markers = findingMap.get(normalizeDiffPath(f.path)) ?? [];
        return (
          <FileCard
            key={i}
            file={f}
            commenting={commenting}
            findings={markers}
            defaultOpen={markers.length > 0 ? true : undefined}
            onOpenFinding={onOpenFinding}
          />
        );
      })}
    </div>
  );
}
