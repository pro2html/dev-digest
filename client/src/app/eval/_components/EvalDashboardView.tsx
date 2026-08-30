"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Icon, ProgressBar } from "@devdigest/ui";
import type { EvalWorkspaceAgentRow, EvalSetRunSummary } from "@devdigest/shared";
import { useRunAllAgentsEvals, useWorkspaceEvalDashboard } from "../../../lib/hooks/evals";
import { formatPct, formatWhen } from "../../../components/evals/format";
import { MiniSpark } from "../../../components/evals/EvalMetricCards";

export function EvalDashboardView() {
  const t = useTranslations("eval");
  const dash = useWorkspaceEvalDashboard();
  const runAll = useRunAllAgentsEvals();
  const [report, setReport] = React.useState<string | null>(null);

  async function onRunAll() {
    const result = await runAll.mutateAsync();
    setReport(
      t("dashboard.runAllReport", {
        started: result.started.length,
        skipped: result.skipped.length,
      }),
    );
  }

  const agents = dash.data?.agents ?? [];
  const recent = dash.data?.recent_runs ?? [];
  const nameById = Object.fromEntries(agents.map((a) => [a.id, a.name]));

  return (
    <div style={{ padding: 28, display: "grid", gap: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t("dashboard.defaultTitle")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{t("dashboard.subtitle")}</p>
        </div>
        <Button kind="primary" icon="Play" disabled={runAll.isPending} onClick={() => void onRunAll()}>
          {t("dashboard.runAllAgents")}
        </Button>
      </div>
      {report && <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{report}</p>}

      <div>
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 12 }}>
          {t("dashboard.agentsHeading")}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 12 }}>
          {t("dashboard.recentRunsAll")}
        </h2>
        {recent.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("dashboard.noRuns")}</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recent.map((r) => (
              <RecentRunRow key={r.id} run={r} agentName={nameById[r.owner_id] ?? r.owner_kind} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: EvalWorkspaceAgentRow }) {
  const t = useTranslations("eval");
  const latest = agent.latest_complete;
  const spark = latest ? [latest.recall, latest.precision, latest.citation_accuracy] : [];
  return (
    <Link
      href={`/eval/${agent.id}`}
      style={{
        display: "block",
        padding: 16,
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--border)",
        background: "var(--bg-elevated)",
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon.Cpu size={16} style={{ color: "var(--accent)" }} />
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", flex: 1 }}>{agent.name}</div>
        <Icon.ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
      </div>
      <div className="mono" style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
        {agent.model}
      </div>
      {latest ? (
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            {t("dashboard.lastRun", {
              version: latest.owner_version,
              when: formatWhen(latest.ran_at),
              passed: latest.passed,
              total: latest.cases_total,
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MiniSpark data={spark} color="var(--accent)" />
            <MetricTriple recall={latest.recall} precision={latest.precision} citation={latest.citation_accuracy} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("dashboard.noRuns")}</div>
      )}
    </Link>
  );
}

function MetricTriple({ recall, precision, citation }: { recall: number; precision: number; citation: number }) {
  const t = useTranslations("eval.dashboard.metrics");
  const cell = (label: string, value: number, color: string) => (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.04em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
        {formatPct(value)}
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
      {cell(t("recall"), recall, "var(--accent)")}
      {cell(t("prec"), precision, "var(--ok)")}
      {cell(t("cite"), citation, "var(--warn, #d97706)")}
    </div>
  );
}

function RecentRunRow({ run, agentName }: { run: EvalSetRunSummary; agentName: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(120px,1.2fr) 150px 48px 1fr 64px",
        gap: 12,
        alignItems: "center",
        fontSize: 13,
        color: "var(--text-secondary)",
        padding: "8px 4px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{agentName}</span>
      <span className="mono">{formatWhen(run.started_at)}</span>
      <span style={{ color: "var(--accent)" }}>v{run.owner_version}</span>
      <div style={{ display: "grid", gap: 4 }}>
        <ProgressBar value={(run.recall ?? 0) * 100} color="var(--accent)" height={4} />
        <ProgressBar value={(run.precision ?? 0) * 100} color="var(--ok)" height={4} />
        <ProgressBar value={(run.citation_accuracy ?? 0) * 100} color="var(--warn, #d97706)" height={4} />
      </div>
      <span className="tnum">
        {run.passed ?? "—"}/{run.cases_total}
      </span>
    </div>
  );
}
