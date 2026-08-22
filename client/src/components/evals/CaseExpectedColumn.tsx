"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon } from "@devdigest/ui";
import { formatCost, formatDuration } from "./format";

export type LastRunSummary = {
  passed: boolean;
  expected: number;
  actual: number;
  durationMs: number;
  costUsd: number | null;
};

export function CaseExpectedColumn({
  expected,
  onExpected,
  jsonOk,
  onSkeleton,
  lastSummary,
}: {
  expected: string;
  onExpected: (v: string) => void;
  jsonOk: boolean;
  onSkeleton: () => void;
  lastSummary: LastRunSummary | null;
}) {
  const t = useTranslations("eval.caseEditor");
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", flex: 1 }}>
          {t("expectedOutput")}
        </div>
        <Badge
          color={jsonOk ? "var(--ok)" : "var(--danger)"}
          bg={jsonOk ? "var(--ok-bg, rgba(34,197,94,.12))" : "var(--crit-bg)"}
        >
          {jsonOk ? `✓ ${t("validJson")}` : t("invalidJson")}
        </Badge>
        <Button kind="ghost" size="sm" onClick={onSkeleton}>
          {t("findingSkeleton")}
        </Button>
      </div>
      <textarea
        value={expected}
        onChange={(e) => onExpected(e.target.value)}
        spellCheck={false}
        className="mono"
        style={{
          flex: 1,
          minHeight: 280,
          width: "100%",
          fontSize: 12,
          lineHeight: 1.5,
          padding: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: jsonOk ? "var(--border-strong)" : "var(--danger)",
          background: "var(--bg-surface)",
          color: "var(--text-primary)",
          resize: "vertical",
        }}
      />
      {lastSummary && <LastRunBar summary={lastSummary} />}
    </div>
  );
}

function LastRunBar({ summary }: { summary: LastRunSummary }) {
  const t = useTranslations("eval.caseEditor");
  const pieces = [
    summary.passed ? t("lastRunPassed") : t("lastRunFailed"),
    t("lastRunCounts", { expected: summary.expected, actual: summary.actual }),
  ];
  if (summary.durationMs > 0) pieces.push(formatDuration(summary.durationMs));
  if (summary.costUsd != null) pieces.push(formatCost(summary.costUsd));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 8,
        background: summary.passed ? "rgba(34,197,94,.12)" : "var(--crit-bg)",
        color: summary.passed ? "var(--ok)" : "var(--crit)",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {summary.passed ? <Icon.CheckCircle size={16} /> : <Icon.XCircle size={16} />}
      <span>{pieces.join(" · ")}</span>
    </div>
  );
}
