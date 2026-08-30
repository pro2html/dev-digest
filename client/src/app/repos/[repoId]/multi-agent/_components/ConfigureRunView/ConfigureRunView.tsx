"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { Button, Dropdown, Icon } from "@devdigest/ui";
import { useAgents } from "@/lib/hooks/agents";
import { usePulls } from "@/lib/hooks/core";
import { useReviewEstimates, useStartMultiAgentRun } from "@/lib/hooks/multi-agent";
import { AgentPicker } from "../AgentPicker";
import { aggregateEstimates, formatCostUsd, formatDurationMs } from "../estimateFormat";
import { s } from "./styles";

function StepBadge({ n, on }: { n: number; on: boolean }) {
  return (
    <span
      style={{
        ...s.badge,
        background: on ? "var(--accent-bg)" : "var(--bg-hover)",
        color: on ? "var(--accent-text)" : "var(--text-muted)",
      }}
    >
      {n}
    </span>
  );
}

export function ConfigureRunView({ repoId }: { repoId: string }) {
  const t = useTranslations("multiAgent");
  const router = useRouter();
  const { data: pulls } = usePulls(repoId);
  const { data: agents } = useAgents();
  const { data: estimates } = useReviewEstimates();
  const start = useStartMultiAgentRun();
  const [prId, setPrId] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const listed = agents ?? [];

  React.useEffect(() => {
    if (!prId) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((agents ?? []).filter((a) => a.enabled).map((a) => a.id));
  }, [prId, agents]);

  const pullOptions = (pulls ?? []).filter((p) => p.id && p.status !== "stale");
  const selectedPull = pullOptions.find((p) => p.id === prId);
  const allOn = listed.length > 0 && listed.every((a) => selectedIds.includes(a.id));

  const n = selectedIds.length;
  const canStart = Boolean(prId) && n > 0 && !start.isPending;
  const agg = aggregateEstimates(estimates, selectedIds);
  const aggBits = [
    formatDurationMs(agg.maxDurationMs),
    formatCostUsd(agg.sumCostUsd),
    t("configure.footerFanout"),
  ].filter(Boolean);

  const onStart = async () => {
    if (!canStart) return;
    const run = await start.mutateAsync({ prId, agentIds: selectedIds });
    router.push(`/repos/${repoId}/multi-agent/${prId}?run=${run.id}`);
  };

  return (
    <AppShell>
      <div style={s.page}>
        <h1 style={s.title}>{t("configure.title")}</h1>
        <p style={s.subtitle}>{t("configure.subtitle")}</p>

        <div style={s.step}>
          <StepBadge n={1} on />
          <span style={s.stepLabel}>{t("configure.stepPull")}</span>
        </div>
        <div style={s.stepBody}>
          <Dropdown
            width={420}
            align="left"
            trigger={
              <Button kind="secondary" icon="GitPullRequest" iconRight="ChevronDown">
                {selectedPull
                  ? `#${selectedPull.number} · ${selectedPull.title}`
                  : t("configure.pullPlaceholder")}
              </Button>
            }
            items={pullOptions.map((p) => ({
              label: `#${p.number} · ${p.title}`,
              icon: "GitPullRequest" as const,
              onClick: () => setPrId(p.id as string),
            }))}
          />
        </div>

        <div style={s.step}>
          <StepBadge n={2} on={Boolean(prId)} />
          <span style={{ ...s.stepLabel, color: prId ? "var(--text-primary)" : "var(--text-muted)" }}>
            {t("configure.stepAgents")}
          </span>
          {prId ? (
            <button
              type="button"
              style={s.linkBtn}
              onClick={() =>
                setSelectedIds((prev) => (allOn ? [] : listed.map((a) => a.id)))
              }
            >
              {allOn ? t("configure.clear") : t("configure.selectAll")}
            </button>
          ) : null}
        </div>

        {!prId ? (
          <div style={s.emptyPanel} data-testid="empty-agents">
            <div style={s.emptyIcon}>
              <Icon.GitPullRequest size={21} style={{ color: "var(--text-muted)" }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t("configure.emptyAgentsTitle")}</div>
            <p
              style={{
                fontSize: 12.5,
                color: "var(--text-muted)",
                marginTop: 5,
                maxWidth: 320,
                marginInline: "auto",
                lineHeight: 1.5,
              }}
            >
              {t("configure.emptyAgentsBody")}
            </p>
          </div>
        ) : (
          <div style={{ marginLeft: 32 }}>
            <AgentPicker
              agents={listed}
              estimates={estimates}
              selectedIds={selectedIds}
              showSelectAll={false}
              onToggle={(id) =>
                setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
              }
              onSelectAll={() =>
                setSelectedIds((prev) => (allOn ? [] : listed.map((a) => a.id)))
              }
            />
          </div>
        )}

        <div style={s.footer}>
          <Button
            kind="primary"
            icon="Users"
            disabled={!canStart}
            loading={start.isPending}
            onClick={() => void onStart()}
          >
            {start.isPending ? t("configure.starting") : t("configure.start", { count: n })}
          </Button>
          {prId && n > 0 && (agg.maxDurationMs != null || agg.sumCostUsd != null) ? (
            <span className="mono" style={s.aggregate}>
              ≈ {aggBits.join(" · ")}
            </span>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
