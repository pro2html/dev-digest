"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Checkbox, Icon } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import type { AgentReviewEstimate } from "@/lib/hooks/multi-agent";
import { agentChrome } from "../agentChrome";
import { estimateFor, formatMetricPair } from "../estimateFormat";
import { s } from "./styles";

export function AgentPicker({
  agents,
  estimates,
  selectedIds,
  onToggle,
  onSelectAll,
  showSelectAll = true,
}: {
  agents: Agent[];
  estimates: AgentReviewEstimate[] | undefined;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  showSelectAll?: boolean;
}) {
  const t = useTranslations("multiAgent");
  const allSelected = agents.length > 0 && agents.every((a) => selectedIds.includes(a.id));

  return (
    <div>
      {showSelectAll ? (
        <div style={s.toolbar}>
          <span style={s.toolbarLabel}>{t("configure.stepAgents")}</span>
          <button type="button" style={s.linkBtn} onClick={onSelectAll}>
            {allSelected ? t("configure.clear") : t("configure.selectAll")}
          </button>
        </div>
      ) : null}
      {agents.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("configure.noAgents")}</p>
      ) : (
        <div style={s.list}>
          {agents.map((agent) => {
            const on = selectedIds.includes(agent.id);
            const chrome = agentChrome(agent.id, agent.name);
            const pair = formatMetricPair(
              estimateFor(estimates, agent.id)?.estimate_duration_ms,
              estimateFor(estimates, agent.id)?.estimate_cost_usd,
            );
            const Ico = Icon[chrome.icon];
            return (
              <div
                key={agent.id}
                role="presentation"
                onClick={() => onToggle(agent.id)}
                style={{
                  ...s.card,
                  border: `1px solid ${on ? chrome.color : "var(--border)"}`,
                  background: on ? `${chrome.color}12` : "var(--bg-elevated)",
                }}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={on} onChange={() => onToggle(agent.id)} />
                </div>
                <div style={{ ...s.avatar, background: `${chrome.color}1f`, color: chrome.color }}>
                  <Ico size={16} />
                </div>
                <div style={s.meta}>
                  <div style={s.name}>
                    {agent.name}
                    {!agent.enabled ? (
                      <span style={{ marginLeft: 8, fontWeight: 400, color: "var(--text-muted)" }}>
                        · {t("configure.disabled")}
                      </span>
                    ) : null}
                  </div>
                  {agent.description ? <div style={s.desc}>{agent.description}</div> : null}
                </div>
                {pair ? (
                  <span className="mono" style={s.estimate}>
                    {pair}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
