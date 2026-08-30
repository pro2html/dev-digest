"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useCiRuns } from "../../../../lib/hooks/ci";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toFixed(3)}`;
}

export function CiRunsView() {
  const t = useTranslations("ci");
  const q = useCiRuns();
  const rows = q.data?.items ?? [];

  return (
    <div style={{ padding: 28, display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t("runs.title")}</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{t("runs.subtitle")}</p>
      </div>

      {q.isError ? (
        <p style={{ color: "var(--danger)", fontSize: 13 }}>{t("runs.loadError")}</p>
      ) : rows.length === 0 ? (
        <div>
          <p style={{ fontWeight: 600 }}>{t("runs.emptyTitle")}</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>{t("runs.emptyBody")}</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
                <th style={th}>{t("runs.table.repository")}</th>
                <th style={th}>{t("runs.table.pullRequest")}</th>
                <th style={th}>{t("runs.table.agent")}</th>
                <th style={th}>{t("runs.table.verdict")}</th>
                <th style={th}>{t("runs.table.findings")}</th>
                <th style={th}>{t("runs.table.cost")}</th>
                <th style={th}>{t("runs.table.duration")}</th>
                <th style={th}>{t("runs.table.job")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>{r.repository ?? "—"}</td>
                  <td style={td}>{r.pr_number != null ? `#${r.pr_number}` : "—"}</td>
                  <td style={td}>{r.agent_name ?? "—"}</td>
                  <td style={td}>{r.verdict ?? "—"}</td>
                  <td style={td}>{r.findings_count ?? "—"}</td>
                  <td style={td}>{formatCost(r.cost_usd)}</td>
                  <td style={td}>{formatDuration(r.duration_ms)}</td>
                  <td style={td}>
                    {r.job_url ? (
                      <a href={r.job_url} target="_blank" rel="noreferrer">
                        {t("runs.view")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 10px" };
