/* /skills/:id — always-split Skills Lab. Left list + editor tabs (?tab=). */
"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown, ErrorState, Skeleton, Icon, Badge } from "@devdigest/ui";
import { AppShell } from "../../../components/app-shell";
import { SkillCard } from "../_components/SkillCard";
import { SKILL_TYPE_BADGE } from "../_components/skillTypeBadge";
import { CreateSkillModal } from "../_components/SkillsListView/_components/CreateSkillModal";
import { ImportSkillDrawer } from "../_components/SkillsListView/_components/ImportSkillDrawer";
import { filterSkills } from "../_components/SkillsListView/helpers";
import { SkillEditor } from "./_components/SkillEditor";
import { VALID_TABS } from "./_components/SkillEditor/constants";
import { useSkills, useSkill, useUpdateSkill } from "../../../lib/hooks/skills";
import { ApiError } from "../../../lib/api";

export default function SkillEditorPage() {
  const t = useTranslations("skills");
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { id } = params;

  const { data: skills } = useSkills();
  const { data: skill, isLoading, isError, error, refetch } = useSkill(id);
  const update = useUpdateSkill();
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [filter, setFilter] = React.useState("");

  const tab = VALID_TABS.includes(search.get("tab") ?? "") ? search.get("tab")! : "preview";
  const setTab = (next: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", next);
    router.replace(`/skills/${id}?${sp.toString()}`);
  };

  const visible = filterSkills(skills ?? [], filter);
  const typeBadge = skill ? SKILL_TYPE_BADGE[skill.type] : null;

  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbSkills"), href: "/skills" },
    { label: skill?.name ?? t("editor.skillFallback") },
  ];

  if (isError || (!isLoading && !skill)) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title={t("editor.loadErrorTitle")}
          body={error instanceof ApiError ? error.message : t("editor.loadErrorBody")}
          onRetry={() => refetch()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      {creating && <CreateSkillModal onClose={() => setCreating(false)} />}
      {importing && <ImportSkillDrawer onClose={() => setImporting(false)} />}
      <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
        <div
          style={{
            width: 280,
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ padding: "16px 16px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>{t("editor.listTitle")}</h1>
              <Dropdown
                width={210}
                align="right"
                trigger={
                  <Button kind="primary" size="sm" icon="Plus">
                    {t("editor.add")}
                  </Button>
                }
                items={[
                  { label: t("editor.createSkill"), icon: "Edit", onClick: () => setCreating(true) },
                  { label: t("editor.importFromFile"), icon: "File", onClick: () => setImporting(true) },
                ]}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 11px",
                borderRadius: 7,
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
              }}
            >
              <Icon.Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("page.searchPlaceholder")}
                aria-label={t("page.searchPlaceholder")}
                style={{
                  flex: 1,
                  fontSize: 13,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text-primary)",
                  minWidth: 0,
                }}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 12px 12px" }}>
            {visible.map((sk) => (
              <SkillCard
                key={sk.id}
                skill={sk}
                active={sk.id === id}
                onClick={() => router.push(`/skills/${sk.id}?tab=preview`)}
                onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
              />
            ))}
          </div>
        </div>

        {isLoading || !skill ? (
          <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <Skeleton height={24} width={240} />
            <Skeleton height={200} />
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 28px 0", flexShrink: 0 }}>
              <Icon.Sparkles size={18} style={{ color: "var(--accent)" }} />
              <h1 style={{ fontSize: 18, fontWeight: 700 }}>{skill.name}</h1>
              {typeBadge && (
                <Badge color={typeBadge.color} bg={typeBadge.bg}>
                  {t(`listItem.type.${skill.type}`)}
                </Badge>
              )}
              <Badge color="var(--text-secondary)" mono>
                {t("preview.version", { version: skill.version })}
              </Badge>
              {!skill.enabled && <Badge color="var(--text-muted)">{t("editor.disabled")}</Badge>}
              <div style={{ marginLeft: "auto" }}>
                <Button
                  kind="secondary"
                  size="sm"
                  icon="FlaskConical"
                  onClick={() => setTab("evals")}
                >
                  {t("editor.runOnEvals")}
                </Button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <SkillEditor skill={skill} tab={tab} onTab={setTab} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
