"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  Checkbox,
  Dropdown,
  ErrorState,
  Icon,
  Skeleton,
} from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import {
  useAgentSkills,
  useLinkAgentSkill,
  useSetAgentSkills,
  useToggleAgentSkill,
  useUnlinkAgentSkill,
} from "../../../../../../../lib/hooks/agents";
import { useSkills } from "../../../../../../../lib/hooks/skills";
import { SKILL_TYPE_BADGE } from "./constants";
import {
  filterLinkedSkills,
  reorderBySkillId,
  toSetSkillsBody,
} from "./helpers";
import { s } from "./styles";

/** Skills tab — link/unlink/toggle/reorder skills on an agent via drag-and-drop. */
export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const { data: links, isLoading, isError, refetch } = useAgentSkills(agent.id);
  const { data: allSkills } = useSkills();
  const setSkills = useSetAgentSkills();
  const toggle = useToggleAgentSkill();
  const unlink = useUnlinkAgentSkill();
  const link = useLinkAgentSkill();
  const [filter, setFilter] = useState("");
  const [dragFromId, setDragFromId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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
  const visible = filterLinkedSkills(links, filter);
  const busy = setSkills.isPending;

  const commitOrder = (fromSkillId: string, toSkillId: string) => {
    if (busy || fromSkillId === toSkillId) return;
    const reordered = reorderBySkillId(links, fromSkillId, toSkillId);
    if (reordered.every((l, i) => l.skill_id === links[i]?.skill_id)) return;
    setSkills.mutate({
      agentId: agent.id,
      skills: toSetSkillsBody(reordered),
    });
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <h2 style={s.h2}>{t("skills.title")}</h2>
          <span style={s.count}>
            {t("skills.enabledCount", { linked: enabledCount, total: links.length })}
          </span>
        </div>
        <div style={s.headerRight}>
          <div style={s.search}>
            <Icon.Search size={13} style={s.searchIcon} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("skills.filterPlaceholder")}
              style={s.searchInput}
              aria-label={t("skills.filterPlaceholder")}
            />
          </div>
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
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>

      {links.length === 0 ? (
        <p style={s.empty}>{t("skills.empty")}</p>
      ) : visible.length === 0 ? (
        <p style={s.empty}>{t("skills.filterEmpty")}</p>
      ) : (
        <div style={s.list} role="list">
          {visible.map((l) => {
            const isDragging = dragFromId === l.skill_id;
            const isOver = dragOverId === l.skill_id && dragFromId !== null && dragFromId !== l.skill_id;
            const typeBadge = SKILL_TYPE_BADGE[l.type];
            return (
              <div
                key={l.skill_id}
                role="listitem"
                draggable={!busy}
                tabIndex={0}
                aria-grabbed={isDragging || undefined}
                aria-label={t("skills.dragHandle", { name: l.name })}
                onDragStart={(e) => {
                  if (busy) {
                    e.preventDefault();
                    return;
                  }
                  setDragFromId(l.skill_id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", l.skill_id);
                }}
                onDragEnd={() => {
                  setDragFromId(null);
                  setDragOverId(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverId !== l.skill_id) setDragOverId(l.skill_id);
                }}
                onDragLeave={() => {
                  if (dragOverId === l.skill_id) setDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = dragFromId ?? e.dataTransfer.getData("text/plain");
                  setDragFromId(null);
                  setDragOverId(null);
                  if (fromId) commitOrder(fromId, l.skill_id);
                }}
                onKeyDown={(e) => {
                  if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                  e.preventDefault();
                  const idx = links.findIndex((x) => x.skill_id === l.skill_id);
                  const next = e.key === "ArrowUp" ? idx - 1 : idx + 1;
                  const neighbor = links[next];
                  if (neighbor) commitOrder(l.skill_id, neighbor.skill_id);
                }}
                style={{
                  ...s.row,
                  ...(!l.enabled ? s.rowDisabled : {}),
                  ...(isDragging ? s.rowDragging : {}),
                  ...(isOver ? s.rowDropTarget : {}),
                  ...(busy ? s.rowBusy : {}),
                }}
              >
                <span style={s.handle} aria-hidden>
                  <Icon.GripVertical size={14} />
                </span>
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={l.enabled}
                    onChange={(enabled) =>
                      toggle.mutate({ agentId: agent.id, skillId: l.skill_id, enabled })
                    }
                  />
                </div>
                <Link
                  href={`/skills/${l.skill_id}`}
                  className="mono"
                  style={s.name}
                  draggable={false}
                >
                  {l.name}
                </Link>
                <Badge color={typeBadge.color} bg={typeBadge.bg} mono>
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
                    icon="Trash"
                    onClick={() => unlink.mutate({ agentId: agent.id, skillId: l.skill_id })}
                    aria-label={t("skills.unlink", { name: l.name })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
