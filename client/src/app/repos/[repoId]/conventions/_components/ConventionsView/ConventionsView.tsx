"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Skeleton,
  EmptyState,
  ErrorState,
  Button,
  Chip,
} from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { useActiveRepo } from "@/lib/repo-context";
import {
  useConventions,
  useExtractConventions,
  usePatchConvention,
} from "@/lib/hooks/conventions";
import { ConventionCard } from "./ConventionCard";
import { CreateSkillFromConventionsModal } from "./CreateSkillFromConventionsModal";
import { relativeScanTime } from "./helpers";
import { s } from "./styles";

interface Props {
  repoId: string;
}

export function ConventionsView({ repoId }: Props) {
  const t = useTranslations("conventions");
  const { activeRepo } = useActiveRepo();
  const { data, isLoading, isError } = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const patch = usePatchConvention(repoId);
  const [showRejected, setShowRejected] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);

  const repoName = activeRepo?.full_name ?? t("page.repoFallback");
  const candidates = data?.candidates ?? [];
  const pending = candidates.filter((c) => c.status === "pending");
  const accepted = candidates.filter((c) => c.status === "accepted");
  const rejected = candidates.filter((c) => c.status === "rejected");
  const total = pending.length + accepted.length;

  const handleDeselectAll = () => {
    for (const c of accepted) {
      patch.mutate({ id: c.id, status: "pending" });
    }
  };

  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbConventions") },
  ];

  if (isLoading) {
    return (
      <AppShell crumb={crumb}>
        <div style={s.skeletons}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={120} />
          ))}
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState title={t("page.loadError")} />
      </AppShell>
    );
  }

  const isEmpty = candidates.length === 0;
  const notIndexed = !data?.index_state;
  const sampledFiles = data?.last_scan?.sampled_files ?? 0;

  return (
    <AppShell crumb={crumb}>
      <div style={s.page}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>
              {t("page.headingPrefix")}
              <span style={{ color: "var(--accent)" }}>{repoName}</span>
            </h1>
            {data?.last_scan && (
              <p style={s.subtitle}>
                {t("page.sampleSummary", {
                  n: sampledFiles,
                  relative: relativeScanTime(data.last_scan.created_at),
                })}
              </p>
            )}
          </div>
          <Button
            kind="secondary"
            icon="RefreshCw"
            onClick={() => extract.mutate()}
            disabled={extract.isPending}
          >
            {extract.isPending ? t("page.scanning") : t("page.rescan")}
          </Button>
        </div>

        {isEmpty && (
          <div>
            <EmptyState
              icon="ListChecks"
              title={t("page.empty.title")}
              body={t("page.empty.body")}
              cta={t("page.empty.cta")}
              onCta={() => extract.mutate()}
              ctaLoading={extract.isPending}
            />
            {notIndexed && (
              <p style={s.notIndexedHint}>{t("page.notIndexedHint")}</p>
            )}
          </div>
        )}

        {!isEmpty && (
          <>
            <div style={s.actionBar}>
              <div style={s.actionLeft}>
                {accepted.length > 0 && (
                  <Chip icon="X" onClick={handleDeselectAll}>
                    {t("page.deselectAll")}
                  </Chip>
                )}
                <span style={s.acceptedCount}>
                  {t("page.acceptedCount", { accepted: accepted.length, total })}
                </span>
              </div>
              <Button
                kind="primary"
                icon="Sparkles"
                disabled={accepted.length === 0}
                title={accepted.length === 0 ? t("page.createSkillDisabled") : undefined}
                onClick={() => setShowModal(true)}
              >
                {t("page.createSkill")}
              </Button>
            </div>

            {notIndexed && (
              <p style={{ ...s.notIndexedHint, textAlign: "left", marginBottom: 12 }}>
                {t("page.notIndexedHint")}
              </p>
            )}

            <div style={s.list}>
              {[...accepted, ...pending].map((c) => (
                <ConventionCard
                  key={c.id}
                  candidate={c}
                  onAccept={() => patch.mutate({ id: c.id, status: "accepted" })}
                  onUnaccept={() => patch.mutate({ id: c.id, status: "pending" })}
                  onReject={() => patch.mutate({ id: c.id, status: "rejected" })}
                  onPatchRule={(rule) => patch.mutate({ id: c.id, rule })}
                />
              ))}
            </div>

            {rejected.length > 0 && (
              <div style={s.rejectedWrap}>
                <button
                  type="button"
                  onClick={() => setShowRejected((p) => !p)}
                  style={s.rejectedToggle}
                >
                  {showRejected ? "▾" : "▸"} {t("page.rejectedGroup", { n: rejected.length })}
                </button>
                {showRejected && (
                  <div style={s.rejectedList}>
                    {rejected.map((c) => (
                      <ConventionCard
                        key={c.id}
                        candidate={c}
                        onAccept={() => patch.mutate({ id: c.id, status: "accepted" })}
                        onUnaccept={() => patch.mutate({ id: c.id, status: "pending" })}
                        onReject={() => patch.mutate({ id: c.id, status: "pending" })}
                        onPatchRule={(rule) => patch.mutate({ id: c.id, rule })}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <CreateSkillFromConventionsModal
          repoId={repoId}
          repoName={repoName}
          accepted={accepted}
          onClose={() => setShowModal(false)}
        />
      )}
    </AppShell>
  );
}
