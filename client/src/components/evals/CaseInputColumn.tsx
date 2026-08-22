"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FormField, TextInput, Textarea } from "@devdigest/ui";
import { DiffPreview } from "./DiffPreview";
import type { InputTab } from "./helpers";

export function CaseInputColumn({
  name,
  onName,
  tab,
  onTab,
  diff,
  onDiff,
  filesText,
  onFiles,
  title,
  onTitle,
  body,
  onBody,
}: {
  name: string;
  onName: (v: string) => void;
  tab: InputTab;
  onTab: (t: InputTab) => void;
  diff: string;
  onDiff: (v: string) => void;
  filesText: string;
  onFiles: (v: string) => void;
  title: string;
  onTitle: (v: string) => void;
  body: string;
  onBody: (v: string) => void;
}) {
  const t = useTranslations("eval.caseEditor");
  return (
    <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
      <FormField label={t("nameLabel")} required>
        <TextInput value={name} onChange={onName} placeholder={t("namePlaceholder")} mono />
      </FormField>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
          {t("inputLabel")}
        </div>
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 10 }}>
          {(["diff", "files", "prMeta"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onTab(key)}
              style={{
                padding: "8px 12px",
                border: "none",
                background: "transparent",
                borderBottom: "2px solid " + (tab === key ? "var(--accent)" : "transparent"),
                marginBottom: -1,
                fontSize: 13,
                fontWeight: tab === key ? 600 : 500,
                color: tab === key ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {t(`tabs.${key}`)}
            </button>
          ))}
        </div>
        {tab === "diff" ? (
          <DiffPreview diff={diff} onEdit={onDiff} />
        ) : tab === "files" ? (
          <div>
            <Textarea value={filesText} onChange={onFiles} rows={10} mono placeholder={t("filesPlaceholder")} />
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{t("filesHint")}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <FormField label={t("titleLabel")}>
              <TextInput value={title} onChange={onTitle} placeholder={t("titlePlaceholder")} />
            </FormField>
            <FormField label={t("bodyLabel")}>
              <Textarea value={body} onChange={onBody} rows={7} placeholder={t("bodyPlaceholder")} />
            </FormField>
          </div>
        )}
      </div>
    </div>
  );
}
