/* SkillCard — left-rail card for the always-split Skills Lab. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkill } from "../../../../lib/hooks/skills";
import { SKILL_TYPE_BADGE } from "../skillTypeBadge";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  agentsCount,
  onClick,
  onToggle,
}: {
  skill: Skill;
  active?: boolean;
  /** Override; defaults to `skill.used_by_agents`. */
  agentsCount?: number | null;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  const del = useDeleteSkill();
  const needsVetting = skill.source !== "manual" && !skill.enabled;
  const count = agentsCount ?? skill.used_by_agents;
  const agentsLabel = count == null ? "—" : String(count);
  const typeBadge = SKILL_TYPE_BADGE[skill.type];

  return (
    <div onClick={onClick} style={s.card(!!active, skill.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox}>
          <Icon.Sparkles size={15} />
        </div>
        <span className="mono" style={s.name}>
          {skill.name}
        </span>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(t("listItem.deleteConfirm", { name: skill.name }))) del.mutate(skill.id);
          }}
          disabled={del.isPending}
          title={t("listItem.deleteTitle")}
          aria-label={t("listItem.deleteTitle")}
          style={{
            background: "none",
            border: "none",
            cursor: del.isPending ? "not-allowed" : "pointer",
            color: "var(--text-muted)",
            display: "inline-flex",
            padding: 4,
          }}
        >
          <Icon.Trash size={14} style={del.isPending ? { animation: "ddspin 1s linear infinite" } : undefined} />
        </button>
      </div>
      <div style={s.description}>{skill.description || t("listItem.noDescription")}</div>
      <div style={s.badges}>
        <Badge color={typeBadge.color} bg={typeBadge.bg}>
          {t(`listItem.type.${skill.type}`)}
        </Badge>
        <Badge color="var(--text-secondary)">{t(`listItem.source.${skill.source}`)}</Badge>
        {needsVetting && (
          <span title={t("listItem.vettingTitle")}>
            <Badge color="var(--warn, #d97706)">{t("listItem.needsVetting")}</Badge>
          </span>
        )}
      </div>
      <div style={s.metrics}>{t("listItem.metrics", { agents: agentsLabel })}</div>
    </div>
  );
}
