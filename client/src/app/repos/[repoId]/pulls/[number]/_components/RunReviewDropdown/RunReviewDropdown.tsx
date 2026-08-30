/* Run Review picker — multi-agent start popover (replaces one-click run-all). */
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@devdigest/ui";
import { useAgents } from "../../../../../../../lib/hooks/agents";
import { useReviewEstimates, useStartMultiAgentRun } from "../../../../../../../lib/hooks/multi-agent";
import { AgentPicker } from "../../../../multi-agent/_components/AgentPicker";
import { DROPDOWN_WIDTH } from "./constants";

export function RunReviewDropdown({
  prId,
  size = "sm",
  kind = "primary",
  warnMerged = false,
  onRunStart,
  onRunsStarted,
  onRunSettled,
}: {
  prId?: string | null;
  size?: "sm" | "md" | "lg";
  kind?: "primary" | "secondary";
  warnMerged?: boolean;
  onRunStart?: () => void;
  onRunsStarted?: (runIds: string[]) => void;
  onRunSettled?: () => void;
}) {
  const t = useTranslations("prReview");
  const tm = useTranslations("multiAgent");
  const router = useRouter();
  const params = useParams<{ repoId: string }>();
  const { data: agents } = useAgents();
  const { data: estimates } = useReviewEstimates();
  const start = useStartMultiAgentRun();
  const [open, setOpen] = React.useState(false);
  const listed = agents ?? [];
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const seeded = React.useRef(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (seeded.current || listed.length === 0) return;
    setSelectedIds(listed.filter((a) => a.enabled).map((a) => a.id));
    seeded.current = true;
  }, [listed]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!prId) return null;

  const n = selectedIds.length;
  const canStart = n > 0 && !start.isPending;

  const onStart = async () => {
    if (!canStart) return;
    onRunStart?.();
    try {
      const run = await start.mutateAsync({ prId, agentIds: selectedIds });
      onRunsStarted?.(run.columns.map((c) => c.run_id));
      setOpen(false);
      router.push(`/repos/${params.repoId}/multi-agent/${prId}?run=${run.id}`);
    } finally {
      onRunSettled?.();
    }
  };

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      <span title={warnMerged ? t("runReview.mergedTooltip") : undefined} style={warnMerged ? { opacity: 0.6 } : undefined}>
        <Button
          kind={kind}
          size={size}
          iconRight="ChevronDown"
          icon="Sparkles"
          loading={start.isPending}
          onClick={() => setOpen((v) => !v)}
        >
          {start.isPending ? t("runReview.running") : t("runReview.runReview")}
        </Button>
      </span>
      {open ? (
        <div
          data-testid="multi-agent-picker"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            width: Math.max(DROPDOWN_WIDTH, 320),
            zIndex: 40,
            background: "var(--bg-elevated, var(--bg))",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,.18)",
          }}
        >
          {warnMerged ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
              {t("runReview.mergedWarning")}
            </div>
          ) : null}
          <AgentPicker
            agents={listed}
            estimates={estimates}
            selectedIds={selectedIds}
            onToggle={(id) =>
              setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
            onSelectAll={() =>
              setSelectedIds((prev) =>
                listed.length > 0 && listed.every((a) => prev.includes(a.id)) ? [] : listed.map((a) => a.id),
              )
            }
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <Button kind="primary" size="sm" disabled={!canStart} loading={start.isPending} onClick={() => void onStart()}>
              {tm("configure.start", { count: n })}
            </Button>
            <Button kind="ghost" size="sm" onClick={() => router.push("/agents")}>
              {tm("picker.configureAgents")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
