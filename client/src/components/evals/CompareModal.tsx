"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@devdigest/ui";
import type { EvalRunComparison } from "@devdigest/shared";
import { formatCost, formatPct, formatPts } from "./format";

export function CompareModal({
  comparison,
  onClose,
}: {
  comparison: EvalRunComparison;
  onClose: () => void;
}) {
  const t = useTranslations("eval");
  const { a, b, delta, prompts, crosses_revision } = comparison;
  return (
    <Modal
      width={800}
      title={t("compare.title", { from: a.owner_version, to: b.owner_version })}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Close
          </button>
        </div>
      }
    >
      <div style={{ padding: 20, display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          <Delta label={t("dashboard.metrics.recall")} from={a.recall} to={b.recall} d={delta.recall} />
          <Delta label={t("dashboard.metrics.precision")} from={a.precision} to={b.precision} d={delta.precision} />
          <Delta
            label={t("dashboard.metrics.citationAccuracy")}
            from={a.citation_accuracy}
            to={b.citation_accuracy}
            d={delta.citation_accuracy}
          />
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Cost</div>
            <div style={{ fontWeight: 700 }}>
              {formatCost(a.cost_usd)} → {formatCost(b.cost_usd)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatCost(delta.cost_usd)}</div>
          </div>
        </div>
        {crosses_revision && (
          <p style={{ fontSize: 13, color: "var(--warn, #d97706)" }}>{t("compare.revisionWarning")}</p>
        )}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{t("compare.systemPrompt")}</div>
          <PromptDiff a={prompts.a} b={prompts.b} aVer={a.owner_version} bVer={b.owner_version} />
        </div>
      </div>
    </Modal>
  );
}

function Delta({
  label,
  from,
  to,
  d,
}: {
  label: string;
  from: number | null;
  to: number | null;
  d: number | null;
}) {
  const pts = formatPts(d);
  const up = (d ?? 0) > 0;
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontWeight: 700 }}>
        {formatPct(from)} → {formatPct(to)}
      </div>
      {pts && (
        <div style={{ fontSize: 12, fontWeight: 700, color: up ? "var(--ok)" : d === 0 ? "var(--text-muted)" : "var(--crit)" }}>
          {pts}
        </div>
      )}
    </div>
  );
}

function PromptDiff({ a, b, aVer, bVer }: { a: string; b: string; aVer: number; bVer: number }) {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const aSet = new Set(aLines);
  const bSet = new Set(bLines);
  return (
    <pre
      className="mono"
      style={{ fontSize: 12, whiteSpace: "pre-wrap", background: "var(--bg-surface)", padding: 12, borderRadius: 8 }}
    >
      {aLines
        .filter((line) => !bSet.has(line))
        .map((line, i) => (
          <div key={`d${i}`} style={{ background: "rgba(239,68,68,.12)", color: "var(--crit)" }}>
            - {line}
          </div>
        ))}
      {bLines
        .filter((line) => !aSet.has(line))
        .map((line, i) => (
          <div key={`a${i}`} style={{ background: "rgba(34,197,94,.12)", color: "var(--ok)" }}>
            + {line}
          </div>
        ))}
      {a === b && (
        <div style={{ color: "var(--text-muted)" }}>
          v{aVer} and v{bVer} use the same prompt.
        </div>
      )}
    </pre>
  );
}
