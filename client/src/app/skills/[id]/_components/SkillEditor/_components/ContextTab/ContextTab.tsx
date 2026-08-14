"use client";

import React from "react";
import { EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useTranslations } from "next-intl";
import { ContextAttach } from "@/components/ContextAttach";
import { ApiError } from "@/lib/api";
import { useContextFiles } from "@/lib/hooks/core";
import { useSetSkillContext, useSkillContext } from "@/lib/hooks/project-context";
import { useActiveRepo } from "@/lib/repo-context";

export function ContextTab({ skill }: { skill: Skill }) {
  const t = useTranslations("context");
  const { repoId } = useActiveRepo();
  const catalog = useContextFiles(repoId);
  const attachments = useSkillContext(skill.id);
  const save = useSetSkillContext();

  const attachedPaths = (attachments.data?.documents ?? []).map((d) => d.path);

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
      skillId: skill.id,
      repoId,
      documents: paths.map((path) => ({ path })),
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
      inheritHint
      onRetry={() => catalog.refetch()}
    />
  );
}
