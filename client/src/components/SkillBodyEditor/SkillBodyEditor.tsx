/* SkillBodyEditor — mono textarea with line-number gutter + token estimate. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Chip } from "@devdigest/ui";
import { estimateTokens, skillSlug } from "./helpers";
import { s } from "./styles";

export function SkillBodyEditor({
  value,
  onChange,
  fileName,
  dirty,
  rows = 12,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  fileName?: string;
  dirty?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const t = useTranslations("skills");
  const gutterRef = React.useRef<HTMLDivElement>(null);
  const lineCount = Math.max(1, value.split("\n").length);
  const tokens = estimateTokens(value);
  const chipLabel = fileName
    ? fileName.endsWith(".md")
      ? fileName
      : `${fileName}.md`
    : `${skillSlug("skill")}.md`;

  const onScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  return (
    <div style={s.wrap}>
      <div style={s.toolbar}>
        <Chip>{chipLabel}</Chip>
        {dirty && <Badge color="var(--warn, #d97706)">{t("editor.unsaved")}</Badge>}
        <span style={s.tokens}>{t("editor.tokens", { count: tokens })}</span>
      </div>
      <div style={s.editor}>
        <div ref={gutterRef} style={s.gutter} aria-hidden>
          <div style={s.gutterInner}>
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i + 1}>{i + 1}</div>
            ))}
          </div>
        </div>
        <textarea
          className="mono"
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onScroll={onScroll}
          style={s.textarea}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
