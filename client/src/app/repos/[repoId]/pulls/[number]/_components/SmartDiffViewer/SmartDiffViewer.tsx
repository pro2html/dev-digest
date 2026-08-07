"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Skeleton, ErrorState } from "@devdigest/ui";
import type { FindingRecord, PrFile, SmartDiff, SmartDiffFile, SmartDiffRole } from "@devdigest/shared";
import {
  FileCard,
  type DiffCommentApi,
  type DiffFindingMarker,
} from "@/components/diff-viewer";
import { useSmartDiff } from "@/lib/hooks/smart-diff";
import {
  buildFindingMap,
  buildPrByPath,
  defaultOpenFor,
  joinFindings,
  normalizePath,
} from "./helpers";
import { ROLE_COLOR, ROLE_ICON, s } from "./styles";

function labelKey(role: SmartDiffRole): "coreLabel" | "wiringLabel" | "boilerplateLabel" {
  if (role === "core") return "coreLabel";
  if (role === "wiring") return "wiringLabel";
  return "boilerplateLabel";
}

function subtitleKey(
  role: SmartDiffRole,
): "coreSubtitle" | "wiringSubtitle" | "boilerplateSubtitle" {
  if (role === "core") return "coreSubtitle";
  if (role === "wiring") return "wiringSubtitle";
  return "boilerplateSubtitle";
}

function GroupBlock({
  role,
  files,
  prByPath,
  findingMap,
  commenting,
  onOpenFinding,
}: {
  role: SmartDiffRole;
  files: SmartDiffFile[];
  prByPath: Map<string, PrFile>;
  findingMap: Map<string, DiffFindingMarker[]>;
  commenting?: DiffCommentApi;
  onOpenFinding?: (findingId: string) => void;
}) {
  const t = useTranslations("prReview.smartDiff");
  const IconComp = Icon[ROLE_ICON[role]];

  return (
    <div style={s.group}>
      <div style={s.groupHeader}>
        <IconComp size={15} style={{ ...s.groupIcon, color: ROLE_COLOR[role] }} />
        <div>
          <div style={s.groupTitle}>{t(labelKey(role))}</div>
          <div style={s.groupSub}>{t(subtitleKey(role))}</div>
        </div>
        <span style={s.groupMeta}>{t("filesCount", { count: files.length })}</span>
      </div>
      <div style={s.files}>
        {files.map((sf) => {
          const key = normalizePath(sf.path);
          const prFile = prByPath.get(key) ?? {
            path: sf.path,
            additions: sf.additions,
            deletions: sf.deletions,
            patch: null,
          };
          const markers = joinFindings(sf, findingMap);
          return (
            <FileCard
              key={sf.path}
              file={prFile}
              commenting={commenting}
              findings={markers}
              defaultOpen={defaultOpenFor(role, sf, prByPath.get(key))}
              findingsBadgeLabel={
                markers.length > 0 ? t("findingsBadge", { count: markers.length }) : undefined
              }
              onOpenFinding={onOpenFinding}
            />
          );
        })}
      </div>
    </div>
  );
}

function SplitBanner({ data }: { data: SmartDiff }) {
  const t = useTranslations("prReview.smartDiff");
  if (!data.split_suggestion.too_big) return null;
  return (
    <div style={s.banner}>
      <div style={s.bannerTitle}>
        {t("largeTitle", { lines: data.split_suggestion.total_lines })}
      </div>
      <div style={s.bannerBody}>{t("largeBody")}</div>
      {data.split_suggestion.proposed_splits.length > 0 && (
        <ul style={s.splitList}>
          {data.split_suggestion.proposed_splits.map((p) => (
            <li key={p.name}>
              {t("splitPrefix")} <strong>{p.name}</strong> ({p.files.length})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface SmartDiffViewerProps {
  prId: string | null;
  files: PrFile[];
  /** Latest-review findings for severity join (file + start_line + severity). */
  findings: FindingRecord[];
  commenting?: DiffCommentApi;
  onOpenFinding?: (findingId: string) => void;
}

export function SmartDiffViewer({
  prId,
  files,
  findings,
  commenting,
  onOpenFinding,
}: SmartDiffViewerProps) {
  const t = useTranslations("prReview.smartDiff");
  const { data, isLoading, isError, refetch } = useSmartDiff(prId);

  const prByPath = React.useMemo(() => buildPrByPath(files), [files]);
  const findingMap = React.useMemo(() => buildFindingMap(findings), [findings]);

  if (!prId) {
    return <div style={s.empty}>{t("error")}</div>;
  }

  if (isLoading) {
    return (
      <div style={s.root}>
        <Skeleton height={18} width={220} />
        <Skeleton height={120} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState title={t("error")} onRetry={() => refetch()} />
    );
  }

  if (data.groups.length === 0) {
    return <div style={s.empty}>{t("filesCount", { count: 0 })}</div>;
  }

  return (
    <div style={s.root}>
      <SplitBanner data={data} />
      {data.groups.map((g) => (
        <GroupBlock
          key={g.role}
          role={g.role}
          files={g.files}
          prByPath={prByPath}
          findingMap={findingMap}
          commenting={commenting}
          onOpenFinding={onOpenFinding}
        />
      ))}
    </div>
  );
}
