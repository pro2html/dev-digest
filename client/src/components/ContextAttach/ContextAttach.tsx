"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  Icon,
  Skeleton,
} from "@devdigest/ui";
import type { ContextCatalogFile } from "@devdigest/shared";
import { estimateTokens } from "@/components/SkillBodyEditor/helpers";
import { CATEGORY_BADGE, OVERSIZE_TOKEN_LIMIT, PREVIEW_SIDEBAR_WIDTH } from "./constants";
import { dirPath, fileName, matchesFilter, reorderPaths } from "./helpers";
import { PreviewSidebar } from "./PreviewSidebar";
import { s } from "./styles";

export function ContextAttach({
  catalog,
  catalogLoading,
  catalogUnavailable,
  catalogError,
  attachedPaths,
  onChange,
  busy,
  reorderable,
  inheritHint,
  tokenPaths,
  onRetry,
}: {
  catalog: ContextCatalogFile[] | undefined;
  catalogLoading: boolean;
  catalogUnavailable?: boolean;
  catalogError?: boolean;
  attachedPaths: string[];
  onChange: (paths: string[]) => void;
  busy?: boolean;
  reorderable?: boolean;
  inheritHint?: boolean;
  /** Paths whose text counts toward the total / oversize warning. */
  tokenPaths?: string[];
  onRetry?: () => void;
}) {
  const t = useTranslations("context");
  const [filter, setFilter] = React.useState("");
  const [previewPath, setPreviewPath] = React.useState<string | null>(null);
  const [dragFrom, setDragFrom] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  const files = catalog ?? [];
  const attachedSet = new Set(attachedPaths);
  const byPath = React.useMemo(() => new Map(files.map((f) => [f.path, f])), [files]);

  const scoredPaths = tokenPaths ?? attachedPaths;
  const inheritedSet = new Set(scoredPaths.filter((p) => !attachedSet.has(p)));
  const attachedCount = scoredPaths.length;
  const totalTokens = scoredPaths.reduce((sum, p) => {
    const content = byPath.get(p)?.content ?? "";
    return sum + estimateTokens(content);
  }, 0);
  const oversize = totalTokens > OVERSIZE_TOKEN_LIMIT;

  const attachedFirst = [
    ...attachedPaths,
    ...scoredPaths.filter((p) => inheritedSet.has(p)),
    ...files.map((f) => f.path).filter((p) => !attachedSet.has(p) && !inheritedSet.has(p)),
  ];
  const visible = attachedFirst.filter((p) => matchesFilter(p, filter));

  if (catalogLoading) {
    return (
      <div style={s.wrap}>
        <h2 style={s.h2}>{t("attach.title")}</h2>
        <p style={s.hint}>{t("attach.loading")}</p>
        <Skeleton height={48} />
        <div style={{ height: 10 }} />
        <Skeleton height={48} />
      </div>
    );
  }

  if (catalogUnavailable) {
    return <EmptyState icon="Folder" title={t("unavailable.title")} body={t("unavailable.body")} />;
  }

  if (catalogError) {
    return <ErrorState body={t("loadError")} onRetry={onRetry} />;
  }

  const preview = previewPath ? byPath.get(previewPath) : undefined;

  const toggle = (path: string, attached: boolean) => {
    if (busy) return;
    if (attached) onChange(attachedPaths.filter((p) => p !== path));
    else onChange([...attachedPaths, path]);
  };

  const commitOrder = (fromPath: string, toPath: string) => {
    if (busy || !reorderable) return;
    const next = reorderPaths(attachedPaths, fromPath, toPath);
    if (next.every((p, i) => p === attachedPaths[i])) return;
    onChange(next);
  };

  return (
    <div style={{ ...s.wrap, paddingRight: previewPath ? PREVIEW_SIDEBAR_WIDTH : 0 }}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <h2 style={s.h2}>{t("attach.title")}</h2>
          <span style={s.count}>
            {t("attach.attachedBadge", { attached: attachedCount, total: files.length })}
          </span>
        </div>
        <div style={s.search}>
          <Icon.Search size={13} style={s.searchIcon} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("attach.filterPlaceholder")}
            style={s.searchInput}
            aria-label={t("attach.filterPlaceholder")}
          />
        </div>
      </div>
      {inheritHint ? <p style={s.hint}>{t("attach.inheritHint")}</p> : null}
      {reorderable ? <p style={s.hint}>{t("attach.orderHint")}</p> : null}

      {files.length === 0 ? (
        <p style={s.empty}>{t("empty.body")}</p>
      ) : visible.length === 0 ? (
        <p style={s.empty}>{t("attach.filterEmpty")}</p>
      ) : (
        <div style={s.list} role="list">
          {visible.map((path) => {
            const file = byPath.get(path);
            const attached = attachedSet.has(path);
            const inherited = inheritedSet.has(path);
            const inSet = attached || inherited;
            const canDrag = Boolean(reorderable && attached && !busy);
            const isDragging = dragFrom === path;
            const isOver = dragOver === path && dragFrom !== null && dragFrom !== path;
            const tokens = estimateTokens(file?.content ?? "");
            const dir = dirPath(path);
            const name = fileName(path);
            const cat = file ? CATEGORY_BADGE[file.category] : undefined;
            return (
              <div
                key={path}
                role="listitem"
                draggable={canDrag}
                onDragStart={(e) => {
                  if (!canDrag) {
                    e.preventDefault();
                    return;
                  }
                  setDragFrom(path);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", path);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
                onDragOver={(e) => {
                  if (!reorderable) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOver !== path) setDragOver(path);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragFrom ?? e.dataTransfer.getData("text/plain");
                  setDragFrom(null);
                  setDragOver(null);
                  if (from && attached) commitOrder(from, path);
                }}
                style={{
                  ...s.row,
                  ...(isDragging ? s.rowDragging : {}),
                  ...(isOver ? s.rowDropTarget : {}),
                  ...(busy ? s.rowBusy : {}),
                }}
              >
                <span style={s.handle} aria-hidden>
                  {canDrag ? <Icon.GripVertical size={14} /> : null}
                </span>
                <div onMouseDown={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={inSet}
                    onChange={inherited && !attached ? undefined : (v) => toggle(path, !v)}
                  />
                </div>
                <Icon.FileText size={14} style={s.fileIcon} aria-hidden />
                <span className="mono" style={s.path} title={path}>
                  {name}
                </span>
                {dir ? (
                  <span className="mono" style={s.dir} title={dir}>
                    {dir}
                  </span>
                ) : null}
                {inherited && !attached ? (
                  <Badge color="var(--accent)" bg="var(--accent-bg)">
                    {t("attach.inherited")}
                  </Badge>
                ) : null}
                {file ? (
                  <Badge mono color={cat?.color} bg={cat?.bg}>
                    {t(`category.${file.category}`)}
                  </Badge>
                ) : null}
                <span style={s.tokens}>{t("attach.tokens", { count: tokens })}</span>
                <Button kind="ghost" size="sm" icon="Eye" onClick={() => setPreviewPath(path)}>
                  {t("attach.preview")}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div style={s.footer}>
        <span style={s.footerTokens}>{t("attach.tokensTotal", { count: totalTokens })}</span>
        <span style={s.injectNote}>{t("attach.injectNote")}</span>
        {oversize ? (
          <p style={s.warning} aria-live="polite">
            {t("attach.oversize", { count: totalTokens })}
          </p>
        ) : null}
      </div>

      {previewPath ? (
        <PreviewSidebar
          path={previewPath}
          content={preview?.content ?? ""}
          onClose={() => setPreviewPath(null)}
        />
      ) : null}
    </div>
  );
}
