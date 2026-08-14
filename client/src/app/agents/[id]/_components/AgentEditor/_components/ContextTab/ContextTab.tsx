"use client";

import React from "react";
import { EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useTranslations } from "next-intl";
import { ContextAttach, unionEffectivePaths } from "@/components/ContextAttach";
import { ApiError } from "@/lib/api";
import { useAgentSkills } from "@/lib/hooks/agents";
import { useContextFiles } from "@/lib/hooks/core";
import { useAgentContext, useSetAgentContext, useSkillContexts } from "@/lib/hooks/project-context";
import { useActiveRepo } from "@/lib/repo-context";

export function ContextTab({ agent }: { agent: Agent }) {
  const t = useTranslations("context");
  const { repoId } = useActiveRepo();
  const catalog = useContextFiles(repoId);
  const attachments = useAgentContext(agent.id);
  const save = useSetAgentContext();
  const skills = useAgentSkills(agent.id);

  const inheritedIds = (skills.data ?? [])
    .filter((l) => l.enabled && l.skill_enabled)
    .map((l) => l.skill_id);
  const inheritedQueries = useSkillContexts(inheritedIds);
  const inheritedGroups = inheritedQueries.map((q) => (q.data?.documents ?? []).map((d) => d.path));

  const attachedPaths = (attachments.data?.documents ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((d) => d.path);

  const effectivePaths = unionEffectivePaths(attachedPaths, inheritedGroups);

  if (!repoId) {
    return <EmptyState icon="Folder" title={t("attach.noRepo")} />;
  }

  if (attachments.isLoading) {
    return (
      <div>
        <Skeleton height={48} />
        <div style={{ height: 10 }} />
        <Skeleton height={48} />
      </div>
    );
  }

  if (attachments.isError || !attachments.data) {
    return <ErrorState body={t("loadError")} onRetry={() => attachments.refetch()} />;
  }

  const persist = (paths: string[]) => {
    if (catalog.isLoading) return;
    save.mutate({
      agentId: agent.id,
      repoId,
      documents: paths.map((path, order) => ({ path, order })),
    });
  };

  return (
    <ContextAttach
      catalog={catalog.data}
      catalogLoading={catalog.isLoading}
      catalogUnavailable={catalog.error instanceof ApiError && catalog.error.code === "clone_unavailable"}
      catalogError={catalog.isError}
      attachedPaths={attachedPaths}
      onChange={persist}
      busy={save.isPending}
      reorderable
      tokenPaths={effectivePaths}
      onRetry={() => catalog.refetch()}
    />
  );
}
