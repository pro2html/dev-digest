"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, IconBtn } from "@devdigest/ui";
import type { ContextCatalogFile } from "@devdigest/shared";
import { isMarkdownFile, readFileText } from "@/components/SkillBodyEditor";
import { MARKDOWN_FILE_ACCEPT } from "./constants";
import { s } from "./styles";

export function FileExplorer({
  files,
  selectedPath,
  footer,
  refreshing,
  onSelect,
  onRefresh,
  onImport,
}: {
  files: ContextCatalogFile[];
  selectedPath: string | null;
  footer: string;
  refreshing: boolean;
  onSelect: (path: string) => void;
  onRefresh: () => void;
  onImport: (file: { filename: string; content: string }) => Promise<void>;
}) {
  const t = useTranslations("context");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);

  const onPick = async (file: File | null) => {
    setFileError(null);
    if (!file) return;
    if (!isMarkdownFile(file)) {
      setFileError(t("addFileOnlyMd"));
      return;
    }
    try {
      const content = await readFileText(file);
      await onImport({ filename: file.name, content });
    } catch (err) {
      setFileError(err instanceof Error ? err.message : t("addFileFailed"));
    }
  };

  return (
    <div style={s.explorer}>
      <div style={s.toolbar}>
        <IconBtn icon="Plus" label={t("addFile")} onClick={() => inputRef.current?.click()} />
        <IconBtn
          icon="RefreshCw"
          label={refreshing ? t("refreshing") : t("refresh")}
          onClick={onRefresh}
        />
        <input
          ref={inputRef}
          type="file"
          accept={MARKDOWN_FILE_ACCEPT}
          style={s.fileInput}
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            e.target.value = "";
            void onPick(picked);
          }}
        />
      </div>
      {fileError ? <div style={s.fileError}>{fileError}</div> : null}
      <div style={s.list} role="list">
        {files.length === 0 ? (
          <div style={s.listEmpty}>
            <p style={s.listEmptyTitle}>{t("empty.title")}</p>
            <p style={s.listEmptyBody}>{t("empty.body")}</p>
          </div>
        ) : (
          files.map((file) => {
            const active = file.path === selectedPath;
            return (
              <div key={file.path} role="listitem">
                <button
                  type="button"
                  onClick={() => onSelect(file.path)}
                  aria-current={active ? "true" : undefined}
                  style={{ ...s.row, ...(active ? s.rowActive : {}) }}
                >
                  <Icon.FileText size={14} style={s.fileIcon} aria-hidden />
                  <span className="mono" style={s.path} title={file.path}>
                    {file.path}
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>
      <div style={s.footer}>{footer}</div>
    </div>
  );
}
