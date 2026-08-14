"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { useContextFiles, useImportContextFile } from "@/lib/hooks";
import { ApiError } from "@/lib/api";
import { catalogTokenTotal, coveragePercent, refreshedAgo } from "./catalogStats";
import { FileExplorer } from "./FileExplorer";
import { FilePreview } from "./FilePreview";
import { s } from "./styles";

interface Props {
  repoId: string;
}

export function ContextView({ repoId }: Props) {
  const t = useTranslations("context");
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } =
    useContextFiles(repoId);
  const importFile = useImportContextFile();
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);

  const unavailable = error instanceof ApiError && error.code === "clone_unavailable";
  const files = data ?? [];
  const selected = files.find((f) => f.path === selectedPath) ?? null;
  const coverage = coveragePercent(files);

  React.useEffect(() => {
    if (!selectedPath) {
      setSelectedPath(files[0]?.path ?? null);
      return;
    }
    if (files.some((f) => f.path === selectedPath)) return;
    if (files.length === 0) return;
    setSelectedPath(files[0]?.path ?? null);
  }, [files, selectedPath]);

  const handleImport = async (picked: { filename: string; content: string }) => {
    const saved = await importFile.mutateAsync({ repoId, ...picked });
    await refetch();
    setSelectedPath(saved.path);
  };

  const crumb = [{ label: "Workspace" }, { label: t("title") }];

  if (isLoading) {
    return (
      <AppShell crumb={crumb}>
        <div style={s.skeletons}>
          <Skeleton height={28} width={240} />
          <Skeleton height={320} />
        </div>
      </AppShell>
    );
  }

  if (unavailable) {
    return (
      <AppShell crumb={crumb}>
        <EmptyState icon="Folder" title={t("unavailable.title")} body={t("unavailable.body")} />
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title={t("loadError")}
          body={error instanceof ApiError ? error.message : undefined}
          onRetry={() => refetch()}
        />
      </AppShell>
    );
  }

  const footer = t("footer", {
    documents: files.length,
    tokens: catalogTokenTotal(files).toLocaleString("en-US"),
    ago: dataUpdatedAt ? refreshedAgo(dataUpdatedAt) : "0m ago",
  });

  return (
    <AppShell crumb={crumb}>
      <div style={s.page}>
        <h1 style={s.title}>{t("title")}</h1>
        <div style={s.split}>
          <FileExplorer
            files={files}
            selectedPath={selectedPath}
            footer={footer}
            refreshing={isFetching}
            onSelect={setSelectedPath}
            onRefresh={() => refetch()}
            onImport={handleImport}
          />
          <FilePreview
            file={selected}
            usedByLabel={t("usedBy", { count: selected?.used_by_agents ?? 0 })}
            coverage={coverage}
          />
        </div>
      </div>
    </AppShell>
  );
}
