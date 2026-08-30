"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, Button, LineChart, ProgressBar } from "@devdigest/ui";
import type { EvalOwnerKind, EvalSetRun } from "@devdigest/shared";
import { ApiError } from "../../../lib/api";
import { CompareModal } from "../../../components/evals/CompareModal";
import { EvalMetricCards } from "../../../components/evals/EvalMetricCards";
import { formatCost, formatPct, formatWhen } from "../../../components/evals/format";
import {
  useCompareEvalRuns,
  useEvalHistory,
  useEvalOwnerDashboard,
  useStartEvalSetRun,
} from "../../../lib/hooks/evals";

export function OwnerEvalView({
  ownerKind,
  ownerId,
  title,
  model,
}: {
  ownerKind: EvalOwnerKind;
  ownerId: string;
  title: string;
  model?: string;
}) {
  const t = useTranslations("eval");
  const dash = useEvalOwnerDashboard(ownerKind, ownerId);
  const history = useEvalHistory(ownerKind, ownerId);
  const compare = useCompareEvalRuns();
  const start = useStartEvalSetRun(ownerKind, ownerId);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [startError, setStartError] = React.useState<string | null>(null);

  const current = dash.data?.current;
  const delta = dash.data?.delta;
  const na = dash.data?.current_not_applicable;
  const runs = history.data ?? [];
  const trend = dash.data?.trend ?? [];
  const compareDisabled = selected.length !== 2;

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2)));
  }

  return (
    <div style={{ padding: 28, display: "grid", gap: 24 }}>
      <Link href="/eval" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
        ← {t("dashboard.allAgents")}
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h1>
        {model ? (
          <Badge color="var(--text-secondary)" mono>
            {model}
          </Badge>
        ) : null}
        <div style={{ marginLeft: "auto" }}>
          <Button
            kind="primary"
            icon="Play"
            disabled={start.isPending || (dash.data?.cases_total ?? 0) === 0}
            onClick={() => {
              setStartError(null);
              start.mutateAsync().catch((err) => {
                setStartError(err instanceof ApiError ? err.message : "Run failed");
              });
            }}
          >
            {t("dashboard.runEval")}
          </Button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: -12 }}>
        {t("dashboard.ownerSubtitle", { runs: runs.length })}
      </p>
      {startError && <p style={{ fontSize: 13, color: "var(--danger)" }}>{startError}</p>}
      {dash.data?.alert && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "var(--warn-bg, rgba(217,119,6,.12))",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "var(--warn)",
            color: "var(--text-primary)",
          }}
        >
          ⚠ {dash.data.alert}
        </div>
      )}

      {current ? (
        <EvalMetricCards
          recall={current.recall}
          precision={current.precision}
          citation={current.citation_accuracy}
          na={na}
          delta={delta}
          trend={{
            recall: trend.map((p) => p.recall),
            precision: trend.map((p) => p.precision),
            citation: trend.map((p) => p.citation_accuracy),
          }}
        />
      ) : (
        <p style={{ color: "var(--text-muted)" }}>{t("dashboard.noRuns")}</p>
      )}

      {trend.length > 0 && (
        <div>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>
            {t("dashboard.metricTrend")}
          </h2>
          <LineChart
            yMin={0.6}
            yMax={1}
            series={[
              { name: "recall", color: "var(--accent)", data: trend.map((p) => p.recall) },
              { name: "precision", color: "var(--ok)", data: trend.map((p) => p.precision) },
              { name: "citation", color: "var(--warn, #d97706)", data: trend.map((p) => p.citation_accuracy) },
            ]}
          />
        </div>
      )}

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", flex: 1 }}>
            {t("dashboard.recentRuns")}
          </h2>
          {selected.length > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("dashboard.selected", { count: selected.length })}</span>
          )}
          <Button
            kind="secondary"
            size="sm"
            disabled={compareDisabled || compare.isPending}
            onClick={() => compare.mutate({ ownerKind, ownerId, a: selected[0]!, b: selected[1]! })}
          >
            {t("compare.action")}
          </Button>
        </div>
        {selected.length !== 2 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("compare.needTwo")}</p>}
        {runs.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>{t("dashboard.noRuns")}</p>
        ) : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
                <th />
                <th>{t("dashboard.table.ranAt")}</th>
                <th>{t("dashboard.table.version")}</th>
                <th>{t("dashboard.table.recall")}</th>
                <th>{t("dashboard.table.precision")}</th>
                <th>{t("dashboard.table.citation")}</th>
                <th>{t("dashboard.table.pass")}</th>
                <th>{t("dashboard.table.cost")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <HistoryRow key={r.id} run={r} selected={selected.includes(r.id)} onToggle={() => toggle(r.id)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {compare.data && <CompareModal comparison={compare.data} onClose={() => compare.reset()} />}
    </div>
  );
}

function HistoryRow({
  run,
  selected,
  onToggle,
}: {
  run: EvalSetRun;
  selected: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("eval");
  const badge =
    run.status === "partial"
      ? t("status.partial")
      : run.status === "cancelled"
        ? t("status.cancelled")
        : run.status === "failed"
          ? t("status.failed")
          : null;
  return (
    <tr style={{ borderTop: "1px solid var(--border)", opacity: run.status === "complete" ? 1 : 0.75 }}>
      <td>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td className="mono">{formatWhen(run.started_at)}</td>
      <td style={{ color: "var(--accent)" }}>v{run.owner_version}</td>
      <td style={{ minWidth: 88 }}>
        <div className="tnum">{formatPct(run.recall, run.recall_not_applicable)}</div>
        <ProgressBar value={(run.recall ?? 0) * 100} color="var(--accent)" height={4} />
      </td>
      <td style={{ minWidth: 88 }}>
        <div className="tnum">{formatPct(run.precision, run.precision_not_applicable)}</div>
        <ProgressBar value={(run.precision ?? 0) * 100} color="var(--ok)" height={4} />
      </td>
      <td style={{ minWidth: 88 }}>
        <div className="tnum">{formatPct(run.citation_accuracy, run.citation_accuracy_not_applicable)}</div>
        <ProgressBar value={(run.citation_accuracy ?? 0) * 100} color="var(--warn, #d97706)" height={4} />
      </td>
      <td>
        {run.passed ?? "—"}/{run.cases_total}
        {badge ? ` · ${badge}` : ""}
      </td>
      <td>{formatCost(run.cost_usd)}</td>
    </tr>
  );
}
