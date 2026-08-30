"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { CircularScore, Icon, MonoLink, SEV } from "@devdigest/ui";
import type { AgentColumn } from "@devdigest/shared";
import { agentChrome } from "../agentChrome";
import { formatMetricPair } from "../estimateFormat";
import { s } from "./styles";

export function AgentColumnCard({
  col,
  onViewTrace,
}: {
  col: AgentColumn;
  onViewTrace: () => void;
}) {
  const t = useTranslations("multiAgent");
  const chrome = agentChrome(col.agent_id, col.agent_name);
  const Ico = Icon[chrome.icon];
  const done = col.status === "done";
  const pair = done ? formatMetricPair(col.duration_ms, col.cost_usd) : null;

  return (
    <article style={s.column} data-testid={`column-${col.agent_id}`}>
      <div style={{ ...s.colHead, borderTop: `2px solid ${chrome.color}` }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: `${chrome.color}1f`, color: chrome.color, flexShrink: 0 }}>
          <Ico size={16} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {col.agent_name}
          </div>
          <div className="mono tnum" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            {pair ?? t(`results.${col.status}`)}
          </div>
        </div>
        {done && col.score != null ? <CircularScore score={col.score} size={32} stroke={3.5} /> : null}
      </div>
      <div style={s.colBody}>
        {done
          ? col.findings.map((f) => {
              const sev = f.severity in SEV ? SEV[f.severity as keyof typeof SEV] : SEV.INFO;
              const SevIcon = Icon[sev.icon];
              return (
                <div key={f.id} style={{ ...s.finding, borderLeft: `2px solid ${sev.c}` }}>
                  <div style={s.findingTitle}>
                    <SevIcon size={12} style={{ color: sev.c, flexShrink: 0 }} />
                    <span>{f.title}</span>
                  </div>
                  {f.file && f.start_line != null ? (
                    <div className="mono" style={s.findingFile}>
                      {f.file}:{f.start_line}
                    </div>
                  ) : null}
                </div>
              );
            })
          : null}
      </div>
      <div style={s.colFoot}>
        <MonoLink onClick={onViewTrace}>{t("results.viewTrace")}</MonoLink>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {t("results.findingsCount", { count: done ? col.findings.length : 0 })}
        </span>
      </div>
    </article>
  );
}
