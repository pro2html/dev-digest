"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppShell } from "../../../components/app-shell";
import { useAgent } from "../../../lib/hooks/agents";
import { OwnerEvalView } from "../_components/OwnerEvalView";

export default function AgentEvalPage() {
  const t = useTranslations("eval");
  const params = useParams<{ agentId: string }>();
  const { data: agent } = useAgent(params.agentId);
  return (
    <AppShell
      crumb={[
        { label: t("page.crumbSkillsLab") },
        { label: t("page.crumbEvalDashboard"), href: "/eval" },
        { label: agent?.name ?? t("page.crumbAgents") },
      ]}
    >
      <OwnerEvalView
        ownerKind="agent"
        ownerId={params.agentId}
        title={agent?.name ?? t("dashboard.defaultTitle")}
        model={agent?.model}
      />
    </AppShell>
  );
}
