"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button } from "@devdigest/ui";
import type { EvalCaseListItem, EvalOwnerKind } from "@devdigest/shared";
import { ApiError } from "../../lib/api";
import {
  useCancelEvalSetRun,
  useDeleteEvalCase,
  useEvalCases,
  useEvalHistory,
  useEvalOwnerDashboard,
  useRunEvalCase,
  useStartEvalSetRun,
} from "../../lib/hooks/evals";
import { CaseEditor } from "./CaseEditor";
import { CaseRow, type CaseRowRunState } from "./CaseRow";
import { EvalMetricCards } from "./EvalMetricCards";
import { isEvalCaseBusy } from "./helpers";

export function EvalsTab({ ownerKind, ownerId }: { ownerKind: EvalOwnerKind; ownerId: string }) {
  const t = useTranslations("eval");
  const search = useSearchParams();
  const casesQ = useEvalCases(ownerKind, ownerId);
  const dashQ = useEvalOwnerDashboard(ownerKind, ownerId);
  const historyQ = useEvalHistory(ownerKind, ownerId);
  const start = useStartEvalSetRun(ownerKind, ownerId);
  const cancel = useCancelEvalSetRun(ownerKind, ownerId);
  const runOne = useRunEvalCase(ownerKind, ownerId);
  const del = useDeleteEvalCase(ownerKind, ownerId);
  const [editing, setEditing] = React.useState<EvalCaseListItem | null | "new">(null);
  const [startError, setStartError] = React.useState<string | null>(null);
  const openedFromQuery = React.useRef<string | null>(null);

  const cases = casesQ.data ?? [];
  const inflight = historyQ.data?.find((r) => r.status === "queued" || r.status === "running");
  const postedRunId = start.data?.id;
  const awaitingHistory = Boolean(
    start.isSuccess && postedRunId && !historyQ.data?.some((row) => row.id === postedRunId),
  );
  const setBusy = start.isPending || awaitingHistory || Boolean(inflight);
  const runningCaseId = runOne.isPending && typeof runOne.variables === "string" ? runOne.variables : null;
  const finishedCaseIds = inflight?.per_case.map((row) => row.case_id) ?? [];
  const runLocked = Boolean(runningCaseId) || setBusy;
  const current = dashQ.data?.current;
  const na = dashQ.data?.current_not_applicable;
  const passing = cases.filter((c) => c.last_result === "passed").length;
  const dashboardHref = ownerKind === "agent" ? `/eval/${ownerId}` : `/eval/skill/${ownerId}`;

  React.useEffect(() => {
    const caseId = search.get("case");
    if (!caseId || openedFromQuery.current === caseId) return;
    const found = cases.find((c) => c.id === caseId);
    if (found) {
      openedFromQuery.current = caseId;
      setEditing(found);
    }
  }, [search, cases]);

  async function onRunAll() {
    setStartError(null);
    try {
      await start.mutateAsync();
    } catch (err) {
      if (err instanceof ApiError && (err.code === "no_cases" || err.code === "run_in_progress")) {
        setStartError(err.message);
        return;
      }
      setStartError(err instanceof Error ? err.message : "Run failed");
    }
  }

  function runStateFor(caseId: string): CaseRowRunState {
    if (isEvalCaseBusy({ caseId, runningCaseId, setRunActive: setBusy, finishedCaseIds })) return "running";
    if (runLocked) return "blocked";
    return "idle";
  }

  return (
    <div style={{ padding: 24, display: "grid", gap: 20 }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>{t("evalsTab.metricsTitle")}</h2>
          <Link href={dashboardHref} style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>
            {t("dashboard.viewFullDashboard")}
          </Link>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 16px", fontFamily: "var(--font-mono)" }}>
          {t("scoring.mechanical")}
        </p>
        {current ? (
          <div style={{ display: "grid", gap: 12 }}>
            <EvalMetricCards
              recall={current.recall}
              precision={current.precision}
              citation={current.citation_accuracy}
              na={na}
              delta={dashQ.data?.delta}
              trend={trendSeries(dashQ.data?.trend)}
            />
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {t("evalsTab.tracesPassed")}:{" "}
              <strong>
                {current.traces_passed}/{current.traces_total}
              </strong>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("dashboard.noRuns")}</p>
        )}
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{t("evalsTab.casesHeading")}</h3>
          {cases.length > 0 && (
            <Badge color="var(--warn)" bg="var(--warn-bg)">
              {t("evalsTab.passingBadge", { passed: passing, total: cases.length })}
            </Badge>
          )}
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {t("evalsTab.casesCount", { count: cases.length })}
          </span>
          {inflight ? (
            <Button kind="secondary" icon="Play" onClick={() => cancel.mutate(inflight.id)}>
              {t("run.progress", { finished: inflight.cases_finished, total: inflight.cases_total })}
              {" · "}
              {t("run.cancel")}
            </Button>
          ) : (
            <Button
              kind="secondary"
              icon="Play"
              disabled={cases.length === 0}
              loading={start.isPending || awaitingHistory}
              onClick={() => void onRunAll()}
            >
              {t("run.all")}
            </Button>
          )}
          <Button kind="primary" onClick={() => setEditing("new")}>
            {t("evalsTab.newCase")}
          </Button>
        </div>
        {cases.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("evalsTab.emptyCases")}</p>}
        {startError && <p style={{ fontSize: 13, color: "var(--danger)" }}>{startError}</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {cases.map((c) => (
            <CaseRow
              key={c.id}
              item={c}
              runState={runStateFor(c.id)}
              onRun={() => runOne.mutate(c.id)}
              onEdit={() => setEditing(c)}
              onDelete={() => del.mutate(c.id)}
            />
          ))}
        </div>
      </div>

      {editing && (
        <CaseEditor
          ownerKind={ownerKind}
          ownerId={ownerId}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function trendSeries(trend: { recall: number; precision: number; citation_accuracy: number }[] | undefined) {
  if (!trend?.length) return undefined;
  return {
    recall: trend.map((p) => p.recall),
    precision: trend.map((p) => p.precision),
    citation: trend.map((p) => p.citation_accuracy),
  };
}
