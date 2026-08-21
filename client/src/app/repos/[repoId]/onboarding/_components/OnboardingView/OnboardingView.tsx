"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { ApiError } from "@/lib/api";
import { useGenerateOnboarding, useOnboarding, useOnboardingFile } from "@/lib/hooks/onboarding";
import { useActiveRepo } from "@/lib/repo-context";
import type { TaskComplexity } from "@devdigest/shared";
import { ArchitectureSection } from "./ArchitectureSection";
import { CriticalPathsSection } from "./CriticalPathsSection";
import { FilePreviewSidebar } from "./FilePreviewSidebar";
import { FirstTasksSection } from "./FirstTasksSection";
import { LocalSetupSection } from "./LocalSetupSection";
import { PageToc } from "./PageToc";
import { ReadingPathSection } from "./ReadingPathSection";
import { SECTION_ANCHORS, type TourSectionKind } from "./constants";
import { copyText, isEmptyTour, relativeGeneratedTime, repoShortName, sectionByKind } from "./helpers";
import { s } from "./styles";

interface Props {
  repoId: string;
}

export function OnboardingView({ repoId }: Props) {
  const t = useTranslations("onboarding");
  const { activeRepo } = useActiveRepo();
  const tourQuery = useOnboarding(repoId);
  const generate = useGenerateOnboarding(repoId);
  const preview = useOnboardingFile(repoId);
  const [previewPath, setPreviewPath] = React.useState<string | null>(null);
  const [shareStatus, setShareStatus] = React.useState<"idle" | "ok" | "fail">("idle");

  const repoName = repoShortName(activeRepo, repoId);
  const tour = tourQuery.data;
  const empty = isEmptyTour(tour);
  const genError = generate.error instanceof ApiError ? generate.error : null;

  React.useEffect(() => {
    if (shareStatus === "idle") return;
    const id = window.setTimeout(() => setShareStatus("idle"), 1600);
    return () => window.clearTimeout(id);
  }, [shareStatus]);

  const crumb = [{ label: "Workspace" }, { label: t("title") }];

  const openPath = (path: string) => {
    setPreviewPath(path);
    preview.mutate(path);
  };

  const startGenerate = () => {
    const wasEmpty = empty;
    generate.mutate(undefined, {
      onSuccess: () => {
        if (!wasEmpty) return;
        requestAnimationFrame(() => {
          document.getElementById(SECTION_ANCHORS.architecture)?.scrollIntoView({ behavior: "smooth" });
        });
      },
    });
  };

  const share = async () => {
    const ok = await copyText(window.location.href);
    setShareStatus(ok ? "ok" : "fail");
  };

  if (tourQuery.isLoading) {
    return (
      <AppShell crumb={crumb}>
        <div style={s.skeletons}>
          <Skeleton height={28} width={280} />
          <Skeleton height={220} />
        </div>
      </AppShell>
    );
  }

  if (tourQuery.isError) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title={t("loadError.title")}
          body={tourQuery.error instanceof ApiError ? tourQuery.error.message : undefined}
          onRetry={() => tourQuery.refetch()}
        />
      </AppShell>
    );
  }

  const complexityLabels: Record<TaskComplexity, string> = {
    low: t("tasks.complexity.low"),
    medium: t("tasks.complexity.medium"),
    high: t("tasks.complexity.high"),
  };
  const tocLabels: Record<TourSectionKind, string> = {
    architecture: t("sections.architecture"),
    critical_paths: t("sections.critical_paths"),
    local_setup: t("sections.local_setup"),
    reading_path: t("sections.reading_path"),
    first_tasks: t("sections.first_tasks"),
  };
  const architecture = sectionByKind(tour?.sections ?? [], "architecture");
  const critical = sectionByKind(tour?.sections ?? [], "critical_paths");
  const local = sectionByKind(tour?.sections ?? [], "local_setup");
  const reading = sectionByKind(tour?.sections ?? [], "reading_path");
  const tasks = sectionByKind(tour?.sections ?? [], "first_tasks");

  const header = empty ? (
    <EmptyState
      icon="Layers"
      title={t("generate.title")}
      body={t("generate.body")}
      cta={generate.isPending ? t("generate.generating") : t("generate.cta")}
      onCta={startGenerate}
      ctaLoading={generate.isPending}
    />
  ) : (
    <>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>
            {t("pageTitleLead")} <span style={s.repoName}>{repoName}</span>
          </h1>
          <p style={s.subtitle}>
            {t("subtitle", {
              count: tour?.files_indexed ?? 0,
              relative: relativeGeneratedTime(tour?.generated_at),
            })}
          </p>
        </div>
        <div style={s.actions}>
          <Button
            kind="secondary"
            icon="RefreshCw"
            loading={generate.isPending}
            onClick={startGenerate}
          >
            {generate.isPending ? t("regenerating") : t("regenerate")}
          </Button>
          <Button kind="secondary" icon="Link" onClick={() => void share()}>
            {shareStatus === "ok"
              ? t("copied")
              : shareStatus === "fail"
                ? t("copyFailed")
                : t("share")}
          </Button>
        </div>
      </div>
      {generate.isPending ? <p style={s.pending}>{t("regenerating")}</p> : null}
    </>
  );

  const banners = (
    <>
      {genError?.code === "clone_unavailable" ? (
        <p style={s.banner}>{t("errors.cloneUnavailable")}</p>
      ) : null}
      {genError?.code === "generation_failed" ? (
        <p style={s.banner}>{t("errors.generationFailed")}</p>
      ) : null}
    </>
  );

  const sections = !empty && tour ? (
    <div style={s.sections}>
      {architecture ? (
        <ArchitectureSection section={architecture} layoutLabel={t("architecture.layout")} />
      ) : null}
      {critical ? (
        <CriticalPathsSection
          section={critical}
          emptyLabel={t("flows.empty")}
          openLabel={t("open")}
          onOpen={openPath}
        />
      ) : null}
      {local ? (
        <LocalSetupSection
          section={local}
          commandsLabel={t("local.commands")}
          envLabel={t("local.env")}
          envEmpty={t("local.envEmpty")}
          commandsEmpty={t("local.commandsEmpty")}
          copyIdle={t("local.copy")}
          copied={t("copied")}
          copyFailed={t("copyFailed")}
        />
      ) : null}
      {reading ? (
        <ReadingPathSection
          section={reading}
          startLabel={t("reading.start")}
          nextLabel={t("reading.next")}
          emptyLabel={t("reading.empty")}
          openLabel={t("open")}
          onOpen={openPath}
        />
      ) : null}
      {tasks ? (
        <FirstTasksSection
          section={tasks}
          intro={t("tasks.intro")}
          emptyLabel={t("tasks.empty")}
          openLabel={t("open")}
          complexityLabels={complexityLabels}
          onOpen={openPath}
        />
      ) : null}
    </div>
  ) : null;

  return (
    <AppShell crumb={crumb}>
      <div style={s.page}>
        {empty ? (
          <>
            {header}
            {banners}
          </>
        ) : (
          <div style={s.layout}>
            <PageToc label={t("toc")} labels={tocLabels} />
            <div style={s.mainCol}>
              {header}
              {banners}
              {sections}
            </div>
          </div>
        )}

        {previewPath ? (
          <FilePreviewSidebar
            path={previewPath}
            content={preview.data?.content ?? null}
            loading={preview.isPending}
            unavailable={
              preview.isError &&
              preview.error instanceof ApiError &&
              (preview.error.code === "file_unavailable" || preview.error.code === "invalid_path")
            }
            unavailableLabel={t("preview.unavailable")}
            loadingLabel={t("preview.loading")}
            closeLabel={t("preview.close")}
            onClose={() => {
              setPreviewPath(null);
              preview.reset();
            }}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
