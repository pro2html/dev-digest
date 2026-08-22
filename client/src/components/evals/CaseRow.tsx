"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, IconBtn } from "@devdigest/ui";
import type { EvalCaseListItem } from "@devdigest/shared";
import { firstFinding } from "./helpers";
import { formatExpectedGot } from "./format";

export function CaseRow({
  item,
  running,
  onRun,
  onEdit,
  onDelete,
}: {
  item: EvalCaseListItem;
  running: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("eval.evalsTab");
  const passed = item.last_result === "passed";
  const failed = item.last_result === "failed";
  const statusColor = passed ? "var(--ok)" : failed ? "var(--crit)" : "var(--text-muted)";
  const meta = firstFinding(item.expected_output);
  const tag =
    item.expectation === "must_not_flag"
      ? t("assertEmpty")
      : [typeof meta?.severity === "string" ? meta.severity : null, typeof meta?.category === "string" ? meta.category : null]
          .filter(Boolean)
          .join(" · ");

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--border)",
        borderRadius: 8,
        background: "var(--bg-elevated)",
      }}
    >
      {passed ? (
        <Icon.CheckCircle size={18} style={{ color: statusColor, flexShrink: 0 }} />
      ) : failed ? (
        <Icon.XCircle size={18} style={{ color: statusColor, flexShrink: 0 }} />
      ) : (
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 99,
            background: statusColor,
            flexShrink: 0,
            margin: 4,
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
            {item.name}
          </span>
          <Badge
            color={item.expectation === "must_find" ? "var(--accent)" : "var(--text-secondary)"}
            bg={item.expectation === "must_find" ? "var(--accent-bg, rgba(59,130,246,.15))" : "var(--bg-hover)"}
          >
            {item.expectation === "must_find" ? t("mustFind") : t("mustNotFlag")}
          </Badge>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          {item.last_result === "never_run"
            ? t("neverRun")
            : formatExpectedGot(item.expected_count, item.last_actual_count)}
        </div>
      </div>
      {tag ? (
        <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {tag}
        </span>
      ) : null}
      <IconBtn icon="Play" label={t("run")} onClick={running ? undefined : onRun} />
      <IconBtn icon="Edit" label={t("edit")} onClick={onEdit} />
      <IconBtn icon="Trash" label={t("delete")} onClick={onDelete} danger />
    </div>
  );
}
