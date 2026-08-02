"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, Button, Dropdown, ErrorState, Skeleton, Toggle } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import {
  useAgentSkills,
  useLinkAgentSkill,
  useSetAgentSkills,
  useToggleAgentSkill,
  useUnlinkAgentSkill,
} from "../../../../../../../lib/hooks/agents";
import { useSkills } from "../../../../../../../lib/hooks/skills";
import { s } from "./styles";

/** Skills tab — link/unlink/reorder/toggle skills on an agent (no drag-n-drop). */
export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const { data: links, isLoading, isError, refetch } = useAgentSkills(agent.id);
  const { data: allSkills } = useSkills();
  const setSkills = useSetAgentSkills();
  const toggle = useToggleAgentSkill();
  const unlink = useUnlinkAgentSkill();
  const link = useLinkAgentSkill();

  if (isLoading) {
    return (
      <div style={s.wrap}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <Skeleton height={48} />
        <div style={{ height: 10 }} />
        <Skeleton height={48} />
      </div>
    );
  }

  if (isError || !links) {
    return <ErrorState body={t("skills.loadError")} onRetry={() => refetch()} />;
  }

  const linkedIds = new Set(links.map((l) => l.skill_id));
  const available = (allSkills ?? []).filter((sk) => !linkedIds.has(sk.id));
  const enabledCount = links.filter((l) => l.enabled).length;

  const move = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= links.length) return;
    const reordered = [...links];
    const [item] = reordered.splice(index, 1);
    reordered.splice(next, 0, item!);
    setSkills.mutate({
      agentId: agent.id,
      skills: reordered.map((l, order) => ({
        skill_id: l.skill_id,
        order,
        enabled: l.enabled,
      })),
    });
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <span style={s.muted}>
          {t("skills.enabledCount", { linked: enabledCount, total: links.length })}
        </span>
        <Dropdown
          width={240}
          align="right"
          trigger={
            <Button kind="primary" size="sm" icon="Plus" disabled={available.length === 0}>
              {t("skills.add")}
            </Button>
          }
          items={available.map((sk) => ({
            label: sk.name,
            onClick: () => link.mutate({ agentId: agent.id, skillId: sk.id }),
          }))}
        />
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>

      {links.length === 0 ? (
        <p style={s.empty}>{t("skills.empty")}</p>
      ) : (
        <div style={s.list}>
          {links.map((l, i) => (
            <div key={l.skill_id} style={s.row}>
              <Toggle
                on={l.enabled}
                onChange={(enabled) =>
                  toggle.mutate({ agentId: agent.id, skillId: l.skill_id, enabled })
                }
              />
              <Link href={`/skills/${l.skill_id}`} className="mono" style={s.name}>
                {l.name}
              </Link>
              <Badge color="var(--text-secondary)" mono>
                {l.type}
              </Badge>
              {!l.skill_enabled && (
                <Badge color="var(--warn)" bg="var(--warn-bg)">
                  {t("skills.skillDisabled")}
                </Badge>
              )}
              <div style={s.actions}>
                <Button
                  kind="ghost"
                  size="sm"
                  icon="ArrowUp"
                  disabled={i === 0 || setSkills.isPending}
                  onClick={() => move(i, -1)}
                  aria-label={t("skills.moveUp", { name: l.name })}
                />
                <Button
                  kind="ghost"
                  size="sm"
                  icon="ArrowDown"
                  disabled={i === links.length - 1 || setSkills.isPending}
                  onClick={() => move(i, 1)}
                  aria-label={t("skills.moveDown", { name: l.name })}
                />
                <Button
                  kind="ghost"
                  size="sm"
                  icon="Trash"
                  onClick={() => unlink.mutate({ agentId: agent.id, skillId: l.skill_id })}
                  aria-label={t("skills.unlink", { name: l.name })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
