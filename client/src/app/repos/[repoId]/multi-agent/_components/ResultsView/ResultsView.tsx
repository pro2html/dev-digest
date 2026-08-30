"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Icon } from "@devdigest/ui";
import type { AgentColumn, FindingRecord } from "@devdigest/shared";
import RunTraceDrawer from "@/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer";
import { useFindingAction, usePrReviews, useRunEvents } from "@/lib/hooks/reviews";
import { useLatestMultiAgentRun, useMultiAgentRunById } from "@/lib/hooks/multi-agent";
import { usePulls } from "@/lib/hooks/core";
import { formatCostUsd, formatDurationMs } from "../estimateFormat";
import { AgentColumnCard } from "./AgentColumnCard";
import { ConflictsBlock } from "./ConflictsBlock";
import { TabsPanel } from "./TabsPanel";
import { s } from "./styles";

export function ResultsView({ repoId, prId }: { repoId: string; prId: string }) {
  const t = useTranslations("multiAgent");
  const router = useRouter();
  const search = useSearchParams();
  const qc = useQueryClient();
  const parentId = search.get("run");
  const latest = useLatestMultiAgentRun(parentId ? null : prId);
  const byId = useMultiAgentRunById(parentId);
  const envelope = parentId ? byId.data : latest.data;
  const run = envelope?.run ?? null;
  const { data: pulls } = usePulls(repoId);
  const pull = (pulls ?? []).find((p) => p.id === prId);
  const [mode, setMode] = React.useState<"columns" | "tabs">("columns");
  const [onlyConflicts, setOnlyConflicts] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("");
  const [trace, setTrace] = React.useState<{ runId: string; agentName: string; running: boolean } | null>(null);

  const childIds = (run?.columns ?? []).filter((c) => c.status === "running").map((c) => c.run_id);
  const { events } = useRunEvents(childIds);
  const { data: reviews } = usePrReviews(prId);
  const action = useFindingAction();

  React.useEffect(() => {
    const terminal = events.some((e) => e.kind === "result" || e.kind === "error");
    if (!terminal) return;
    void qc.invalidateQueries({ queryKey: ["multi-agent", prId] });
    if (parentId) void qc.invalidateQueries({ queryKey: ["multi-agent-run", parentId] });
    void qc.invalidateQueries({ queryKey: ["reviews", prId] });
  }, [events, qc, prId, parentId]);

  React.useEffect(() => {
    if (!run?.columns.length) return;
    if (!run.columns.some((c) => c.run_id === activeTab)) setActiveTab(run.columns[0]!.run_id);
  }, [run, activeTab]);

  const findingsById = React.useMemo(() => {
    const map = new Map<string, FindingRecord>();
    for (const review of reviews ?? []) {
      for (const f of review.findings) map.set(f.id, f);
    }
    return map;
  }, [reviews]);

  const locations = onlyConflicts ? (run?.conflicts ?? []) : (envelope?.grouped_locations ?? []);
  const openTrace = (col: AgentColumn) => {
    setTrace({ runId: col.run_id, agentName: col.agent_name, running: col.status === "running" });
  };

  const doneCols = (run?.columns ?? []).filter((c) => c.status === "done");
  const wall = doneCols.reduce((max, c) => Math.max(max, c.duration_ms ?? 0), 0);
  const cost = doneCols.reduce((sum, c) => sum + (c.cost_usd ?? 0), 0);
  const n = run?.columns.length ?? 0;
  const cols = n <= 2 ? n : n <= 5 ? n : 5;
  const metaBits = [
    t("results.metaFanout", { count: n }),
    formatDurationMs(wall || null),
    formatCostUsd(doneCols.some((c) => c.cost_usd != null) ? cost : null),
  ].filter(Boolean);

  return (
    <AppShell>
      <div style={s.page}>
        <div style={s.header}>
          <button type="button" style={s.configBtn} onClick={() => router.push(`/repos/${repoId}/multi-agent`)}>
            <Icon.Settings size={14} />
            {t("nav.configure")}
          </button>
          <h1 style={s.title}>{t("results.title")}</h1>
          {run ? <span style={s.subtitle}>{t("results.subtitle", { count: n })}</span> : null}
          {run ? (
            <div style={s.modeSwitch}>
              {(["columns", "tabs"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMode(k)}
                  style={{
                    ...s.modeBtn,
                    background: mode === k ? "var(--bg-elevated)" : "transparent",
                    color: mode === k ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  {t(`results.${k}`)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {!run ? (
          <EmptyState
            icon="Cpu"
            title={t("results.noRunTitle")}
            body={t("results.noRunBody")}
            cta={t("nav.configure")}
            onCta={() => router.push(`/repos/${repoId}/multi-agent`)}
          />
        ) : (
          <>
            <div style={s.meta}>
              <span className="mono" style={{ color: "var(--text-muted)" }}>
                #{pull?.number ?? run.pr_number ?? "—"}
              </span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{pull?.title ?? ""}</span>
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon.Cpu size={14} style={{ color: "var(--accent)" }} />
                {metaBits.join(" · ")}
              </span>
            </div>
            {mode === "columns" ? (
              <div
                style={{ ...s.columns, gridTemplateColumns: `repeat(${Math.max(cols, 1)}, minmax(220px, 1fr))` }}
                data-testid="columns-view"
              >
                {run.columns.map((col) => (
                  <AgentColumnCard key={col.run_id} col={col} onViewTrace={() => openTrace(col)} />
                ))}
              </div>
            ) : (
              <TabsPanel
                columns={run.columns}
                activeTab={activeTab}
                onTab={setActiveTab}
                findingsById={findingsById}
                pending={action.isPending}
                onAction={(findingId, act) => action.mutate({ findingId, action: act, prId })}
                onViewTrace={openTrace}
              />
            )}
            <ConflictsBlock locations={locations} onlyConflicts={onlyConflicts} onOnlyConflicts={setOnlyConflicts} />
          </>
        )}

        {trace ? (
          <RunTraceDrawer
            runId={trace.runId}
            agentName={trace.agentName}
            running={trace.running}
            onClose={() => setTrace(null)}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
