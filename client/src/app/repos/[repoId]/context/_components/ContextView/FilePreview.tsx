"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { CircularScore } from "@devdigest/ui";
import type { ContextCatalogFile } from "@devdigest/shared";
import { fileName } from "@/components/ContextAttach";
import { MarkdownDoc } from "@/components/MarkdownDoc";
import { COVERAGE_RING_SIZE, COVERAGE_RING_STROKE, VIEW_MODE, type ViewMode } from "./constants";
import { s } from "./styles";

export function FilePreview({
  file,
  usedByLabel,
  coverage,
}: {
  file: ContextCatalogFile | null;
  usedByLabel: string;
  coverage: number;
}) {
  const t = useTranslations("context");
  const [mode, setMode] = React.useState<ViewMode>(VIEW_MODE.preview);
  const [draft, setDraft] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(null);
    setMode(VIEW_MODE.preview);
  }, [file?.path]);

  const text = draft ?? file?.content ?? "";
  const editing = mode === VIEW_MODE.edit;

  return (
    <aside aria-label={file?.path ?? t("previewEmpty")} style={s.preview}>
      <div style={s.previewHeader}>
        <span className="mono" style={s.previewTitle} title={file?.path}>
          {file ? fileName(file.path) : t("previewEmpty")}
        </span>
        <div style={s.modeToggle} role="tablist" aria-label={t("mode.label")}>
          <ModeTab
            active={!editing}
            label={t("mode.preview")}
            onClick={() => setMode(VIEW_MODE.preview)}
          />
          <ModeTab
            active={editing}
            label={t("mode.edit")}
            disabled={!file}
            onClick={() => setMode(VIEW_MODE.edit)}
          />
        </div>
        <div style={s.headerRight}>
          {file ? <span style={s.usedBy}>{usedByLabel}</span> : null}
          <CoverageRing score={coverage} />
        </div>
      </div>
      {!file ? (
        <p style={s.previewEmpty}>{t("previewEmpty")}</p>
      ) : editing ? (
        <div style={s.editor}>
          <textarea
            className="mono"
            aria-label={t("mode.edit")}
            value={text}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            style={s.textarea}
          />
        </div>
      ) : (
        <div style={s.previewBody}>
          <MarkdownDoc>{text}</MarkdownDoc>
        </div>
      )}
    </aside>
  );
}

function ModeTab({
  active,
  label,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...s.modeBtn,
        ...(active ? s.modeBtnOn : s.modeBtnOff),
        ...(disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}),
      }}
    >
      {label}
    </button>
  );
}

function CoverageRing({ score }: { score: number }) {
  const t = useTranslations("context");
  return (
    <div style={s.coverage} aria-label={t("coverageAria", { score })}>
      <CircularScore score={score} size={COVERAGE_RING_SIZE} stroke={COVERAGE_RING_STROKE} />
      <span style={s.coverageLabel}>{t("coverage")}</span>
    </div>
  );
}
