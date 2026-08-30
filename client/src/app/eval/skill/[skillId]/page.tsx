"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppShell } from "../../../../components/app-shell";
import { useSkill } from "../../../../lib/hooks/skills";
import { OwnerEvalView } from "../../_components/OwnerEvalView";

export default function SkillEvalPage() {
  const t = useTranslations("eval");
  const params = useParams<{ skillId: string }>();
  const { data: skill } = useSkill(params.skillId);
  return (
    <AppShell
      crumb={[
        { label: t("page.crumbSkillsLab") },
        { label: t("page.crumbEvalDashboard"), href: "/eval" },
        { label: skill?.name ?? t("page.crumbEvals") },
      ]}
    >
      <OwnerEvalView
        ownerKind="skill"
        ownerId={params.skillId}
        title={skill?.name ?? t("dashboard.defaultTitle")}
        model={skill ? `v${skill.version}` : undefined}
      />
    </AppShell>
  );
}
