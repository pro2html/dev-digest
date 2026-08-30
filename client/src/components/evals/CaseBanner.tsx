"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { EvalExpectation } from "@devdigest/shared";

export function CaseBanner({
  expectation,
  title,
  file,
  line,
}: {
  expectation: EvalExpectation;
  title?: string;
  file?: string;
  line?: number | string;
}) {
  const t = useTranslations("eval.caseEditor");
  const positive = expectation === "must_find";
  const loc = file && line != null ? `${file}:${line}` : file ?? "";
  const text =
    title && loc
      ? t(positive ? "positiveBanner" : "negativeBanner", { title, file, line: line ?? 0 })
      : t(positive ? "positiveGeneric" : "negativeGeneric");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 8,
        background: positive ? "var(--accent-bg, rgba(59,130,246,0.15))" : "var(--warn-bg, rgba(217,119,6,0.15))",
        color: positive ? "var(--accent)" : "var(--warn)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
    >
      <Icon.Target size={16} />
      <span>{text}</span>
    </div>
  );
}
