"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { s } from "./styles";

/** Preview tab — body rendered as the reviewing agent receives it. */
export function PreviewTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <p style={s.heading}>{t("editor.preview.heading")}</p>
      <div style={s.card}>
        <Markdown>{skill.body}</Markdown>
      </div>
    </div>
  );
}
