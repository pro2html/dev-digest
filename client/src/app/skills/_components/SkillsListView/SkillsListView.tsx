/* /skills — empty state, or redirect into the always-split editor. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "../../../../components/app-shell";
import { useSkills } from "../../../../lib/hooks/skills";
import { CreateSkillModal } from "./_components/CreateSkillModal";
import { ImportSkillDrawer } from "./_components/ImportSkillDrawer";
import { s } from "./styles";

export function SkillsListView() {
  const t = useTranslations("skills");
  const router = useRouter();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  React.useEffect(() => {
    if (!skills || skills.length === 0) return;
    router.replace(`/skills/${skills[0]!.id}?tab=preview`);
  }, [skills, router]);

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      {creating && <CreateSkillModal onClose={() => setCreating(false)} />}
      {importing && <ImportSkillDrawer onClose={() => setImporting(false)} />}
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>{t("page.heading")}</h1>
            <p style={s.subtitle}>{t("page.subtitle")}</p>
          </div>
          <Dropdown
            width={220}
            align="right"
            trigger={
              <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                {t("page.addSkill")}
              </Button>
            }
            items={[
              { label: t("page.createSkill"), icon: "Edit", onClick: () => setCreating(true) },
              { label: t("page.importFromFile"), icon: "File", onClick: () => setImporting(true) },
            ]}
          />
        </div>

        {isLoading && (
          <div style={s.grid}>
            <Skeleton height={120} />
            <Skeleton height={120} />
            <Skeleton height={120} />
          </div>
        )}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && (skills?.length ?? 0) === 0 && (
          <EmptyState
            icon="Sparkles"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
            onCta={() => setImporting(true)}
          />
        )}
      </div>
    </AppShell>
  );
}
