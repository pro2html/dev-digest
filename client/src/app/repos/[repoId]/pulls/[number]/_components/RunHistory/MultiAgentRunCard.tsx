"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, CircularScore, Icon } from "@devdigest/ui";
import type { MultiAgentRun } from "@devdigest/shared";
import { formatCost } from "@/lib/format-cost";

function durationLabel(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function MultiAgentRunCard({
  parent,
  href,
  defaultOpen,
  onGoToReview,
}: {
  parent: MultiAgentRun;
  href: string;
  defaultOpen?: boolean;
  onGoToReview?: (runId: string) => void;
}) {
  const t = useTranslations("prReview");
  const [open, setOpen] = React.useState(Boolean(defaultOpen));
  const running = parent.columns.some((c) => c.status === "running");
  const failed = parent.columns.some((c) => c.status === "failed");
  const badge = running
    ? { key: "running" as const, color: "var(--accent)", bg: "var(--accent-bg)", icon: "RefreshCw" as const }
    : failed
      ? { key: "error" as const, color: "var(--crit)", bg: "var(--crit-bg)", icon: "XCircle" as const }
      : { key: "reviewed" as const, color: "var(--accent-text)", bg: "var(--accent-bg)", icon: "Users" as const };
  const wall = parent.columns.reduce((max, c) => Math.max(max, c.duration_ms ?? 0), 0);
  const bits = [
    t("timeline.agentsCount", { count: parent.agent_count }),
    durationLabel(wall || null),
    parent.total_cost_usd != null ? formatCost(parent.total_cost_usd) : null,
  ].filter(Boolean);

  return (
    <div
      data-testid={`ma-parent-${parent.id}`}
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--bg-elevated)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flex: 1,
            minWidth: 0,
            padding: "10px 14px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
          }}
        >
          <Badge color={badge.color} bg={badge.bg} icon={badge.icon}>
            {t(`runStatus.${badge.key}`)}
          </Badge>
          <Icon.Users size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {t("timeline.multiAgent")}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{bits.join(" · ")}</div>
          </div>
          {parent.ran_at ? (
            <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
              {new Date(parent.ran_at).toLocaleTimeString()}
            </span>
          ) : null}
          <Icon.ChevronDown
            size={16}
            style={{
              color: "var(--text-muted)",
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform .15s",
              flexShrink: 0,
            }}
          />
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            paddingRight: 14,
            flexShrink: 0,
          }}
        >
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 13,
              color: "var(--accent-text)",
              textDecoration: "none",
            }}
          >
            {t("timeline.openRun")}
          </Link>
        </div>
      </div>
      {open ? (
        <div
          data-testid={`ma-parent-body-${parent.id}`}
          style={{
            borderTop: "1px solid var(--border)",
            padding: "8px 12px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            background: "var(--bg-surface)",
          }}
        >
          {parent.columns.map((col) => (
            <button
              key={col.run_id}
              type="button"
              onClick={() => onGoToReview?.(col.run_id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "8px 10px",
                borderRadius: 7,
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                cursor: onGoToReview ? "pointer" : "default",
                textAlign: "left",
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>{col.agent_name}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>
                {col.status}
              </span>
              {col.status === "done" && col.score != null ? (
                <CircularScore score={col.score} size={26} stroke={3} />
              ) : null}
              {col.status === "done" ? (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {t("timeline.findingsCount", { count: col.findings.length })}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
