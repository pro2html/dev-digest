"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "../../components/app-shell";
import { CiRunsView } from "./_components/CiRunsView";

export default function CiRunsPage() {
  const t = useTranslations("ci");
  return (
    <AppShell crumb={[{ label: t("page.crumb") }]}>
      <CiRunsView />
    </AppShell>
  );
}
