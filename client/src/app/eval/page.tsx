"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "../../components/app-shell";
import { EvalDashboardView } from "./_components/EvalDashboardView";

export default function EvalDashboardPage() {
  const t = useTranslations("eval");
  return (
    <AppShell
      crumb={[
        { label: t("page.crumbSkillsLab") },
        { label: t("page.crumbEvalDashboard") },
      ]}
    >
      <EvalDashboardView />
    </AppShell>
  );
}
