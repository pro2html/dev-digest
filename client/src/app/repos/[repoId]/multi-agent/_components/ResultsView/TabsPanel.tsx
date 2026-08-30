"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { CircularScore, Icon, MonoLink } from "@devdigest/ui";
import type { AgentColumn, FindingActionKind, FindingRecord } from "@devdigest/shared";
import { FindingCard } from "@/app/repos/[repoId]/pulls/[number]/_components/FindingCard";
import { agentChrome, scoreColor } from "../agentChrome";
import { formatMetricPair } from "../estimateFormat";
import { s } from "./styles";

export function TabsPanel({
  columns,
  activeTab,
  onTab,
  findingsById,
  onAction,
  pending,
  onViewTrace,
}: {
  columns: AgentColumn[];
  activeTab: string;
  onTab: (id: string) => void;
  findingsById: Map<string, FindingRecord>;
  onAction: (findingId: string, action: FindingActionKind) => void;
  pending: boolean;
  onViewTrace: (col: AgentColumn) => void;
}) {
  const t = useTranslations("multiAgent");
  const col = columns.find((c) => c.run_id === activeTab) ?? columns[0];
  if (!col) return null;
  const chrome = agentChrome(col.agent_id, col.agent_name);
  const pair = col.status === "done" ? formatMetricPair(col.duration_ms, col.cost_usd) : null;

  return (
    <div data-testid="tabs-view">
      <div style={s.tabBar}>
        {columns.map((c) => {
          const on = c.run_id === col.run_id;
          const ch = agentChrome(c.agent_id, c.agent_name);
          const TabIcon = Icon[ch.icon];
          return (
            <button
              key={c.run_id}
              type="button"
              onClick={() => onTab(c.run_id)}
              style={{ ...s.tab, borderBottom: `2px solid ${on ? ch.color : "transparent"}`, marginBottom: -1 }}
            >
              <TabIcon size={15} style={{ color: on ? ch.color : "var(--text-muted)" }} />
              <span style={{ fontSize: 13, fontWeight: on ? 600 : 500, color: on ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {c.agent_name}
              </span>
              {c.score != null ? (
                <span className="tnum" style={{ fontSize: 11, fontWeight: 700, color: scoreColor(c.score) }}>
                  {c.score}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div style={s.tabDetail}>
        <div style={{ ...s.summaryCard, borderLeft: `3px solid ${chrome.color}` }}>
          {col.score != null ? <CircularScore score={col.score} size={44} /> : null}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: chrome.color }}>{col.agent_name}</div>
            {col.summary ? (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>{col.summary}</p>
            ) : null}
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right", display: "flex", flexDirection: "column", gap: 4 }}>
            <MonoLink onClick={() => onViewTrace(col)}>{t("results.viewTrace")}</MonoLink>
            {pair ? (
              <span className="mono tnum" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {pair}
              </span>
            ) : null}
          </div>
        </div>
        {col.status !== "done" ? (
          <p style={s.empty}>{t("results.emptyFindings")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {col.findings.map((slim) => {
              const full = findingsById.get(slim.id);
              if (!full) {
                return (
                  <div key={slim.id} style={s.finding}>
                    {slim.title}
                  </div>
                );
              }
              return (
                <FindingCard
                  key={full.id}
                  f={full}
                  defaultExpanded
                  onAction={(act) => onAction(full.id, act)}
                  pending={pending}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
