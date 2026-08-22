"use client";

import React from "react";
import { MetricCard, Sparkline } from "@devdigest/ui";
import { formatPct, formatPts } from "./format";

export function EvalMetricCards({
  recall,
  precision,
  citation,
  na,
  delta,
  trend,
}: {
  recall: number;
  precision: number;
  citation: number;
  na?: { recall?: boolean; precision?: boolean; citation_accuracy?: boolean } | null;
  delta?: { recall: number; precision: number; citation_accuracy: number } | null;
  trend?: { recall: number[]; precision: number[]; citation: number[] };
}) {
  const items = [
    {
      label: "RECALL",
      value: formatPct(recall, na?.recall),
      delta: delta?.recall,
      color: "var(--accent)",
      trend: trend?.recall,
    },
    {
      label: "PRECISION",
      value: formatPct(precision, na?.precision),
      delta: delta?.precision,
      color: "var(--ok)",
      trend: trend?.precision,
    },
    {
      label: "CITATION ACCURACY",
      value: formatPct(citation, na?.citation_accuracy),
      delta: delta?.citation_accuracy,
      color: "var(--warn, #d97706)",
      trend: trend?.citation,
    },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
      {items.map((m) => {
        const pts = formatPts(m.delta);
        return (
          <MetricCard
            key={m.label}
            label={m.label}
            color={m.color}
            trend={m.trend}
            value={
              <>
                {m.value}
                {pts ? (
                  <span
                    style={{
                      marginLeft: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      color: (m.delta ?? 0) >= 0 ? "var(--ok)" : "var(--crit)",
                    }}
                  >
                    {pts}
                  </span>
                ) : null}
              </>
            }
          />
        );
      })}
    </div>
  );
}

export function MiniSpark({ data, color }: { data: number[]; color: string }) {
  return <Sparkline data={data} color={color} w={72} h={28} />;
}
